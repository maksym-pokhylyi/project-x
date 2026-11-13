import { z } from "zod";
import { SUMMARY_FIELDS } from "@/features/bids/types";

/**
 * Shapes the model must return (snake_case, as written in the prompts). They follow the
 * schema measured in the bid-pack spike, split into three focused extractions plus the
 * second-pass patch. Parsing is forgiving about the unimportant (nulls, number formats,
 * unknown enum values fall back to a safe default) and strict about what matters: every
 * item is an object with the right fields, and citations are plain strings that are then
 * verified programmatically.
 */

const text = z.preprocess((value) => (typeof value === "number" || typeof value === "boolean" ? String(value) : value), z.string());

/** Nullable string: null, missing, "" and "null" all become null. */
const ns = z.preprocess((value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "n/a" ? null : trimmed;
  }
  return value;
}, z.string().nullable());

/** Nullable number: accepts 20, "20", "20%", "1,000". */
const nn = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const match = /-?\d[\d,]*(?:\.\d+)?/.exec(value);
    if (!match) return null;
    const parsed = Number(match[0].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}, z.number().nullable());

const nb = z.preprocess((value) => (typeof value === "boolean" ? value : value === "true" ? true : value === "false" ? false : null), z.boolean().nullable());

const list = <T extends z.ZodType>(item: T) => z.preprocess((value) => (Array.isArray(value) ? value : value === null || value === undefined ? [] : value), z.array(item));

const cite = { file: ns, loc: ns, quote: ns };

export const rawFactSchema = z.object({
  value: ns,
  normalized: ns,
  status: z.enum(["stated", "not_stated", "ambiguous", "conflicting"]).catch("stated"),
  note: ns,
  ...cite,
});
export type RawFact = z.infer<typeof rawFactSchema>;

export const NOT_STATED: RawFact = { value: null, normalized: null, status: "not_stated", note: null, file: null, loc: null, quote: null };

const optionalFact = z.preprocess((value) => (value === null || value === undefined ? NOT_STATED : value), rawFactSchema);

export const RAW_REQUIREMENT_CATEGORIES = [
  "insurance",
  "financial_standing",
  "accreditation_certification",
  "experience_references",
  "staff_qualifications",
  "mandatory_policy",
  "site_visit",
  "legal_declaration",
  "technical_mandatory",
  "submission_formality",
  "other",
] as const;

export const RAW_REQUIREMENT_KINDS = ["pass_fail", "mandatory_unscored", "minimum_score_threshold", "desirable", "information_only"] as const;

export const rawRequirementSchema = z.object({
  id: text.catch(""),
  category: z.enum(RAW_REQUIREMENT_CATEGORIES).catch("other"),
  requirement: text,
  threshold: ns,
  kind: z.enum(RAW_REQUIREMENT_KINDS).catch("mandatory_unscored"),
  evidence_to_provide: ns,
  ...cite,
});
export type RawRequirement = z.infer<typeof rawRequirementSchema>;

export const RAW_SCORED = ["scored_weighted", "scored_unweighted", "pass_fail", "information_only", "unclear"] as const;

export const rawQuestionSchema = z.object({
  id: text.catch(""),
  title: text.catch(""),
  text: text,
  sub_parts: list(text).catch([]),
  section: ns,
  guidance: ns,
  weight_percent: nn,
  max_score_points: nn,
  limit_text: ns,
  limit_words: nn,
  limit_pages: nn,
  attachments_allowed: ns,
  scored: z.enum(RAW_SCORED).catch("unclear"),
  ...cite,
});
export type RawQuestion = z.infer<typeof rawQuestionSchema>;

export const rawCriterionSchema = z.object({ name: text, weight_percent: nn, parent: ns, what_is_assessed: ns, ...cite });
export const rawScaleRowSchema = z.object({ score: text, label: ns, descriptor: ns, ...cite });
export const rawThresholdSchema = z.object({ description: text, ...cite });
export const rawKeyDateSchema = z.object({ event: text, date_iso: ns, time_24h: ns, ...cite });
export const rawDocumentSchema = z.object({ name: text, mandatory: nb, format_note: ns, ...cite });

export const RAW_RED_FLAG_TYPES = [
  "tupe",
  "liability_indemnity",
  "payment_terms",
  "timescale",
  "contradiction_in_documents",
  "funding_or_award_condition",
  "ip_ownership",
  "termination",
  "insurance_level",
  "pricing_risk",
  "eligibility_risk",
  "other",
] as const;

export const rawRedFlagSchema = z.object({
  type: z.enum(RAW_RED_FLAG_TYPES).catch("other"),
  description: text,
  severity: z.enum(["high", "medium", "low"]).catch("medium"),
  ...cite,
});
export const rawUnknownSchema = z.object({ item: text, why_it_matters: text.catch("") });

const summaryShape = Object.fromEntries(SUMMARY_FIELDS.map((field) => [field, optionalFact])) as { [K in (typeof SUMMARY_FIELDS)[number]]: typeof optionalFact };
export const rawSummarySchema = z.preprocess((value) => value ?? {}, z.object(summaryShape));
export type RawSummary = z.infer<typeof rawSummarySchema>;

export const rawEvaluationSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    price_weight_percent: nn,
    quality_weight_percent: nn,
    social_value_weight_percent: nn,
    weights_note: ns,
    criteria: list(rawCriterionSchema).catch([]),
    scoring_scale: list(rawScaleRowSchema).catch([]),
    minimum_thresholds: list(rawThresholdSchema).catch([]),
    price_scoring_method: optionalFact,
  }),
);
export type RawEvaluation = z.infer<typeof rawEvaluationSchema>;

// --- The three first-pass extractions ---------------------------------------------------

export const overviewOutputSchema = z.object({
  overview: ns,
  summary: rawSummarySchema,
  key_dates: list(rawKeyDateSchema).catch([]),
  evaluation: rawEvaluationSchema,
  documents_to_return: list(rawDocumentSchema).catch([]),
  red_flags: list(rawRedFlagSchema).catch([]),
  unknowns: list(rawUnknownSchema).catch([]),
});
export type OverviewOutput = z.infer<typeof overviewOutputSchema>;

export const requirementsOutputSchema = z.object({ requirements: list(rawRequirementSchema) });
export type RequirementsOutput = z.infer<typeof requirementsOutputSchema>;

export const questionsOutputSchema = z.object({ questions: list(rawQuestionSchema) });
export type QuestionsOutput = z.infer<typeof questionsOutputSchema>;

/** Second reading of the key facts (fields the task does not ask for come back as not_stated). */
export const keyFactsOutputSchema = z.object({ summary: rawSummarySchema, key_dates: list(rawKeyDateSchema).catch([]) });
export type KeyFactsOutput = z.infer<typeof keyFactsOutputSchema>;

/** Per-document reading: both lists from one document. */
export const documentOutputSchema = z.object({ requirements: list(rawRequirementSchema).catch([]), questions: list(rawQuestionSchema).catch([]) });
export type DocumentOutput = z.infer<typeof documentOutputSchema>;

/** Everything extracted from a pack, in the spike's brief shape (used for scoring too). */
export type RawBrief = OverviewOutput & RequirementsOutput & QuestionsOutput;

// --- Second pass: a patch over the draft ------------------------------------------------

export const patchOutputSchema = z.object({
  add_requirements: list(rawRequirementSchema).catch([]),
  add_questions: list(rawQuestionSchema).catch([]),
  add_criteria: list(rawCriterionSchema).catch([]),
  add_minimum_thresholds: list(rawThresholdSchema).catch([]),
  add_key_dates: list(rawKeyDateSchema).catch([]),
  add_documents_to_return: list(rawDocumentSchema).catch([]),
  add_red_flags: list(rawRedFlagSchema).catch([]),
  summary_corrections: list(
    z.object({
      field: z.enum(SUMMARY_FIELDS),
      problem: text.catch(""),
      corrected: rawFactSchema,
    }),
  ).catch([]),
  requirement_corrections: list(
    z.object({
      requirement_id: text,
      problem: text.catch(""),
      kind: z.enum(RAW_REQUIREMENT_KINDS).nullish().catch(null),
      threshold: ns,
      ...cite,
    }),
  ).catch([]),
  question_corrections: list(
    z.object({
      question_id: text,
      problem: text.catch(""),
      weight_percent: nn,
      max_score_points: nn,
      limit_text: ns,
      limit_words: nn,
      limit_pages: nn,
      ...cite,
    }),
  ).catch([]),
  removals: list(
    z.object({
      section: z.enum(["requirements", "questions", "criteria", "key_dates", "documents_to_return", "red_flags"]),
      id_or_name: text,
      reason: text.catch(""),
    }),
  ).catch([]),
});
export type PatchOutput = z.infer<typeof patchOutputSchema>;

// --- Company check ----------------------------------------------------------------------

export const companyCheckOutputSchema = z.object({
  results: list(
    z.object({
      id: text,
      status: z.enum(["met", "gap", "unknown"]).catch("unknown"),
      reason: text.catch(""),
      fact_used: ns,
    }),
  ),
});
export type CompanyCheckOutput = z.infer<typeof companyCheckOutputSchema>;
