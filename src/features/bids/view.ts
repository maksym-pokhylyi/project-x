import { effectiveWordLimit } from "@/features/bids/answer-text";
import { countWords } from "@/features/bids/constants";
import type { EditorQuestion } from "./components/answer-editor";
import type { QuestionItem } from "./components/questions-view";
import type { RequirementItem } from "./components/requirements-view";
import type { CompanyStatus, QuestionStatus, RequirementCategory, RequirementKind } from "./types";
import type { bidQuestions, bidRequirements } from "@/db/schema";

/** Database rows -> the plain objects the (client) components take. Type-only imports: client-safe. */

type RequirementRow = typeof bidRequirements.$inferSelect;
type QuestionRow = typeof bidQuestions.$inferSelect;

export function toRequirementItem(row: RequirementRow): RequirementItem {
  return {
    id: row.id,
    ref: row.ref,
    category: row.category as RequirementCategory,
    text: row.text,
    threshold: row.threshold,
    kind: row.kind as RequirementKind,
    isPassFail: row.isPassFail,
    evidenceToProvide: row.evidenceToProvide,
    citation: row.citation,
    companyStatus: row.companyStatus as CompanyStatus,
    companyNote: row.companyNote,
    note: row.note,
    checked: Boolean(row.checkedAt),
    provenance: row.provenance,
    source: row.source,
  };
}

export function toQuestionItem(row: QuestionRow): QuestionItem {
  return {
    id: row.id,
    ref: row.ref,
    title: row.title,
    text: row.text,
    section: row.section,
    weighting: row.weighting,
    maxScore: row.maxScore,
    wordLimit: row.wordLimit,
    pageLimit: row.pageLimit,
    limitText: row.limitText,
    guidance: row.guidance,
    citation: row.citation,
    status: row.status as QuestionStatus,
    wordCount: countWords(row.draftText ?? ""),
    gaps: row.draftMeta?.evidenceGaps.length ?? 0,
    score: row.evaluation?.score ?? null,
    maxEvaluated: row.evaluation?.maxScore ?? null,
    provenance: row.provenance,
    source: row.source,
  };
}

/**
 * Key for <AnswerEditor>: changes when the server holds a different text because of an AI
 * write or a restored version — the editor then remounts with the new text. Manual saves
 * do not change it, so typing is never interrupted.
 */
export function editorKey(row: QuestionRow): string {
  return `${row.id}:${row.draftMeta?.generatedAt ?? ""}:${row.draftMeta?.origin ?? ""}:${row.versions?.[0]?.id ?? ""}`;
}

export function toEditorQuestion(row: QuestionRow): EditorQuestion {
  const { limit, fromPages } = effectiveWordLimit(row);
  return {
    id: row.id,
    ref: row.ref,
    title: row.title,
    text: row.text,
    guidance: row.guidance,
    weighting: row.weighting,
    limitText: row.limitText,
    limit,
    limitFromPages: fromPages,
    citation: row.citation,
    status: row.status as QuestionStatus,
    draftText: row.draftText ?? "",
    draftMeta: row.draftMeta,
    evaluation: row.evaluation,
    versions: row.versions ?? [],
  };
}
