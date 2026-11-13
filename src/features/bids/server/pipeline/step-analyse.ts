import "server-only";
import type { ModelMessage } from "ai";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/db";
import { bidFiles, bidQuestions, bidRequirements, bids } from "@/db/schema";
import { estimateTokens } from "@/features/bids/constants";
import type { SummaryField } from "@/features/bids/types";
import { AiBudgetExceededError } from "@/lib/ai";
import { orgFileKey, storage } from "@/lib/storage";
import { addUsage, callJson, ZERO_USAGE, type AiJsonResult, type AiUsage } from "../ai/call";
import type { ModelStep } from "../ai/models";
import { unitMarker } from "../extract";
import { readBytes, readText } from "../store";
import { BID_JOB_MAX_ATTEMPTS } from "./dispatch";
import { buildPack, type BuiltPack } from "./pack";
import { DOCUMENT_TASK, EXTRACT_SYSTEM, KEYFACTS_TASK, OVERVIEW_TASK, packPrefix, QUESTIONS_TASK, REQUIREMENTS_TASK } from "./prompts";
import { buildPackIndex, type PackIndex } from "./quote-verify";
import {
  documentOutputSchema,
  keyFactsOutputSchema,
  overviewOutputSchema,
  questionsOutputSchema,
  requirementsOutputSchema,
  type RawQuestion,
  type RawRequirement,
} from "./schema";
import { PermanentPipelineError, type BidRow } from "./state";
import { compareKeyDates, parseUkLocal, toBrief, toFact, toKeyDate, toQuestion, toRequirement } from "./transform";
import { mergeQuestionPass, mergeRequirementPass, reconcileFact, type PassId } from "./union";

export type LoadedPack = { pack: BuiltPack; index: PackIndex };

/** The pack text of a bid as the model sees it, plus the index used to verify citations. */
export async function loadPack(bidId: string): Promise<LoadedPack> {
  const files = await db
    .select()
    .from(bidFiles)
    .where(and(eq(bidFiles.bidId, bidId), eq(bidFiles.extractionStatus, "done"), eq(bidFiles.includedInAnalysis, true)))
    .orderBy(asc(bidFiles.sortOrder), asc(bidFiles.createdAt));
  const sources = await Promise.all(files.map(async (file) => ({ id: file.id, name: file.name, units: await readText(file.textStorageKey) })));
  const pack = buildPack(sources);
  if (!pack.text.trim()) throw new PermanentPipelineError("No readable text was found in the uploaded files.");
  return { pack, index: buildPackIndex(pack.files) };
}

/**
 * [pack][task] as two text parts of one user message. The pack part is marked cacheable
 * for providers with explicit prompt caching (ignored by the others, which cache identical
 * prefixes implicitly); the task and its JSON shape come AFTER the pack, so every pass over
 * the same pack shares one cached prefix (REPORT.md §7.3).
 */
export function packMessages(packText: string, task: string): ModelMessage[] {
  return [
    {
      role: "user",
      content: [
        { type: "text", text: packPrefix(packText), providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
        { type: "text", text: task },
      ],
    },
  ];
}

/** Output tokens to allow: long packs have long matrices; reasoning models need headroom. */
function outputBudget(packTokens: number, base: number): number {
  return Math.min(32_000, base + Math.round(packTokens / 6));
}

export type PartResult = { model: string; usage: AiUsage; warning?: string; passes?: string[]; failedPasses?: string[] };

// --- Pass outputs are kept: a retry never pays for a pass twice --------------------------

type StoredPass<T> = { value: T; model: string; usage: AiUsage; truncated: boolean; at: string };

function workKey(bid: BidRow, name: string): string {
  return orgFileKey(bid.organizationId, "bids", bid.id, "work", `${name.replace(/[^A-Za-z0-9._-]+/g, "-")}.json`);
}

/**
 * Runs one extraction pass, or returns its stored output from an earlier attempt. Every
 * model output is kept next to the pack (audit trail, and resumability after a crash).
 */
async function cachedPass<T>(bid: BidRow, name: string, schema: z.ZodType<T>, run: () => Promise<AiJsonResult<T>>): Promise<StoredPass<T>> {
  const key = workKey(bid, name);
  const stored = await readBytes(key);
  if (stored) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(stored)) as StoredPass<unknown>;
      const value = schema.safeParse(parsed.value);
      if (value.success) return { ...parsed, value: value.data };
    } catch {
      // unreadable work file: run the pass again
    }
  }
  const result = await run();
  const record: StoredPass<T> = { value: result.value, model: result.model, usage: result.usage, truncated: result.truncated, at: new Date().toISOString() };
  await storage.put(key, new TextEncoder().encode(JSON.stringify(record)), { contentType: "application/json" });
  return record;
}

type PassSpec<T> = { name: string; label: string; run: () => Promise<StoredPass<T>>; onDone?: (result: StoredPass<T>) => Promise<void> };

/**
 * Runs the passes of one step together. Each finished pass is merged at once (partial
 * results appear as they land). A failed pass is retried by the job; on the last attempt
 * the step continues with whatever passes succeeded and says which did not.
 */
async function runPasses<T>(attempt: number, specs: Array<PassSpec<T>>): Promise<PartResult> {
  const settled = await Promise.allSettled(
    specs.map(async (spec) => {
      const result = await spec.run();
      await spec.onDone?.(result);
      return result;
    }),
  );
  let usage = ZERO_USAGE;
  const models: string[] = [];
  const passes: string[] = [];
  const failedPasses: string[] = [];
  let truncated = false;
  let firstError: unknown = null;
  settled.forEach((outcome, index) => {
    const spec = specs[index]!;
    if (outcome.status === "fulfilled") {
      usage = addUsage(usage, outcome.value.usage);
      if (!models.includes(outcome.value.model)) models.push(outcome.value.model);
      passes.push(spec.label);
      truncated ||= outcome.value.truncated;
    } else {
      failedPasses.push(spec.label);
      if (outcome.reason instanceof AiBudgetExceededError || outcome.reason instanceof PermanentPipelineError) firstError = outcome.reason;
      firstError ??= outcome.reason;
    }
  });
  if (failedPasses.length > 0) {
    const permanent = firstError instanceof AiBudgetExceededError || firstError instanceof PermanentPipelineError;
    if (permanent || passes.length === 0 || attempt < BID_JOB_MAX_ATTEMPTS) throw firstError;
  }
  const warnings: string[] = [];
  if (failedPasses.length > 0) warnings.push(`These readings of the pack did not complete: ${failedPasses.join(", ")}. Coverage may be lower than usual.`);
  if (truncated) warnings.push("One model answer was cut short; later passes look for what is missing.");
  return { model: models.join(" + "), usage, passes, failedPasses, ...(warnings.length > 0 ? { warning: warnings.join(" ") } : {}) };
}

// --- Deterministic union into the database ----------------------------------------------

async function lockBid(tx: Tx, bidId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`bid-merge:${bidId}`}, 0))`);
}

/** Unions the requirements found by one pass into the bid (see union.ts). Returns rows added. */
export async function persistRequirements(bid: BidRow, index: PackIndex, raws: RawRequirement[], pass: PassId): Promise<number> {
  const drafts = raws.filter((raw) => raw.requirement.trim()).map((raw) => toRequirement(index, raw));
  if (drafts.length === 0) return 0;
  return db.transaction(async (tx) => {
    await lockBid(tx, bid.id);
    const rows = await tx.select().from(bidRequirements).where(eq(bidRequirements.bidId, bid.id)).orderBy(asc(bidRequirements.sortOrder));
    const plan = mergeRequirementPass(
      rows.map((row) => ({
        id: row.id,
        text: row.text,
        threshold: row.threshold,
        kind: row.kind,
        isPassFail: row.isPassFail,
        citation: row.citation,
        evidenceToProvide: row.evidenceToProvide,
        provenance: row.provenance,
        locked: row.userEdited || row.source === "user",
      })),
      drafts,
      pass,
    );
    for (const update of plan.updates) {
      await tx.update(bidRequirements).set({ ...update.patch, updatedAt: new Date() }).where(eq(bidRequirements.id, update.id));
    }
    if (plan.inserts.length > 0) {
      const lastOrder = rows.reduce((max, row) => Math.max(max, row.sortOrder), 0);
      const lastNumber = rows.reduce((max, row) => Math.max(max, Number(/^R(\d+)$/.exec(row.ref)?.[1] ?? 0)), 0);
      await tx.insert(bidRequirements).values(
        plan.inserts.map((draft, position) => ({
          organizationId: bid.organizationId,
          bidId: bid.id,
          ref: `R${lastNumber + position + 1}`,
          ...draft,
          source: pass === "recheck" ? "ai_recheck" : "ai",
          sortOrder: lastOrder + (position + 1) * 10,
        })),
      );
    }
    return plan.inserts.length;
  });
}

/** Unions the questions found by one pass into the bid. Returns rows added. */
export async function persistQuestions(bid: BidRow, index: PackIndex, raws: RawQuestion[], pass: PassId): Promise<number> {
  const drafts = raws.filter((raw) => raw.text.trim() || raw.title.trim()).map((raw) => toQuestion(index, raw));
  if (drafts.length === 0) return 0;
  return db.transaction(async (tx) => {
    await lockBid(tx, bid.id);
    const rows = await tx.select().from(bidQuestions).where(eq(bidQuestions.bidId, bid.id)).orderBy(asc(bidQuestions.sortOrder));
    const plan = mergeQuestionPass(
      rows.map((row) => ({
        id: row.id,
        ref: row.ref,
        title: row.title,
        text: row.text,
        weighting: row.weighting,
        maxScore: row.maxScore,
        wordLimit: row.wordLimit,
        pageLimit: row.pageLimit,
        limitText: row.limitText,
        guidance: row.guidance,
        section: row.section,
        citation: row.citation,
        provenance: row.provenance,
        locked: row.userEdited || row.source === "user",
      })),
      drafts,
      pass,
    );
    for (const update of plan.updates) {
      await tx.update(bidQuestions).set({ ...update.patch, updatedAt: new Date() }).where(eq(bidQuestions.id, update.id));
    }
    if (plan.inserts.length > 0) {
      const lastOrder = rows.reduce((max, row) => Math.max(max, row.sortOrder), 0);
      await tx.insert(bidQuestions).values(
        plan.inserts.map((draft, position) => ({
          organizationId: bid.organizationId,
          bidId: bid.id,
          ...draft,
          text: draft.text || draft.title || "",
          source: pass === "recheck" ? "ai_recheck" : "ai",
          sortOrder: lastOrder + (position + 1) * 10,
        })),
      );
    }
    return plan.inserts.length;
  });
}

/**
 * Puts requirements and questions into document order (file, then page) and renumbers the
 * requirement references R1…Rn. Items without a located quote go last. Runs once, when all
 * first-pass readings are in; later additions are appended.
 */
export async function resequence(bid: BidRow, index: PackIndex): Promise<void> {
  const position = new Map<string, number>();
  index.files.forEach((file, fileIndex) => file.units.forEach((unit, unitIndex) => position.set(`${file.id}|${unit.loc}`, fileIndex * 100_000 + unitIndex)));
  const rank = (citation: { fileId: string | null; loc: string; verified: boolean } | null, fallback: number) =>
    citation?.fileId && position.has(`${citation.fileId}|${citation.loc}`) ? position.get(`${citation.fileId}|${citation.loc}`)! : 50_000_000 + fallback;
  await db.transaction(async (tx) => {
    await lockBid(tx, bid.id);
    const requirements = await tx.select().from(bidRequirements).where(eq(bidRequirements.bidId, bid.id)).orderBy(asc(bidRequirements.sortOrder));
    const orderedRequirements = requirements.map((row, i) => ({ row, key: rank(row.citation, i) })).sort((a, b) => a.key - b.key);
    for (const [i, entry] of orderedRequirements.entries()) {
      const ref = `R${i + 1}`;
      const sortOrder = (i + 1) * 10;
      if (entry.row.ref !== ref || entry.row.sortOrder !== sortOrder) await tx.update(bidRequirements).set({ ref, sortOrder }).where(eq(bidRequirements.id, entry.row.id));
    }
    const questions = await tx.select().from(bidQuestions).where(eq(bidQuestions.bidId, bid.id)).orderBy(asc(bidQuestions.sortOrder));
    const orderedQuestions = questions.map((row, i) => ({ row, key: rank(row.citation, i) })).sort((a, b) => a.key - b.key);
    for (const [i, entry] of orderedQuestions.entries()) {
      const sortOrder = (i + 1) * 10;
      if (entry.row.sortOrder !== sortOrder) await tx.update(bidQuestions).set({ sortOrder }).where(eq(bidQuestions.id, entry.row.id));
    }
  });
}

// --- The steps ----------------------------------------------------------------------------

const DEFAULT_TITLE = /^(untitled bid|new bid)/i;

function extraction<T>(bid: BidRow, loaded: LoadedPack, options: { feature: string; step: ModelStep; task: string; schema: z.ZodType<T>; base: number }) {
  return callJson({
    organizationId: bid.organizationId,
    userId: bid.createdBy,
    feature: options.feature,
    step: options.step,
    system: EXTRACT_SYSTEM,
    messages: packMessages(loaded.pack.text, options.task),
    schema: options.schema,
    maxOutputTokens: outputBudget(loaded.pack.tokens, options.base),
    timeoutMs: 240_000,
  });
}

/** Fields where a second, independent reading is compared with the first. */
const CROSS_CHECKED: SummaryField[] = ["submission_deadline", "clarification_deadline", "submission_method", "estimated_value", "contract_start", "contract_duration", "tender_validity"];

/**
 * Brief: summary facts, key dates, evaluation model, documents to return, red flags,
 * unknowns — plus a second model's independent reading of the key facts. Where the two
 * readings of a deadline (or value, or submission address) differ, both are kept and the
 * fact is shown as "conflicting" for a person to settle.
 */
export async function runOverview(bid: BidRow, loaded: LoadedPack, attempt: number): Promise<PartResult> {
  const overviewPass = () =>
    cachedPass(bid, "overview-primary", overviewOutputSchema, () => extraction(bid, loaded, { feature: "bids.overview", step: "extract", task: OVERVIEW_TASK, schema: overviewOutputSchema, base: 12_000 }));
  const keyFactsPass = () =>
    cachedPass(bid, "keyfacts-second", keyFactsOutputSchema, () => extraction(bid, loaded, { feature: "bids.keyfacts", step: "extract2", task: KEYFACTS_TASK, schema: keyFactsOutputSchema, base: 5_000 }));

  // The brief needs the primary reading; the second reading is a cross-check that may fail softly.
  const [primary, second] = await Promise.allSettled([overviewPass(), keyFactsPass()]);
  if (primary.status === "rejected") throw primary.reason;
  if (second.status === "rejected") {
    const reason: unknown = second.reason;
    if (reason instanceof AiBudgetExceededError || attempt < BID_JOB_MAX_ATTEMPTS) throw reason;
  }
  const { brief, evaluationModel, keyDates } = toBrief(loaded.index, primary.value.value);
  let dates = keyDates;
  const conflicts: string[] = [];
  if (second.status === "fulfilled") {
    for (const field of CROSS_CHECKED) {
      const reconciled = reconcileFact(brief.summary[field], toFact(loaded.index, second.value.value.summary[field]));
      if (reconciled.status === "conflicting" && brief.summary[field].status !== "conflicting") conflicts.push(field);
      brief.summary[field] = reconciled;
    }
    // Key dates: union of both readings (same event + date counts once).
    const seen = new Set(dates.map((item) => `${item.dateIso ?? ""}|${item.time ?? ""}`));
    for (const item of second.value.value.key_dates.map((raw) => toKeyDate(loaded.index, raw))) {
      const key = `${item.dateIso ?? ""}|${item.time ?? ""}`;
      if (!item.dateIso || seen.has(key) || !item.citation?.verified) continue;
      seen.add(key);
      dates.push(item);
    }
    dates = dates.sort(compareKeyDates);
    if (conflicts.length > 0 && !brief.redFlags.some((flag) => flag.type === "contradiction_in_documents" && /two readings/i.test(flag.description))) {
      brief.redFlags.unshift({
        type: "contradiction_in_documents",
        severity: "high",
        description: `Two readings of the pack disagree on: ${conflicts.map((field) => field.replace(/_/g, " ")).join(", ")}. Check these against the documents before relying on them.`,
        citation: null,
      });
    }
  }
  const deadline = brief.summary.submission_deadline.status === "conflicting" ? null : parseUkLocal(brief.summary.submission_deadline.normalized);
  const title = brief.summary.title.value?.trim();
  const buyer = brief.summary.buyer.value?.trim();
  const reference = brief.summary.reference.value?.trim();
  await db
    .update(bids)
    .set({
      brief,
      evaluationModel,
      keyDates: dates,
      submissionDeadline: deadline,
      // Fill what the user left blank; never overwrite a title they typed.
      title: title && DEFAULT_TITLE.test(bid.title) ? title.slice(0, 200) : bid.title,
      buyerName: bid.buyerName ?? (buyer ? buyer.slice(0, 200) : null),
      reference: bid.reference ?? (reference ? reference.slice(0, 120) : null),
      updatedAt: new Date(),
    })
    .where(eq(bids.id, bid.id));

  const usage = second.status === "fulfilled" ? addUsage(primary.value.usage, second.value.usage) : primary.value.usage;
  const warnings: string[] = [];
  if (primary.value.truncated) warnings.push("The brief was cut short by the model; some sections may be incomplete.");
  if (second.status === "rejected") warnings.push("The second reading of the deadlines did not complete: dates rest on one reading only. Check them against the documents.");
  return {
    model: [primary.value.model, ...(second.status === "fulfilled" ? [second.value.model] : [])].filter((model, i, all) => all.indexOf(model) === i).join(" + "),
    usage,
    passes: ["primary brief", ...(second.status === "fulfilled" ? ["second reading of key facts"] : [])],
    failedPasses: second.status === "rejected" ? ["second reading of key facts"] : [],
    ...(warnings.length > 0 ? { warning: warnings.join(" ") } : {}),
  };
}

/** The compliance matrix: two different models read the whole pack; their lists are unioned in code. */
export async function runRequirements(bid: BidRow, loaded: LoadedPack, attempt: number): Promise<PartResult> {
  const spec = (name: string, label: string, step: ModelStep, pass: PassId): PassSpec<z.infer<typeof requirementsOutputSchema>> => ({
    name,
    label,
    run: () => cachedPass(bid, name, requirementsOutputSchema, () => extraction(bid, loaded, { feature: `bids.requirements.${pass}`, step, task: REQUIREMENTS_TASK, schema: requirementsOutputSchema, base: 16_000 })),
    onDone: async (result) => {
      await persistRequirements(bid, loaded.index, result.value.requirements, pass);
    },
  });
  return runPasses(attempt, [spec("requirements-primary", "requirements (first model)", "extract", "primary"), spec("requirements-second", "requirements (second model)", "extract2", "second")]);
}

/** The scored questions / response sections, read by two models and unioned. */
export async function runQuestions(bid: BidRow, loaded: LoadedPack, attempt: number): Promise<PartResult> {
  const spec = (name: string, label: string, step: ModelStep, pass: PassId): PassSpec<z.infer<typeof questionsOutputSchema>> => ({
    name,
    label,
    run: () => cachedPass(bid, name, questionsOutputSchema, () => extraction(bid, loaded, { feature: `bids.questions.${pass}`, step, task: QUESTIONS_TASK, schema: questionsOutputSchema, base: 12_000 })),
    onDone: async (result) => {
      await persistQuestions(bid, loaded.index, result.value.questions, pass);
    },
  });
  return runPasses(attempt, [spec("questions-primary", "questions (first model)", "extract", "primary"), spec("questions-second", "questions (second model)", "extract2", "second")]);
}

// --- Per-document passes ------------------------------------------------------------------

export type DocumentClass = "clarifications" | "questionnaire" | "response_template" | "pricing";

const CLASS_PATTERNS: Array<[DocumentClass, RegExp]> = [
  ["clarifications", /clarif|q\s?(&|and)\s?a\b|questions?[\s_-]*(and|&)[\s_-]*answers?|quer(y|ies)|faqs?\b|addend|amendment|responses?[\s_-]*to[\s_-]*(questions|queries)/i],
  ["questionnaire", /questionnaire|\bddq\b|\bpsq\b|\bsq\b|\bpqq\b|due[\s_-]*dilig|selection[\s_-]*(stage|criteria)|conditions[\s_-]*of[\s_-]*participation|health[\s_-]*(and|&)?[\s_-]*safety/i],
  ["response_template", /response|template|submission|method[\s_-]*statement|methodology|quality|form[\s_-]*of[\s_-]*tender|tender[\s_-]*form|proposal[\s_-]*form|award[\s_-]*questions|evaluation/i],
  ["pricing", /pric(e|ing)|commercial|schedule[\s_-]*of[\s_-]*rates|cost[\s_-]*(model|schedule)|fees?\b/i],
];

/**
 * Classifies a pack file as one that deserves its own reading. Uses the file name first,
 * then the shape of the text (a document made of questions and answer boxes).
 */
export function classifyDocument(name: string, text: string): DocumentClass | null {
  const base = name.split("/").pop() ?? name;
  for (const [kind, pattern] of CLASS_PATTERNS) if (pattern.test(base)) return kind;
  const lines = text.split("\n");
  const questionLines = lines.filter((line) => /\?\s*$/.test(line.trim())).length;
  const responseBoxes = (text.match(/\b(response|answer)\s*:/gi) ?? []).length;
  if (questionLines >= 8 || responseBoxes >= 4) return "questionnaire";
  return null;
}

const DOCUMENT_ORDER: DocumentClass[] = ["clarifications", "questionnaire", "response_template", "pricing"];
/** Most documents given their own pass, and the largest one that qualifies (tokens). */
const MAX_DOCUMENT_PASSES = 6;
const MAX_DOCUMENT_TOKENS = 40_000;
const DOCUMENT_CONCURRENCY = 3;

/**
 * Per-document readings of questionnaires, response templates and clarification files,
 * unioned with the whole-pack readings. The spike found that a whole-pack pass listed 3 of
 * 10 questions of a questionnaire that a per-document pass listed in full, and that
 * clarification answers can carry eligibility rules stated nowhere else.
 */
export async function runDocuments(bid: BidRow, loaded: LoadedPack, attempt: number): Promise<PartResult> {
  if (loaded.pack.files.length < 2) return { model: "", usage: ZERO_USAGE, passes: [], failedPasses: [] };
  const candidates = loaded.pack.files
    .map((file) => {
      const text = file.units.map((unit) => unit.text).join("\n");
      return { file, text, tokens: estimateTokens(text), kind: classifyDocument(file.name, text) };
    })
    .filter((entry): entry is typeof entry & { kind: DocumentClass } => entry.kind !== null && entry.tokens >= 60 && entry.tokens <= MAX_DOCUMENT_TOKENS)
    .sort((a, b) => DOCUMENT_ORDER.indexOf(a.kind) - DOCUMENT_ORDER.indexOf(b.kind))
    .slice(0, MAX_DOCUMENT_PASSES);
  if (candidates.length === 0) return { model: "", usage: ZERO_USAGE, passes: [], failedPasses: [] };

  const specs: Array<PassSpec<z.infer<typeof documentOutputSchema>>> = candidates.map(({ file, kind }) => ({
    name: `document-${file.id}`,
    label: `${kind.replace("_", " ")}: ${file.name}`,
    run: () =>
      cachedPass(bid, `document-${file.id}`, documentOutputSchema, () => {
        const text = file.units
          .filter((unit) => unit.text.trim())
          .map((unit) => `${unitMarker(file.name, unit.loc)}\n${unit.text}`)
          .join("\n\n");
        return callJson({
          organizationId: bid.organizationId,
          userId: bid.createdBy,
          feature: "bids.document",
          step: "document",
          system: EXTRACT_SYSTEM,
          messages: `${packPrefix(text)}${DOCUMENT_TASK}`,
          schema: documentOutputSchema,
          maxOutputTokens: Math.min(24_000, 8_000 + Math.round(estimateTokens(text) / 2)),
          timeoutMs: 200_000,
        });
      }),
    onDone: async (result) => {
      await persistRequirements(bid, loaded.index, result.value.requirements, "document");
      await persistQuestions(bid, loaded.index, result.value.questions, "document");
    },
  }));

  // A few at a time: providers rate-limit bursts.
  let combined: PartResult = { model: "", usage: ZERO_USAGE, passes: [], failedPasses: [] };
  for (let offset = 0; offset < specs.length; offset += DOCUMENT_CONCURRENCY) {
    const batch = specs.slice(offset, offset + DOCUMENT_CONCURRENCY);
    let part: PartResult;
    try {
      part = await runPasses(attempt, batch);
    } catch (error) {
      if (error instanceof AiBudgetExceededError || attempt < BID_JOB_MAX_ATTEMPTS) throw error;
      // Last attempt and a whole batch failed: the whole-pack readings still stand.
      part = { model: "", usage: ZERO_USAGE, passes: [], failedPasses: batch.map((spec) => spec.label), warning: `These documents did not get their own reading: ${batch.map((spec) => spec.label).join(", ")}.` };
    }
    combined = {
      model: [...new Set([...combined.model.split(" + "), ...part.model.split(" + ")].filter(Boolean))].join(" + "),
      usage: addUsage(combined.usage, part.usage),
      passes: [...(combined.passes ?? []), ...(part.passes ?? [])],
      failedPasses: [...(combined.failedPasses ?? []), ...(part.failedPasses ?? [])],
      warning: [combined.warning, part.warning].filter(Boolean).join(" ") || undefined,
    };
  }
  return combined;
}

