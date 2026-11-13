import { effectiveWordLimit } from "@/features/bids/answer-text";
import { countWords } from "@/features/bids/constants";
import type { EditorQuestion } from "./components/answer-editor";
import type { QuestionItem } from "./components/questions-view";
import type { RequirementItem } from "./components/requirements-view";
import type { CompanyStatus, PackStats, QuestionStatus, RequirementCategory, RequirementKind } from "./types";
import type { bidFiles, bidQuestions, bidRequirements } from "@/db/schema";

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
    statusByUser: row.companyStatusSource === "user",
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
    scored: row.source === "user" ? "unclear" : row.scored,
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

// --- Brief view-model helpers (pure, client-safe) -------------------------------------------

/**
 * A requirement that can stop a bid on its own: explicitly pass/fail, a minimum score, or a
 * mandatory insurance level, financial test or accreditation. Mirrors `isGating` in
 * server/pipeline/verdict.ts (kept here so client components need no server import).
 */
export function isGatingRequirement(item: { isPassFail: boolean; kind: string; category: string }): boolean {
  return item.isPassFail || item.kind === "minimum_score" || (item.kind === "mandatory" && ["insurance", "financial", "accreditation"].includes(item.category));
}

export type GateGroup = "gap" | "confirm" | "met";

/** The three groups the brief shows: gaps first, then what only the bidder can settle, then met. */
export function gateGroup(status: CompanyStatus): GateGroup {
  return status === "gap" ? "gap" : status === "met" ? "met" : "confirm";
}

/** "R7" -> "R-07": how a requirement reference is displayed. */
export function displayRef(ref: string): string {
  const match = /^R(\d+)$/.exec(ref.trim());
  return match ? `R-${match[1]!.padStart(2, "0")}` : ref;
}

/** Written answers that are marked (as opposed to forms, declarations and details to supply). */
export function isScoredQuestion(question: { scored: string; source?: string }): boolean {
  return question.scored !== "information_only" && question.scored !== "pass_fail";
}

type FileRow = typeof bidFiles.$inferSelect;

export type PackFileItem = {
  id: string;
  name: string;
  kind: string;
  /** "38 pp", "5 sheets", "3 sections" — or why it was not read. */
  size: string;
  read: boolean;
  analysed: boolean;
  note: string | null;
  transcribedPages: number;
  /** Items (requirements, questions, facts) whose source is this file; null before the check is ready. */
  items: number | null;
};

function unitsLabel(kind: string, pages: number | null): string {
  const count = pages ?? 0;
  if (kind === "pdf") return `${count} pp`;
  if (kind === "xlsx" || kind === "csv") return `${count} sheet${count === 1 ? "" : "s"}`;
  return `${count} section${count === 1 ? "" : "s"}`;
}

export function toPackFileItems(files: FileRow[], packStats: PackStats | null | undefined): PackFileItem[] {
  const itemsByName = new Map((packStats?.coverage?.files ?? []).map((file) => [file.name, file.items]));
  return files
    .filter((file) => file.kind !== "zip")
    .map((file) => {
      const read = file.extractionStatus === "done";
      return {
        id: file.id,
        name: file.name,
        kind: file.kind,
        size: read ? unitsLabel(file.kind, file.pages) : file.extractionStatus === "pending" || file.extractionStatus === "processing" ? "reading…" : "not read",
        read,
        analysed: read && file.includedInAnalysis,
        note: file.error,
        transcribedPages: file.transcribedPages,
        items: itemsByName.has(file.name) ? (itemsByName.get(file.name) ?? 0) : null,
      };
    });
}

export type CoverageSummary = {
  /** Files read / uploaded (ZIP containers excluded). */
  read: number;
  total: number;
  pages: number;
  /** "6 files, 214 pages read" — plus what was not read, when anything was not. */
  headline: string;
  notRead: string[];
  notAnalysed: string[];
  transcribedPages: number;
  failedPasses: string[];
  silentFiles: string[];
  citations: { total: number; verified: number } | null;
};

/** Honest coverage of a pack: what was read, what was skipped, how many quotes were found. */
export function coverageSummary(files: FileRow[], packStats: PackStats | null | undefined): CoverageSummary {
  const real = files.filter((file) => file.kind !== "zip");
  const readFiles = real.filter((file) => file.extractionStatus === "done");
  const pending = real.filter((file) => file.extractionStatus === "pending" || file.extractionStatus === "processing");
  const notRead = real.filter((file) => file.extractionStatus === "failed" || file.extractionStatus === "skipped").map((file) => file.name);
  const notAnalysed = readFiles.filter((file) => !file.includedInAnalysis).map((file) => file.name);
  const pages = readFiles.reduce((sum, file) => sum + (file.pages ?? 0), 0);
  const onlyPdf = readFiles.every((file) => file.kind === "pdf");
  const parts = [`${readFiles.length} file${readFiles.length === 1 ? "" : "s"}, ${pages} ${onlyPdf ? "pages" : "pages and sections"} read`];
  if (notRead.length + notAnalysed.length > 0) parts.push(`${notRead.length + notAnalysed.length} not read`);
  if (pending.length > 0) parts.push(`${pending.length} still to read`);
  return {
    read: readFiles.length,
    total: real.length,
    pages,
    headline: parts.join(" · "),
    notRead,
    notAnalysed,
    transcribedPages: readFiles.reduce((sum, file) => sum + file.transcribedPages, 0),
    failedPasses: packStats?.coverage?.failedPasses ?? [],
    silentFiles: packStats?.coverage?.silentFiles ?? [],
    citations: packStats && packStats.citations.total > 0 ? packStats.citations : null,
  };
}
