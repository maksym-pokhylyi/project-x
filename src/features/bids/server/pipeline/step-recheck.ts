import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bidQuestions, bidRequirements, bids } from "@/db/schema";
import { SUMMARY_FIELDS, type BidBrief, type BidKeyDate, type EvaluationModel } from "@/features/bids/types";
import { callJson } from "../ai/call";
import { planPatch, type PatchPlan, type RecheckDraft } from "./merge";
import { EXTRACT_SYSTEM, RECHECK_TASK } from "./prompts";
import { normaliseText, thresholdGrounded, type PackIndex } from "./quote-verify";
import { patchOutputSchema } from "./schema";
import { packMessages, persistQuestions, persistRequirements, type LoadedPack, type PartResult } from "./step-analyse";
import type { BidRow } from "./state";
import { cite, compareKeyDates, KIND_TO_RAW, parseUkLocal, toFact, toKeyDate, toQuestion, toRequirement } from "./transform";
import { reconcileFact } from "./union";

type RequirementRow = typeof bidRequirements.$inferSelect;
type QuestionRow = typeof bidQuestions.$inferSelect;

/** The draft shown to the second pass: what was found, without quotes (they cost tokens). */
export function buildRecheckDraft(bid: Pick<BidRow, "brief" | "evaluationModel" | "keyDates">, requirements: RequirementRow[], questions: QuestionRow[]) {
  const brief = bid.brief;
  const evaluation = bid.evaluationModel;
  const summary = Object.fromEntries(
    SUMMARY_FIELDS.map((field) => {
      const fact = brief?.summary?.[field];
      return [field, { value: fact?.value ?? null, normalized: fact?.normalized ?? null, status: fact?.status ?? "not_stated" }];
    }),
  );
  return {
    summary,
    key_dates: (bid.keyDates ?? []).map((item) => ({ event: item.event, date_iso: item.dateIso, time_24h: item.time })),
    evaluation: {
      price_weight_percent: evaluation?.priceWeight ?? null,
      quality_weight_percent: evaluation?.qualityWeight ?? null,
      social_value_weight_percent: evaluation?.socialValueWeight ?? null,
      criteria: (evaluation?.criteria ?? []).map((item) => ({ name: item.name, weight_percent: item.weight, parent: item.parent })),
      scoring_scale_rows: evaluation?.scoringScale.length ?? 0,
      minimum_thresholds: (evaluation?.minimumThresholds ?? []).map((item) => ({ description: item.description })),
    },
    requirements: requirements.map((row) => ({
      id: row.ref,
      category: row.category,
      requirement: row.text,
      threshold: row.threshold,
      kind: KIND_TO_RAW[row.kind as keyof typeof KIND_TO_RAW] ?? "mandatory_unscored",
    })),
    questions: questions.map((row) => ({
      id: row.ref,
      title: row.title ?? row.text.slice(0, 120),
      weight_percent: row.weighting,
      max_score_points: row.maxScore,
      limit_text: row.limitText,
      limit_words: row.wordLimit,
      limit_pages: row.pageLimit,
    })),
    documents_to_return: (brief?.documentsToReturn ?? []).map((item) => ({ name: item.name })),
    red_flags: (brief?.redFlags ?? []).map((item) => ({ type: item.type, description: item.description })),
  };
}

function toMergeDraft(draft: ReturnType<typeof buildRecheckDraft>, requirements: RequirementRow[], questions: QuestionRow[]): RecheckDraft {
  return {
    requirements: requirements.map((row) => ({
      id: row.ref,
      category: row.category,
      requirement: row.text,
      threshold: row.threshold,
      kind: row.kind,
      quote: row.citation?.quote ?? null,
    })),
    questions: questions.map((row) => ({ id: row.ref, title: row.title ?? "", text: row.text, weight_percent: row.weighting, quote: row.citation?.quote ?? null })),
    criteria: draft.evaluation.criteria.map((item) => ({ name: item.name })),
    key_dates: draft.key_dates.map((item) => ({ event: item.event, date_iso: item.date_iso })),
    documents_to_return: draft.documents_to_return,
    red_flags: draft.red_flags,
    minimum_thresholds: draft.evaluation.minimum_thresholds,
  };
}

export type RecheckSummary = { addedRequirements: number; addedQuestions: number; corrected: number; removed: number };

/**
 * Applies an accepted patch. Rules that protect recall and people's work:
 *  - additions go through the same deterministic union as every other pass;
 *  - rows a person edited are never changed or removed;
 *  - a removal is honoured only when the row's own citation is unverified AND no other
 *    pass found the item independently;
 *  - a correction is applied only when it comes with a quote that verifies;
 *  - a summary fact is replaced only by a verified one; when both readings are verified
 *    and differ, both are kept and the fact is shown as conflicting.
 */
export async function applyPatchPlan(bid: BidRow, index: PackIndex, plan: PatchPlan, requirements: RequirementRow[], questions: QuestionRow[]): Promise<RecheckSummary> {
  const summary: RecheckSummary = { addedRequirements: 0, addedQuestions: 0, corrected: 0, removed: 0 };
  const requirementByRef = new Map(requirements.map((row) => [row.ref, row]));
  const questionByRef = new Map(questions.map((row) => [row.ref, row]));
  const foundTwice = (row: { provenance: { passes: string[] } | null }) => (row.provenance?.passes.length ?? 0) >= 2;

  await db.transaction(async (tx) => {
    // --- requirements ---------------------------------------------------------------
    const removable = plan.removeRequirementIds
      .map((item) => requirementByRef.get(item.id))
      .filter((row): row is RequirementRow => Boolean(row) && !row!.userEdited && row!.source !== "user" && !row!.citation?.verified && !foundTwice(row!));
    if (removable.length > 0) {
      await tx.delete(bidRequirements).where(inArray(bidRequirements.id, removable.map((row) => row.id)));
      summary.removed += removable.length;
    }
    for (const update of plan.requirementUpdates) {
      const row = requirementByRef.get(update.id);
      if (!row || row.userEdited || row.source === "user" || removable.includes(row)) continue;
      if (!update.cite) continue;
      let citation = cite(index, update.cite);
      if (!citation?.verified) continue;
      const threshold = update.threshold ?? row.threshold;
      if (!thresholdGrounded(index, citation, threshold)) citation = { ...citation, verified: false, issue: "figure_not_in_source" };
      const draft = update.kind
        ? toRequirement(index, {
            id: row.ref,
            category: "other",
            requirement: row.text,
            threshold,
            kind: update.kind,
            evidence_to_provide: null,
            file: update.cite.file ?? null,
            loc: update.cite.loc ?? null,
            quote: update.cite.quote ?? null,
          })
        : null;
      const passes = row.provenance?.passes ?? [];
      await tx
        .update(bidRequirements)
        .set({
          threshold,
          ...(draft ? { kind: draft.kind, isPassFail: draft.isPassFail } : {}),
          citation,
          provenance: { passes: passes.includes("recheck") ? passes : [...passes, "recheck"], notes: [...(row.provenance?.notes ?? []), `Corrected by the second pass: ${update.problem}`.slice(0, 300)] },
          updatedAt: new Date(),
        })
        .where(eq(bidRequirements.id, row.id));
      summary.corrected += 1;
    }

    // --- questions ------------------------------------------------------------------
    const removableQuestions = plan.removeQuestionIds
      .map((item) => questionByRef.get(item.id))
      .filter((row): row is QuestionRow => Boolean(row) && !row!.userEdited && row!.source !== "user" && !row!.draftText && !row!.citation?.verified && !foundTwice(row!));
    if (removableQuestions.length > 0) {
      await tx.delete(bidQuestions).where(inArray(bidQuestions.id, removableQuestions.map((row) => row.id)));
      summary.removed += removableQuestions.length;
    }
    for (const update of plan.questionUpdates) {
      const row = questionByRef.get(update.id);
      if (!row || row.userEdited || row.source === "user" || removableQuestions.includes(row)) continue;
      if (!update.cite || !cite(index, update.cite)?.verified) continue;
      const draft = toQuestion(index, {
        id: row.ref,
        title: row.title ?? "",
        text: row.text,
        sub_parts: [],
        section: row.section,
        guidance: row.guidance,
        weight_percent: update.weight_percent ?? row.weighting,
        max_score_points: update.max_score_points ?? row.maxScore,
        limit_text: update.limit_text ?? row.limitText,
        limit_words: update.limit_words ?? row.wordLimit,
        limit_pages: update.limit_pages ?? row.pageLimit,
        attachments_allowed: null,
        scored: row.scored as "unclear",
        file: null,
        loc: null,
        quote: null,
      });
      const passes = row.provenance?.passes ?? [];
      await tx
        .update(bidQuestions)
        .set({
          weighting: draft.weighting,
          maxScore: draft.maxScore,
          limitText: draft.limitText,
          wordLimit: draft.wordLimit,
          pageLimit: draft.pageLimit,
          provenance: { passes: passes.includes("recheck") ? passes : [...passes, "recheck"], notes: [...(row.provenance?.notes ?? []), `Corrected by the second pass: ${update.problem}`.slice(0, 300)] },
          updatedAt: new Date(),
        })
        .where(eq(bidQuestions.id, row.id));
      summary.corrected += 1;
    }

    // --- brief, evaluation model, key dates ------------------------------------------
    const brief: BidBrief | null = bid.brief ? structuredClone(bid.brief) : null;
    const evaluation: EvaluationModel | null = bid.evaluationModel ? structuredClone(bid.evaluationModel) : null;
    let keyDates: BidKeyDate[] = bid.keyDates ? [...bid.keyDates] : [];
    let changed = false;
    if (brief) {
      for (const correction of plan.summaryCorrections) {
        const current = brief.summary[correction.field];
        const corrected = toFact(index, correction.corrected);
        if (corrected.status === "not_stated") {
          // Clearing a value is only safe when the value had no verified support.
          if (current && current.status !== "not_stated" && !current.citation?.verified) {
            brief.summary[correction.field] = { ...corrected, note: correction.problem || corrected.note };
            changed = true;
            summary.corrected += 1;
          }
          continue;
        }
        if (!corrected.citation?.verified) continue;
        const next =
          current && current.status !== "not_stated" && current.citation?.verified
            ? reconcileFact(current, corrected) // both verified: agree, or keep both as conflicting
            : { ...corrected, note: corrected.note ?? (correction.problem || null) };
        if (JSON.stringify(next) === JSON.stringify(current)) continue;
        brief.summary[correction.field] = next;
        changed = true;
        summary.corrected += 1;
      }
      if (plan.addDocuments.length > 0) {
        brief.documentsToReturn.push(...plan.addDocuments.map((item) => ({ name: item.name, mandatory: item.mandatory, formatNote: item.format_note, citation: cite(index, item) })));
        changed = true;
      }
      if (plan.addRedFlags.length > 0) {
        brief.redFlags.push(...plan.addRedFlags.map((item) => ({ type: item.type, description: item.description, severity: item.severity, citation: cite(index, item) })));
        changed = true;
      }
      const dropDocuments = new Set(plan.removeDocuments);
      const dropFlags = new Set(plan.removeRedFlags);
      const keptDocuments = brief.documentsToReturn.filter((item) => !(dropDocuments.has(normaliseText(item.name)) && !item.citation?.verified));
      const keptFlags = brief.redFlags.filter((item) => !(dropFlags.has(normaliseText(item.description)) && !item.citation?.verified));
      if (keptDocuments.length !== brief.documentsToReturn.length || keptFlags.length !== brief.redFlags.length) changed = true;
      brief.documentsToReturn = keptDocuments;
      brief.redFlags = keptFlags;
    }
    if (evaluation) {
      if (plan.addCriteria.length > 0) {
        evaluation.criteria.push(
          ...plan.addCriteria.map((item) => ({
            name: item.name,
            weight: item.weight_percent !== null && item.weight_percent >= 0 && item.weight_percent <= 100 ? item.weight_percent : null,
            parent: item.parent,
            whatIsAssessed: item.what_is_assessed,
            citation: cite(index, item),
          })),
        );
        changed = true;
      }
      if (plan.addMinimumThresholds.length > 0) {
        evaluation.minimumThresholds.push(...plan.addMinimumThresholds.map((item) => ({ description: item.description, citation: cite(index, item) })));
        changed = true;
      }
      const dropCriteria = new Set(plan.removeCriteria);
      const keptCriteria = evaluation.criteria.filter((item) => !(dropCriteria.has(normaliseText(item.name)) && !item.citation?.verified));
      if (keptCriteria.length !== evaluation.criteria.length) changed = true;
      evaluation.criteria = keptCriteria;
    }
    if (plan.addKeyDates.length > 0) {
      keyDates = [...keyDates, ...plan.addKeyDates.map((item) => toKeyDate(index, item))].sort(compareKeyDates);
      changed = true;
    }
    const dropDates = new Set(plan.removeKeyDates);
    const keptDates = keyDates.filter((item) => !(dropDates.has(normaliseText(item.event)) && !item.citation?.verified));
    if (keptDates.length !== keyDates.length) changed = true;
    keyDates = keptDates;

    if (changed) {
      const deadlineFact = brief?.summary.submission_deadline;
      await tx
        .update(bids)
        .set({
          brief,
          evaluationModel: evaluation,
          keyDates,
          submissionDeadline: deadlineFact ? (deadlineFact.status === "conflicting" ? null : parseUkLocal(deadlineFact.normalized)) : bid.submissionDeadline,
          updatedAt: new Date(),
        })
        .where(eq(bids.id, bid.id));
    }
  });

  // Additions join through the same union as every other pass (dedupe, provenance, refs).
  summary.addedRequirements = await persistRequirements(bid, index, plan.addRequirements, "recheck");
  summary.addedQuestions = await persistQuestions(bid, index, plan.addQuestions, "recheck");
  return summary;
}

/**
 * Step — the "what did we miss" pass, aimed at pass/fail requirements, deadlines and scored
 * questions. A model re-reads the pack with the merged draft in hand and returns a patch;
 * code decides what of the patch to accept.
 */
export async function stepRecheck(bid: BidRow, loaded: LoadedPack): Promise<PartResult & { summary: RecheckSummary }> {
  const [requirements, questions] = await Promise.all([
    db.select().from(bidRequirements).where(eq(bidRequirements.bidId, bid.id)).orderBy(asc(bidRequirements.sortOrder)),
    db.select().from(bidQuestions).where(eq(bidQuestions.bidId, bid.id)).orderBy(asc(bidQuestions.sortOrder)),
  ]);
  const draft = buildRecheckDraft(bid, requirements, questions);
  const result = await callJson({
    organizationId: bid.organizationId,
    userId: bid.createdBy,
    feature: "bids.recheck",
    step: "verify",
    system: EXTRACT_SYSTEM,
    messages: packMessages(loaded.pack.text, `${RECHECK_TASK}${JSON.stringify(draft)}`),
    schema: patchOutputSchema,
    maxOutputTokens: Math.min(32_000, 12_000 + Math.round(loaded.pack.tokens / 8)),
    timeoutMs: 240_000,
  });
  const plan = planPatch(toMergeDraft(draft, requirements, questions), result.value);
  const summary = await applyPatchPlan(bid, loaded.index, plan, requirements, questions);
  return { model: result.model, usage: result.usage, summary, passes: ["what did we miss"], failedPasses: [] };
}
