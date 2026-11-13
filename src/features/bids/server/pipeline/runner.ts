import "server-only";
import { errorReason } from "@/lib/describe-error";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bidFiles, bidQuestions, bidRequirements, bids, users } from "@/db/schema";
import { appUrl } from "@/env";
import { PIPELINE_STEPS, STEP_STAGE, VERDICT_LABELS, type Citation, type PackStats, type PipelineStep, type ProcessingState } from "@/features/bids/types";
import { coverageSummary, isScoredQuestion } from "@/features/bids/view";
import { unsubscribeLinks } from "@/features/notifications/links";
import { wantsNotification } from "@/features/notifications/prefs";
import { AiBudgetExceededError } from "@/lib/ai";
import { track } from "@/lib/analytics";
import { sendEmail } from "@/lib/email/send";
import type { JobContext } from "@/lib/jobs/handlers";
import { log } from "@/lib/logger";
import { reportError } from "@/lib/report-error";
import { addUsage, ZERO_USAGE, type AiUsage } from "../ai/call";
import { ModelJsonError } from "../ai/json";
import { ZdrUnavailableError } from "../ai/models";
import { BID_JOB_MAX_ATTEMPTS, enqueueBidJob, nudgeWorker } from "./dispatch";
import { filePriority } from "./pack";
import { citationStats } from "./quote-verify";
import { claimBid, isStepDone, loadBidRow, markStepDone, markStepRunning, PermanentPipelineError, releaseBid, setStepState, stepState, type BidRow } from "./state";
import { classifyDocument, loadPack, resequence, runDocuments, runOverview, runQuestions, runRequirements, type LoadedPack, type PartResult } from "./step-analyse";
import { runCompanyCheck } from "./step-company";
import { stepExtract } from "./step-extract";
import { stepRecheck } from "./step-recheck";

/**
 * The pack pipeline as a chain of resumable steps:
 *
 *   extract -> [overview | requirements | questions | documents] in parallel -> recheck -> company -> finalise
 *   "Reading files"   "Finding requirements" / "Listing questions"                       "Checking against your company"
 *
 * Reading the pack follows the measured design of the spike: two different models read the
 * whole pack, questionnaires / response templates / clarifications get their own reading,
 * and everything is unioned and verified IN CODE (never merged by a model).
 *
 * One job run advances the bid by one phase and enqueues the next. All progress lives in
 * the database (`bids.processing_state`, the rows themselves) and in stored pass outputs:
 *  - a refresh or navigation never loses anything, partial results are visible at once;
 *  - a crashed or timed-out worker is resumed by the next job (the per-bid lock expires),
 *    finished steps are never repeated and finished model calls are never paid for twice;
 *  - a step that keeps failing stops the run loudly: the bid becomes `failed` with the
 *    step, a plain-English reason and a retry that continues from that step.
 */

type Phase = "extract" | "analyse" | "recheck" | "company" | "finalise";

const ANALYSE_STEPS = ["overview", "requirements", "questions", "documents"] as const satisfies readonly PipelineStep[];

function nextPhase(state: ProcessingState | null | undefined): Phase | null {
  if (!isStepDone(state, "extract")) return "extract";
  if (ANALYSE_STEPS.some((step) => !isStepDone(state, step))) return "analyse";
  if (!isStepDone(state, "recheck")) return "recheck";
  if (!isStepDone(state, "company")) return "company";
  if (!isStepDone(state, "finalise")) return "finalise";
  return null;
}

/**
 * The wrapper reserves the worst case of a reading before it is sent, so a pack can be
 * refused while most of the allowance is still there. Saying "you have used your
 * allowance" would then be untrue: say that this pack needs more than is left.
 */
function budgetMessage(error: AiBudgetExceededError): string {
  const { limitUsd, spentUsd, period } = (error.details ?? {}) as { limitUsd?: number; spentUsd?: number; period?: "day" | "month" };
  if (error.scope !== "organization" || typeof limitUsd !== "number" || typeof spentUsd !== "number" || spentUsd >= limitUsd * 0.8) return error.message;
  return period === "day"
    ? "Reading this tender pack needs more AI allowance than your plan has left today, so the check stopped. Try again tomorrow, or upgrade your plan."
    : "Reading this tender pack needs more AI allowance than your plan has left this month, so the check stopped. Upgrade your plan, or try again next month.";
}

/** Message shown to the user for a failure that retries did not fix. */
function userMessage(error: unknown): string {
  if (error instanceof PermanentPipelineError) return error.message;
  if (error instanceof AiBudgetExceededError) return budgetMessage(error);
  if (error instanceof ZdrUnavailableError) return "The AI provider could not guarantee zero data retention for your documents, so they were not sent. Try again later.";
  if (error instanceof ModelJsonError) return "The AI model returned an answer we could not use. Try again — if it keeps failing, contact support.";
  const message = error instanceof Error ? error.message : "";
  if (/timeout|timed out|aborted/i.test(message)) return "The analysis took too long and was stopped. Try again.";
  if (/rate.?limit|429|overloaded|capacity/i.test(message)) return "The AI service is busy right now. Try again in a few minutes.";
  return "The analysis service did not respond as expected. Try again.";
}

function isPermanent(error: unknown): boolean {
  return error instanceof PermanentPipelineError || error instanceof AiBudgetExceededError;
}

async function failBid(bid: BidRow, step: PipelineStep, error: unknown): Promise<void> {
  const message = userMessage(error);
  const failure = { step, stage: STEP_STAGE[step], message, at: new Date().toISOString(), retryable: !(error instanceof PermanentPipelineError) };
  await setStepState(bid.id, step, { status: "failed", error: message, finishedAt: failure.at });
  await db
    .update(bids)
    .set({
      status: "failed",
      processingState: sql`jsonb_set(coalesce(${bids.processingState}, '{}'::jsonb), '{failure}', ${JSON.stringify(failure)}::jsonb, true)`,
      processingLockAt: null,
      updatedAt: new Date(),
    })
    .where(eq(bids.id, bid.id));
  if (!isPermanent(error)) await reportError(error, { route: "job:bids.process", extra: { bidId: bid.id, step } });
}

async function runStep(bid: BidRow, step: PipelineStep, attempt: number, work: () => Promise<PartResult | void>): Promise<void> {
  await markStepRunning(bid.id, step, attempt);
  const result = await work();
  await markStepDone(
    bid.id,
    step,
    result
      ? {
          ...(result.model ? { model: result.model } : {}),
          usage: result.usage,
          ...(result.passes ? { passes: result.passes } : {}),
          ...(result.failedPasses ? { failedPasses: result.failedPasses } : {}),
          ...(result.warning ? { error: result.warning } : {}),
        }
      : {},
  );
}

/** Marks the bid ready, writes the coverage report and notifies. Exactly-once transition. */
async function finalise(bid: BidRow): Promise<void> {
  const fresh = (await loadBidRow(bid.id)) ?? bid;
  const [requirements, questions, files] = await Promise.all([
    db.select().from(bidRequirements).where(eq(bidRequirements.bidId, bid.id)).orderBy(asc(bidRequirements.sortOrder)),
    db.select().from(bidQuestions).where(eq(bidQuestions.bidId, bid.id)).orderBy(asc(bidQuestions.sortOrder)),
    db.select().from(bidFiles).where(eq(bidFiles.bidId, bid.id)).orderBy(asc(bidFiles.sortOrder), asc(bidFiles.createdAt)),
  ]);

  let usage: AiUsage = ZERO_USAGE;
  const models: Record<string, string> = {};
  const warnings = [...(fresh.packStats?.warnings ?? [])];
  const passes: string[] = [];
  const failedPasses: string[] = [];
  for (const step of PIPELINE_STEPS) {
    const state = stepState(fresh.processingState, step);
    if (state.usage) usage = addUsage(usage, state.usage);
    if (state.model) models[step] = state.model;
    if (state.status === "done" && state.error && !warnings.includes(state.error)) warnings.push(state.error);
    passes.push(...(state.passes ?? []));
    failedPasses.push(...(state.failedPasses ?? []));
  }

  const brief = fresh.brief;
  const allCitations: Array<Citation | null | undefined> = [
    ...requirements.map((row) => row.citation),
    ...questions.map((row) => row.citation),
    ...(fresh.keyDates ?? []).map((item) => item.citation),
    ...(brief ? Object.values(brief.summary).map((fact) => fact.citation) : []),
    ...(brief?.redFlags ?? []).map((item) => item.citation),
    ...(brief?.documentsToReturn ?? []).map((item) => item.citation),
    ...(fresh.evaluationModel?.criteria ?? []).map((item) => item.citation),
    ...(fresh.evaluationModel?.scoringScale ?? []).map((item) => item.citation),
  ];
  const citations = citationStats(allCitations);

  // Coverage: what was read, and which readable files nothing at all was extracted from.
  const itemsByFile = new Map<string, number>();
  for (const citation of allCitations) if (citation?.fileId) itemsByFile.set(citation.fileId, (itemsByFile.get(citation.fileId) ?? 0) + 1);
  const coverageFiles = files
    .filter((file) => file.kind !== "zip")
    .map((file) => ({
      name: file.name,
      pages: file.pages ?? 0,
      tokens: file.tokenCount,
      items: itemsByFile.get(file.id) ?? 0,
      status: file.extractionStatus === "done" ? (file.includedInAnalysis ? "read" : "not analysed (pack too large)") : file.extractionStatus === "skipped" ? "skipped" : "not readable",
      note: file.error,
    }));
  const silent = files.filter((file) => file.extractionStatus === "done" && file.includedInAnalysis && file.tokenCount >= 150 && !itemsByFile.has(file.id));
  // A silent questionnaire or core document is worth a warning; silent drawings and policies are not.
  const worrying = silent.filter((file) => filePriority(file.name) === 2 || classifyDocument(file.name, "") !== null);
  if (worrying.length > 0) {
    warnings.push(`Nothing was extracted from: ${worrying.map((file) => file.name).join(", ")}. Read ${worrying.length === 1 ? "it" : "them"} yourself — requirements can hide in forms and appendices.`);
  }

  const startedAt = fresh.processingStartedAt?.getTime() ?? Date.now();
  const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const base: PackStats = fresh.packStats ?? {
    files: 0,
    pages: 0,
    chars: 0,
    tokens: 0,
    transcribedPages: 0,
    lowTextFiles: [],
    excludedFiles: [],
    failedFiles: [],
    warnings: [],
    usage: ZERO_USAGE,
    models: {},
    durationSeconds: null,
    citations: { total: 0, verified: 0 },
  };
  const packStats: PackStats = {
    ...base,
    warnings,
    usage,
    models,
    durationSeconds,
    citations,
    coverage: { passes, failedPasses, silentFiles: silent.map((file) => file.name), files: coverageFiles },
  };

  // The transition to "ready" happens exactly once, even if this step is retried.
  const transitioned = await db
    .update(bids)
    .set({ status: "ready", readyAt: new Date(), packStats, processingStage: "done", processingProgress: 100, processingLockAt: null, updatedAt: new Date() })
    .where(and(eq(bids.id, bid.id), eq(bids.status, "processing")))
    .returning({ id: bids.id });
  if (transitioned.length === 0) return;

  const passFail = requirements.filter((row) => row.isPassFail).length;
  await track(
    "brief_ready",
    { organizationId: bid.organizationId, userId: bid.createdBy },
    { requirements: requirements.length, pass_fail: passFail, questions: questions.length, citations_verified: citations.verified, citations_total: citations.total, seconds: durationSeconds },
  );

  if (bid.createdBy) {
    try {
      const [creator] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, bid.createdBy));
      // Settings → Notifications → "Product emails" (and "unsubscribe from all") apply to this e-mail.
      if (creator && (await wantsNotification(bid.createdBy, bid.organizationId, "product"))) {
        const daysLeft = fresh.submissionDeadline ? Math.ceil((fresh.submissionDeadline.getTime() - Date.now()) / 86_400_000) : null;
        const deadline = fresh.submissionDeadline
          ? `Closes ${new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(fresh.submissionDeadline)}` +
            (daysLeft !== null && daysLeft > 0 ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "")
          : null;
        const gating = requirements.filter((row) => row.isPassFail);
        const gapRows = gating.filter((row) => row.companyStatus === "gap");
        const met = gating.filter((row) => row.companyStatus === "met").length;
        const shorten = (text: string) => (text.length > 80 ? `${text.slice(0, 77).trimEnd()}…` : text);
        await sendEmail(creator.email, {
          name: "brief-ready",
          props: {
            name: creator.name.split(/\s+/)[0] ?? "",
            bidTitle: fresh.title,
            buyerName: fresh.buyerName,
            deadline,
            verdict: fresh.verdict ? VERDICT_LABELS[fresh.verdict.verdict] : null,
            requirements: requirements.length,
            passFail,
            questions: questions.length,
            citations,
            gates: { total: gating.length, met, confirm: gating.length - met - gapRows.length, gaps: gapRows.length },
            gapNames: gapRows.slice(0, 3).map((row) => shorten(row.text)),
            scoredQuestions: questions.filter((row) => isScoredQuestion(row)).length,
            coverage: coverageSummary(files, packStats).headline || null,
            url: `${appUrl}/app/bids/${bid.id}`,
          },
        }, { headers: unsubscribeLinks({ userId: bid.createdBy, organizationId: bid.organizationId, kind: "product", email: creator.email }).headers });
      }
    } catch (error) {
      // The check is ready either way; a failed notification must not undo that.
      log.warn("bids: could not send the ready e-mail", { bidId: bid.id, reason: errorReason(error) });
    }
  }
}

/** Runs ONE phase. Returns true when the same phase needs another run (more files to read). */
async function runPhase(bid: BidRow, phase: Phase, attempt: number, deadline: number): Promise<boolean> {
  switch (phase) {
    case "extract": {
      await markStepRunning(bid.id, "extract", attempt);
      const previous = stepState(bid.processingState, "extract");
      const outcome = await stepExtract(bid, deadline);
      const usage = addUsage(previous.usage ?? ZERO_USAGE, outcome.usage);
      const model = outcome.model ?? previous.model;
      if (!outcome.done) {
        await setStepState(bid.id, "extract", { usage, ...(model ? { model } : {}) });
        return true;
      }
      await markStepDone(bid.id, "extract", { usage, ...(model ? { model } : {}) });
      return false;
    }
    case "analyse": {
      const loaded: LoadedPack = await loadPack(bid.id);
      const parts: Array<[PipelineStep, () => Promise<PartResult>]> = [
        ["overview", () => runOverview(bid, loaded, attempt)],
        ["requirements", () => runRequirements(bid, loaded, attempt)],
        ["questions", () => runQuestions(bid, loaded, attempt)],
        ["documents", () => runDocuments(bid, loaded, attempt)],
      ];
      const pending = parts.filter(([step]) => !isStepDone(bid.processingState, step));
      // Independent readings: run them together, keep whatever succeeds.
      const settled = await Promise.allSettled(pending.map(([step, work]) => runStep(bid, step, attempt, work)));
      const failures = settled.flatMap((result, index) => (result.status === "rejected" ? [{ step: pending[index]![0], error: result.reason as unknown }] : []));
      if (failures.length > 0) {
        for (const failure of failures) {
          await setStepState(bid.id, failure.step, { status: "pending", error: userMessage(failure.error) });
        }
        const chosen = failures.find((failure) => isPermanent(failure.error)) ?? failures[0]!;
        const error = chosen.error instanceof Error ? chosen.error : new Error(String(chosen.error));
        throw Object.assign(error, { pipelineStep: chosen.step });
      }
      await resequence(bid, loaded.index);
      return false;
    }
    case "recheck": {
      if (process.env.BIDS_RECHECK === "0") {
        await markStepDone(bid.id, "recheck", {});
        return false;
      }
      const loaded = await loadPack(bid.id);
      try {
        await runStep(bid, "recheck", attempt, async () => {
          const result = await stepRecheck(bid, loaded);
          log.info("bids: second pass merged", { bidId: bid.id, ...result.summary });
          return result;
        });
      } catch (error) {
        if (isPermanent(error) || attempt < BID_JOB_MAX_ATTEMPTS) throw error;
        // This pass is a safety net on top of the union, not the result itself: after the
        // last retry the check is delivered without it, with a visible warning.
        await markStepDone(bid.id, "recheck", { failedPasses: ["what did we miss"], error: "The final “what did we miss” pass did not complete. Re-read the pack for anything missing." });
        await reportError(error, { route: "job:bids.process", extra: { bidId: bid.id, step: "recheck", softFailed: true } });
      }
      return false;
    }
    case "company": {
      await runStep(bid, "company", attempt, async () => {
        const outcome = await runCompanyCheck(bid.organizationId, bid.id, bid.createdBy);
        return outcome.model ? { model: outcome.model, usage: outcome.usage } : undefined;
      });
      return false;
    }
    case "finalise": {
      await markStepRunning(bid.id, "finalise", attempt);
      await finalise(bid);
      await setStepState(bid.id, "finalise", { status: "done", finishedAt: new Date().toISOString() });
      return false;
    }
  }
}

const PHASE_STEP: Record<Phase, PipelineStep> = { extract: "extract", analyse: "requirements", recheck: "recheck", company: "company", finalise: "finalise" };

/** Soft time budget of one job run; a phase that starts before it may finish after it. */
const RUN_BUDGET_MS = 25_000;
/** How long the extraction loop may read files before handing over to a new job. */
const EXTRACT_BUDGET_MS = 150_000;

/**
 * Job handler for "bids.process". Idempotent and safe to run concurrently: the per-bid lock
 * lets one worker in, and every step checks what is already done.
 */
export async function processBidJob(payload: { bidId: string; runId: string }, context: JobContext): Promise<void> {
  const started = Date.now();
  const claimed = await claimBid(payload.bidId, payload.runId);
  if (!claimed) return; // finished, superseded by a retry, deleted, or another worker is on it

  let bid = claimed;
  let phase: Phase | null = nextPhase(bid.processingState);
  let hops = 0;
  try {
    while (phase) {
      const again = await runPhase(bid, phase, context.attempt, Date.now() + EXTRACT_BUDGET_MS);
      const refreshed = await loadBidRow(bid.id);
      if (!refreshed || refreshed.status !== "processing" || refreshed.processingState?.runId !== payload.runId) return;
      bid = refreshed;
      const upcoming = again ? phase : nextPhase(bid.processingState);
      if (!upcoming) break;
      if (again || Date.now() - started > RUN_BUDGET_MS) {
        // Hand over to a fresh invocation rather than risk the function's time limit.
        hops += 1;
        await releaseBid(bid.id);
        await enqueueBidJob(bid.id, payload.runId, `${upcoming}:${context.jobId}:${hops}`);
        await nudgeWorker();
        return;
      }
      phase = upcoming;
    }
    await releaseBid(bid.id);
  } catch (error) {
    const step = (error as { pipelineStep?: PipelineStep } | null)?.pipelineStep ?? PHASE_STEP[phase ?? "finalise"];
    if (!isPermanent(error) && context.attempt < BID_JOB_MAX_ATTEMPTS) {
      // Transient: let the job system retry this run with backoff. Finished steps stay done.
      await setStepState(bid.id, step, { status: "pending", error: `${userMessage(error)} Retrying…` }).catch(() => undefined);
      await releaseBid(bid.id).catch(() => undefined);
      throw error;
    }
    await failBid(bid, step, error);
  }
}
