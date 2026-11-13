import {
  SUMMARY_FIELDS,
  type BidBrief,
  type BidKeyDate,
  type BriefFact,
  type Citation,
  type EvaluationModel,
  type RequirementCategory,
  type RequirementKind,
  type SummaryField,
} from "@/features/bids/types";
import { thresholdGrounded, verifyCitation, type PackIndex, type RawCitation } from "./quote-verify";
import type { OverviewOutput, RawFact, RawQuestion, RawRequirement } from "./schema";

/**
 * Turns validated model output into the shapes we store — and attaches a programmatically
 * verified citation to every item on the way. Pure functions.
 */

const CATEGORY_MAP: Record<RawRequirement["category"], RequirementCategory> = {
  insurance: "insurance",
  financial_standing: "financial",
  accreditation_certification: "accreditation",
  experience_references: "experience",
  staff_qualifications: "experience",
  mandatory_policy: "policy",
  site_visit: "submission",
  legal_declaration: "legal",
  technical_mandatory: "technical",
  submission_formality: "submission",
  other: "other",
};

const KIND_MAP: Record<RawRequirement["kind"], RequirementKind> = {
  pass_fail: "pass_fail",
  mandatory_unscored: "mandatory",
  minimum_score_threshold: "minimum_score",
  desirable: "desirable",
  information_only: "information",
};

export const KIND_TO_RAW: Record<RequirementKind, RawRequirement["kind"]> = {
  pass_fail: "pass_fail",
  mandatory: "mandatory_unscored",
  minimum_score: "minimum_score_threshold",
  desirable: "desirable",
  information: "information_only",
};

export function cite(index: PackIndex, raw: RawCitation): Citation | null {
  if (!raw.quote && !raw.file) return null;
  return verifyCitation(index, raw);
}

export type RequirementDraft = {
  category: RequirementCategory;
  text: string;
  threshold: string | null;
  kind: RequirementKind;
  isPassFail: boolean;
  evidenceToProvide: string | null;
  citation: Citation | null;
};

export function toRequirement(index: PackIndex, raw: RawRequirement): RequirementDraft {
  let citation = cite(index, raw);
  if (citation?.verified && !thresholdGrounded(index, citation, raw.threshold)) {
    // The quote exists but the stated level is not in the source: a person must check it.
    citation = { ...citation, verified: false, issue: "figure_not_in_source" };
  }
  const kind = KIND_MAP[raw.kind];
  return {
    category: CATEGORY_MAP[raw.category],
    text: raw.requirement.trim(),
    threshold: raw.threshold,
    kind,
    isPassFail: kind === "pass_fail",
    evidenceToProvide: raw.evidence_to_provide,
    citation,
  };
}

export type QuestionDraft = {
  ref: string;
  title: string | null;
  text: string;
  section: string | null;
  weighting: number | null;
  maxScore: number | null;
  wordLimit: number | null;
  pageLimit: number | null;
  limitText: string | null;
  guidance: string | null;
  scored: RawQuestion["scored"];
  citation: Citation | null;
};

function withSubParts(text: string, subParts: string[]): string {
  const parts = subParts.map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return text.trim();
  const lower = text.toLowerCase();
  const missing = parts.filter((part) => !lower.includes(part.toLowerCase().slice(0, 40)));
  if (missing.length === 0) return text.trim();
  return `${text.trim()}\n\nSub-parts:\n${parts.map((part) => `- ${part}`).join("\n")}`;
}

function positiveInt(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 && value < 1_000_000 ? Math.round(value) : null;
}

export function toQuestion(index: PackIndex, raw: RawQuestion): QuestionDraft {
  const weighting = raw.weight_percent !== null && raw.weight_percent >= 0 && raw.weight_percent <= 100 ? raw.weight_percent : null;
  return {
    ref: raw.id.trim().slice(0, 40),
    title: raw.title.trim() || null,
    text: withSubParts(raw.text, raw.sub_parts),
    section: raw.section,
    weighting,
    maxScore: raw.max_score_points !== null && raw.max_score_points >= 0 ? raw.max_score_points : null,
    wordLimit: positiveInt(raw.limit_words),
    pageLimit: raw.limit_pages !== null && raw.limit_pages > 0 && raw.limit_pages < 1000 ? raw.limit_pages : null,
    limitText: raw.limit_text,
    guidance: raw.guidance,
    scored: raw.scored,
    citation: cite(index, raw),
  };
}

export function toFact(index: PackIndex, raw: RawFact): BriefFact {
  const hasValue = Boolean(raw.value ?? raw.normalized);
  if (!hasValue || raw.status === "not_stated") {
    return { value: null, normalized: null, status: "not_stated", note: raw.note, citation: null };
  }
  return { value: raw.value ?? raw.normalized, normalized: raw.normalized, status: raw.status, note: raw.note, citation: cite(index, raw) };
}

export function toBrief(index: PackIndex, raw: OverviewOutput, now: Date = new Date()): { brief: BidBrief; evaluationModel: EvaluationModel; keyDates: BidKeyDate[] } {
  const summary = Object.fromEntries(SUMMARY_FIELDS.map((field) => [field, toFact(index, raw.summary[field])])) as Record<SummaryField, BriefFact>;
  const brief: BidBrief = {
    overview: raw.overview,
    summary,
    documentsToReturn: raw.documents_to_return.map((item) => ({ name: item.name, mandatory: item.mandatory, formatNote: item.format_note, citation: cite(index, item) })),
    redFlags: raw.red_flags.map((item) => ({ type: item.type, description: item.description, severity: item.severity, citation: cite(index, item) })),
    unknowns: raw.unknowns.map((item) => ({ item: item.item, whyItMatters: item.why_it_matters })),
    generatedAt: now.toISOString(),
  };
  const evaluation = raw.evaluation;
  const percent = (value: number | null) => (value !== null && value >= 0 && value <= 100 ? value : null);
  const evaluationModel: EvaluationModel = {
    priceWeight: percent(evaluation.price_weight_percent),
    qualityWeight: percent(evaluation.quality_weight_percent),
    socialValueWeight: percent(evaluation.social_value_weight_percent),
    weightsNote: evaluation.weights_note,
    criteria: evaluation.criteria.map((item) => ({
      name: item.name,
      weight: percent(item.weight_percent),
      parent: item.parent,
      whatIsAssessed: item.what_is_assessed,
      citation: cite(index, item),
    })),
    scoringScale: evaluation.scoring_scale.map((item) => ({ score: item.score, label: item.label, descriptor: item.descriptor, citation: cite(index, item) })),
    minimumThresholds: evaluation.minimum_thresholds.map((item) => ({ description: item.description, citation: cite(index, item) })),
    priceScoringMethod: toFact(index, evaluation.price_scoring_method),
  };
  const keyDates = raw.key_dates.map((item) => toKeyDate(index, item)).sort(compareKeyDates);
  return { brief, evaluationModel, keyDates };
}

export function toKeyDate(index: PackIndex, item: OverviewOutput["key_dates"][number]): BidKeyDate {
  const dateIso = item.date_iso && /^\d{4}-\d{2}-\d{2}/.test(item.date_iso) ? item.date_iso.slice(0, 10) : null;
  const time = item.time_24h && /^\d{1,2}:\d{2}/.test(item.time_24h) ? item.time_24h.slice(0, 5).padStart(5, "0") : null;
  return { event: item.event, dateIso, time, citation: cite(index, item) };
}

export function compareKeyDates(a: BidKeyDate, b: BidKeyDate): number {
  const left = `${a.dateIso ?? "9999-99-99"}T${a.time ?? "00:00"}`;
  const right = `${b.dateIso ?? "9999-99-99"}T${b.time ?? "00:00"}`;
  return left.localeCompare(right);
}

/** Offset of Europe/London from UTC, in minutes, at a given UTC instant (0 = GMT, 60 = BST). */
function londonOffsetMinutes(utc: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utc);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - utc.getTime()) / 60_000);
}

/**
 * Parses "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" written in UK local time. A date without a
 * time means the end of that day (23:59), so a deadline is never shown as passed early.
 */
export function parseUkLocal(normalized: string | null | undefined): Date | null {
  if (!normalized) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(normalized.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const hour = match[4] !== undefined ? Number(match[4]) : 23;
  const minute = match[5] !== undefined ? Number(match[5]) : 59;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || year < 2000 || year > 2100) return null;
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const offset = londonOffsetMinutes(new Date(naive));
  const result = new Date(naive - offset * 60_000);
  return Number.isNaN(result.getTime()) ? null : result;
}
