import type { SummaryField } from "@/features/bids/types";
import { normaliseText, thresholdMagnitudes, tightText, type RawCitation } from "./quote-verify";
import type { PatchOutput, RawFact, RawQuestion, RawRequirement } from "./schema";

/**
 * Merging the second "what did we miss" pass into the first-pass draft. Pure functions.
 *
 * The second pass returns a patch (additions, corrections, removals). This module decides
 * what of that patch to accept:
 *  - additions that duplicate something already in the draft are dropped;
 *  - corrections and removals must name an item that exists (by id), otherwise ignored;
 *  - nothing here trusts the patch's citations — the caller verifies them like any other.
 * Recall beats tidiness: when in doubt an addition is kept and a removal is refused later
 * (the caller only removes items whose own citation could not be verified).
 */

export type DraftRequirement = { id: string; category: string; requirement: string; threshold: string | null; kind: string; quote?: string | null };
export type DraftQuestion = { id: string; title: string; text?: string; weight_percent: number | null; quote?: string | null };

export type RecheckDraft = {
  requirements: DraftRequirement[];
  questions: DraftQuestion[];
  criteria: Array<{ name: string }>;
  key_dates: Array<{ event: string; date_iso: string | null }>;
  documents_to_return: Array<{ name: string }>;
  red_flags: Array<{ type: string; description: string }>;
  minimum_thresholds: Array<{ description: string }>;
};

export type PatchPlan = {
  addRequirements: RawRequirement[];
  addQuestions: RawQuestion[];
  requirementUpdates: Array<{ id: string; kind: RawRequirement["kind"] | null; threshold: string | null; cite: RawCitation | null; problem: string }>;
  questionUpdates: Array<{
    id: string;
    weight_percent: number | null;
    max_score_points: number | null;
    limit_text: string | null;
    limit_words: number | null;
    limit_pages: number | null;
    cite: RawCitation | null;
    problem: string;
  }>;
  /** Ids the patch asks to remove. The caller removes only unsupported, unedited items. */
  removeRequirementIds: Array<{ id: string; reason: string }>;
  removeQuestionIds: Array<{ id: string; reason: string }>;
  summaryCorrections: Array<{ field: SummaryField; corrected: RawFact; problem: string }>;
  addCriteria: PatchOutput["add_criteria"];
  addMinimumThresholds: PatchOutput["add_minimum_thresholds"];
  addKeyDates: PatchOutput["add_key_dates"];
  addDocuments: PatchOutput["add_documents_to_return"];
  addRedFlags: PatchOutput["add_red_flags"];
  removeCriteria: string[];
  removeKeyDates: string[];
  removeDocuments: string[];
  removeRedFlags: string[];
  /** What was ignored, for logging. */
  ignored: { duplicateRequirements: number; duplicateQuestions: number; unknownIds: number; duplicateOther: number };
};

const STOP_WORDS = new Set(
  (
    "the a an of to and or for in on be must shall should will is are with by at as that this their its it any all each have has hold holds held " +
    "bidder bidders supplier suppliers tenderer tenderers contractor contractors applicant company organisation " +
    "provide provides provided providing submit include confirm confirmation evidence details detail copy copies give show demonstrate " +
    "required requirement requirements least minimum than not less no from which where if when per " +
    // Number words are compared as figures (see magnitudeSet), not as wording.
    "one two three four five six seven eight nine ten twelve"
  ).split(" "),
);

/** Reduces plurals and common endings so "audits"/"audit" and "certificates"/"certificate" match. */
function stem(word: string): string {
  let out = word;
  if (out.length > 4 && out.endsWith("ies")) out = `${out.slice(0, -3)}y`;
  else if (out.length > 4 && out.endsWith("es") && !out.endsWith("ses")) out = out.slice(0, -1);
  else if (out.length > 3 && out.endsWith("s") && !out.endsWith("ss")) out = out.slice(0, -1);
  // "raised"/"raise", "submitted"/"submit", "providing"/"provide": compare on a crude stem.
  if (out.length > 5 && out.endsWith("ing")) out = out.slice(0, -3);
  else if (out.length > 4 && out.endsWith("ed")) out = out.slice(0, -2);
  if (out.length > 4 && out.endsWith("e")) out = out.slice(0, -1);
  return out.replace(/(.)\1$/, "$1");
}

function wordSet(text: string): Set<string> {
  return new Set(
    normaliseText(text)
      .split(/[^a-z]+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
      .map(stem),
  );
}

function overlap(left: Set<string>, right: Set<string>): number {
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared;
}

/** Jaccard similarity of the significant words of two texts (0–1). Numbers are compared separately. */
export function textSimilarity(a: string, b: string): number {
  const left = wordSet(a);
  const right = wordSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  const shared = overlap(left, right);
  return shared / (left.size + right.size - shared);
}

/** Share of the shorter text's significant words that the longer one contains (0–1). */
export function textContainment(a: string, b: string): number {
  const left = wordSet(a);
  const right = wordSet(b);
  const smaller = Math.min(left.size, right.size);
  if (smaller < 2) return 0;
  return overlap(left, right) / smaller;
}

/**
 * Things that make two similar-sounding requirements DIFFERENT requirements: the type of
 * insurance, a named standard or scheme, the kind of document. "Public liability £5m" and
 * "professional indemnity £5m" often share one sentence in the pack and must never merge.
 */
const DISCRIMINATORS: Array<[string, RegExp]> = [
  ["public_liability", /public\s+(and\s+products?\s+)?liability|third[-\s]party liability/],
  ["employers_liability", /employer'?s?'?\s+liability/],
  ["professional_indemnity", /professional\s+indemnity/],
  ["product_liability", /products?\s+liability/],
  ["cyber_insurance", /cyber\s+(liability|insurance)/],
  ["motor_insurance", /motor\s+(vehicle\s+)?insurance/],
  ["cyber_essentials_plus", /cyber\s+essentials\s+plus/],
  ["cyber_essentials", /cyber\s+essentials(?!\s+plus)/],
  ["chas", /\bchas\b/],
  ["constructionline", /constructionline/],
  ["safecontractor", /safe\s?contractor/],
  ["ssip", /\bssip\b/],
  ["dbs", /\bdbs\b|disclosure and barring/],
  ["ico", /\bico\b|information commissioner/],
  ["references", /\breferences?\b|\breferees?\b/],
  ["turnover", /turnover/],
  ["accounts", /\baccounts\b/],
  ["modern_slavery", /modern slavery/],
  ["carbon", /carbon reduction/],
  ["equality", /equalit|diversity/],
  ["health_safety", /health\s*(and|&)\s*safety|\bh&s\b/],
  ["safeguarding", /safeguarding/],
  ["environment", /environmental (policy|management)/],
  ["data_protection", /data protection|gdpr/],
  ["site_visit", /site (visit|meeting)/],
  ["tupe", /\btupe\b/],
];

export function discriminators(text: string): string[] {
  const source = normaliseText(text);
  const found = DISCRIMINATORS.filter(([, pattern]) => pattern.test(source)).map(([key]) => key);
  for (const match of source.matchAll(/\b(iso|bs|en|pas)\s?(en\s)?(iso\s)?(\d{3,5})/g)) found.push(`std_${match[4]}`);
  return [...new Set(found)].sort();
}

const SMALL_NUMBER_WORDS: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", twelve: "12" };

/** The figures a requirement states, so "two references in three years" equals "2 references in 3 years". */
function magnitudeSet(text: string): string {
  const figures = new Set(thresholdMagnitudes(text));
  // "any one claim", "each and every one", "one of the following" are not quantities.
  const words = normaliseText(text).replace(/\b(any|each|every)\s+one\b|\bone\s+(claim|occurrence|event|incident|of)\b/g, " ");
  for (const word of words.split(/[^a-z]+/)) {
    const mapped = SMALL_NUMBER_WORDS[word];
    if (mapped) figures.add(mapped);
  }
  return [...figures].sort().join("|");
}

/**
 * True when two requirement entries describe the same requirement.
 *  1. they must not differ in what they are about (insurance type, named standard, …);
 *  2. if both state figures, the figures must be the same;
 *  3. then: similar wording, or one wording contained in the other, or the same evidence quote.
 */
export function sameRequirement(a: Pick<DraftRequirement, "requirement" | "threshold" | "quote">, b: Pick<DraftRequirement, "requirement" | "threshold" | "quote">): boolean {
  const aboutA = discriminators(`${a.requirement} ${a.threshold ?? ""}`);
  const aboutB = discriminators(`${b.requirement} ${b.threshold ?? ""}`);
  if (aboutA.join("|") !== aboutB.join("|")) return false;
  const figuresA = magnitudeSet(`${a.threshold ?? ""} ${a.requirement}`);
  const figuresB = magnitudeSet(`${b.threshold ?? ""} ${b.requirement}`);
  if (figuresA && figuresB && figuresA !== figuresB) return false;

  const similarity = textSimilarity(a.requirement, b.requirement);
  if (similarity >= 0.6) return true;
  // Same subject (shared discriminators) and one wording inside the other.
  if (textContainment(a.requirement, b.requirement) >= 0.8 && (aboutA.length > 0 || similarity >= 0.4)) return true;
  // Same named subject and the same figures ("professional indemnity insurance of £1m" and
  // "professional indemnity cover of £1,000,000 is required"): wording may differ more.
  if (aboutA.length > 0 && figuresA && figuresA === figuresB && similarity >= 0.4) return true;
  const quoteA = tightText(a.quote ?? "");
  const quoteB = tightText(b.quote ?? "");
  // Same evidence sentence, same subject, same figures: one requirement worded twice.
  return quoteA.length >= 24 && quoteA === quoteB && similarity >= 0.25;
}

function normaliseId(id: string): string {
  return normaliseText(id).replace(/^(question|q|section|no\.?|number)\s*/i, "").replace(/[^a-z0-9]+/g, "");
}

/** True when two question entries are the same question. */
export function sameQuestion(a: Pick<DraftQuestion, "id" | "title" | "text" | "quote">, b: Pick<DraftQuestion, "id" | "title" | "text" | "quote">): boolean {
  const titleSimilarity = textSimilarity(`${a.title} ${a.text ?? ""}`, `${b.title} ${b.text ?? ""}`);
  const idA = normaliseId(a.id);
  const idB = normaliseId(b.id);
  if (idA && idA === idB && titleSimilarity >= 0.2) return true;
  // "3.3" and "H&S_3.3": one reference inside the other, and the wording overlaps.
  const nested = idA !== idB && /\d/.test(idA) && /\d/.test(idB) && (/[^\d]\d+$/.test(idA) || /[^\d]\d+$/.test(idB)) && (idA.endsWith(idB) || idB.endsWith(idA));
  if (nested && textContainment(`${a.title} ${a.text ?? ""}`, `${b.title} ${b.text ?? ""}`) >= 0.6) return true;
  if (textSimilarity(a.title, b.title) >= 0.8 && a.title.trim().length > 8) return true;
  // One title wholly inside the other ("Risk Assessments and Method Statements" and
  // "Health & Safety Q4 — Risk Assessments and Method Statements").
  if (wordSet(a.title).size >= 3 && wordSet(b.title).size >= 3 && textContainment(a.title, b.title) >= 0.99) return true;
  if (titleSimilarity >= 0.75) return true;
  const quoteA = tightText(a.quote ?? "");
  return quoteA.length >= 24 && quoteA === tightText(b.quote ?? "");
}

function hasCitation(item: RawCitation): RawCitation | null {
  return item.quote ? { file: item.file, loc: item.loc, quote: item.quote } : null;
}

/** Removes duplicates inside one list of extracted requirements, keeping the first of each. */
export function dedupeRequirements<T extends Pick<DraftRequirement, "requirement" | "threshold" | "quote">>(items: T[]): T[] {
  const kept: T[] = [];
  for (const item of items) if (!kept.some((existing) => sameRequirement(existing, item))) kept.push(item);
  return kept;
}

export function dedupeQuestions<T extends Pick<DraftQuestion, "id" | "title" | "text" | "quote">>(items: T[]): T[] {
  const kept: T[] = [];
  for (const item of items) if (!kept.some((existing) => sameQuestion(existing, item))) kept.push(item);
  return kept;
}

export function planPatch(draft: RecheckDraft, patch: PatchOutput): PatchPlan {
  const ignored = { duplicateRequirements: 0, duplicateQuestions: 0, unknownIds: 0, duplicateOther: 0 };

  const addRequirements: RawRequirement[] = [];
  for (const candidate of patch.add_requirements) {
    if (!candidate.requirement.trim()) continue;
    const duplicate = [...draft.requirements, ...addRequirements].some((existing) => sameRequirement(existing, candidate));
    if (duplicate) ignored.duplicateRequirements += 1;
    else addRequirements.push(candidate);
  }

  const addQuestions: RawQuestion[] = [];
  for (const candidate of patch.add_questions) {
    if (!candidate.text.trim() && !candidate.title.trim()) continue;
    const duplicate = [...draft.questions, ...addQuestions].some((existing) => sameQuestion(existing, candidate));
    if (duplicate) ignored.duplicateQuestions += 1;
    else addQuestions.push(candidate);
  }

  const findRequirement = (id: string) => draft.requirements.find((item) => normaliseId(item.id) === normaliseId(id));
  const findQuestions = (id: string) => draft.questions.filter((item) => normaliseId(item.id) === normaliseId(id));

  const requirementUpdates: PatchPlan["requirementUpdates"] = [];
  for (const correction of patch.requirement_corrections) {
    const target = findRequirement(correction.requirement_id);
    if (!target) {
      ignored.unknownIds += 1;
      continue;
    }
    const kind = correction.kind ?? null;
    if (kind === null && correction.threshold === null) continue;
    requirementUpdates.push({ id: target.id, kind, threshold: correction.threshold, cite: hasCitation(correction), problem: correction.problem });
  }

  const questionUpdates: PatchPlan["questionUpdates"] = [];
  for (const correction of patch.question_corrections) {
    const targets = findQuestions(correction.question_id);
    if (targets.length !== 1) {
      ignored.unknownIds += 1;
      continue;
    }
    const { weight_percent, max_score_points, limit_text, limit_words, limit_pages } = correction;
    if ([weight_percent, max_score_points, limit_text, limit_words, limit_pages].every((value) => value === null)) continue;
    questionUpdates.push({ id: targets[0]!.id, weight_percent, max_score_points, limit_text, limit_words, limit_pages, cite: hasCitation(correction), problem: correction.problem });
  }

  const removeRequirementIds: PatchPlan["removeRequirementIds"] = [];
  const removeQuestionIds: PatchPlan["removeQuestionIds"] = [];
  const removeCriteria: string[] = [];
  const removeKeyDates: string[] = [];
  const removeDocuments: string[] = [];
  const removeRedFlags: string[] = [];
  for (const removal of patch.removals) {
    const key = normaliseText(removal.id_or_name);
    if (!key) continue;
    if (removal.section === "requirements") {
      const target = findRequirement(removal.id_or_name);
      if (target) removeRequirementIds.push({ id: target.id, reason: removal.reason });
      else ignored.unknownIds += 1;
    } else if (removal.section === "questions") {
      const targets = findQuestions(removal.id_or_name);
      if (targets.length === 1) removeQuestionIds.push({ id: targets[0]!.id, reason: removal.reason });
      else ignored.unknownIds += 1;
    } else if (removal.section === "criteria") {
      if (draft.criteria.some((item) => normaliseText(item.name) === key)) removeCriteria.push(key);
    } else if (removal.section === "key_dates") {
      if (draft.key_dates.some((item) => normaliseText(item.event) === key)) removeKeyDates.push(key);
    } else if (removal.section === "documents_to_return") {
      if (draft.documents_to_return.some((item) => normaliseText(item.name) === key)) removeDocuments.push(key);
    } else if (removal.section === "red_flags") {
      if (draft.red_flags.some((item) => normaliseText(item.description) === key)) removeRedFlags.push(key);
    }
  }

  const fresh = <T>(candidates: T[], existing: string[], label: (item: T) => string): T[] => {
    const seen = existing.map((value) => normaliseText(value));
    const out: T[] = [];
    for (const candidate of candidates) {
      const name = normaliseText(label(candidate));
      if (!name) continue;
      if (seen.some((value) => value === name || textSimilarity(value, name) >= 0.8)) {
        ignored.duplicateOther += 1;
        continue;
      }
      seen.push(name);
      out.push(candidate);
    }
    return out;
  };

  // The same field corrected twice: the last correction wins.
  const summaryByField = new Map<SummaryField, PatchPlan["summaryCorrections"][number]>();
  for (const correction of patch.summary_corrections) {
    summaryByField.set(correction.field, { field: correction.field, corrected: correction.corrected, problem: correction.problem });
  }

  return {
    addRequirements,
    addQuestions,
    requirementUpdates,
    questionUpdates,
    removeRequirementIds,
    removeQuestionIds,
    summaryCorrections: [...summaryByField.values()],
    addCriteria: fresh(patch.add_criteria, draft.criteria.map((item) => item.name), (item) => item.name),
    addMinimumThresholds: fresh(patch.add_minimum_thresholds, draft.minimum_thresholds.map((item) => item.description), (item) => item.description),
    addKeyDates: fresh(
      patch.add_key_dates,
      draft.key_dates.map((item) => `${item.event} ${item.date_iso ?? ""}`),
      (item) => `${item.event} ${item.date_iso ?? ""}`,
    ),
    addDocuments: fresh(patch.add_documents_to_return, draft.documents_to_return.map((item) => item.name), (item) => item.name),
    addRedFlags: fresh(patch.add_red_flags, draft.red_flags.map((item) => item.description), (item) => item.description),
    removeCriteria,
    removeKeyDates,
    removeDocuments,
    removeRedFlags,
    ignored,
  };
}
