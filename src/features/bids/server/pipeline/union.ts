import type { BriefFact, Provenance } from "@/features/bids/types";
import { sameQuestion, sameRequirement } from "./merge";
import { normaliseText, thresholdMagnitudes } from "./quote-verify";
import type { QuestionDraft, RequirementDraft } from "./transform";

/**
 * Deterministic union of extraction passes. Pure functions.
 *
 * Several passes read the same pack (two different models over the whole pack, per-document
 * passes, the "what did we miss" pass). Their results are merged HERE, in code — the spike
 * measured that letting a model merge loses items (pass/fail recall 60% -> 37%). Rules:
 *  - an item found by any pass is kept (recall first);
 *  - the same item found twice is one row that remembers every pass that found it;
 *  - where passes disagree on a detail, the verified reading wins and the difference is
 *    recorded so the UI can say "readings differ — check";
 *  - rows a person edited are never changed by a later pass.
 */

export type PassId = "primary" | "second" | "document" | "recheck";

/** What kind of document a per-document pass read. */
export type DocumentClass = "clarifications" | "questionnaire" | "response_template" | "pricing";

const QUESTION_LIKE = /^(briefly\s+)?(please\s+)?(describe|explain|outline|set out|detail how|tell us|state how|identify any|list any)\b/i;
const QUALIFICATION_CATEGORIES = ["insurance", "financial", "accreditation", "experience"];

/**
 * Keeps the compliance matrix a list of hurdles. On a real council pack the readings
 * returned 98 "requirements", half of them questions restated as requirements, pricing
 * form instructions and evaluation criteria — a list nobody reads. Dropped here, in code:
 *  - questions to answer ("Describe how you will…"): they belong on the Questions tab;
 *  - "desirable" / "for information" items, unless they are about what the bidder holds
 *    (insurance, finance, accreditations, experience);
 *  - everything a response template or pricing form "requires" (those are forms to fill).
 * Pass/fail items are never dropped by these rules.
 */
export function keepRequirement(draft: Pick<RequirementDraft, "text" | "kind" | "category" | "isPassFail">, context: { pass: PassId; documentClass?: DocumentClass | null }): boolean {
  if (draft.isPassFail) return true;
  if (QUESTION_LIKE.test(draft.text.trim())) return false;
  const soft = draft.kind === "desirable" || draft.kind === "information";
  if (soft && !QUALIFICATION_CATEGORIES.includes(draft.category)) return false;
  if (context.pass === "document") {
    if (context.documentClass === "response_template" || context.documentClass === "pricing") return false;
    if (soft) return false;
  }
  return true;
}

export type ExistingRequirement = {
  id: string;
  text: string;
  threshold: string | null;
  kind: string;
  isPassFail: boolean;
  citation: RequirementDraft["citation"];
  evidenceToProvide: string | null;
  provenance: Provenance | null;
  locked: boolean;
};

export type RequirementMerge = {
  inserts: Array<RequirementDraft & { provenance: Provenance }>;
  updates: Array<{ id: string; patch: Partial<RequirementDraft> & { provenance: Provenance } }>;
};

function addPass(provenance: Provenance | null, pass: PassId, note?: string | null): Provenance {
  const passes = provenance?.passes ?? [];
  const notes = [...(provenance?.notes ?? [])];
  if (note && !notes.includes(note)) notes.push(note);
  return { passes: passes.includes(pass) ? passes : [...passes, pass], ...(notes.length > 0 ? { notes } : {}) };
}

/** Plans how the requirements of one pass join what is already there. */
export function mergeRequirementPass(existing: ExistingRequirement[], incoming: RequirementDraft[], pass: PassId): RequirementMerge {
  const inserts: RequirementMerge["inserts"] = [];
  const updates = new Map<string, RequirementMerge["updates"][number]>();
  const known = existing.map((row) => ({ ...row }));

  for (const draft of incoming) {
    const candidate = { requirement: draft.text, threshold: draft.threshold, quote: draft.citation?.quote ?? null };
    const duplicateInBatch = inserts.find((item) => sameRequirement({ requirement: item.text, threshold: item.threshold, quote: item.citation?.quote ?? null }, candidate));
    if (duplicateInBatch) continue;
    const match = known.find((row) => sameRequirement({ requirement: row.text, threshold: row.threshold, quote: row.citation?.quote ?? null }, candidate));
    if (!match) {
      inserts.push({ ...draft, provenance: { passes: [pass] } });
      continue;
    }
    const patch: RequirementMerge["updates"][number]["patch"] = { provenance: addPass(match.provenance, pass) };
    if (!match.locked) {
      // A verified quote beats an unverified one.
      if (!match.citation?.verified && draft.citation?.verified) {
        patch.citation = draft.citation;
        match.citation = draft.citation;
      }
      if (!match.threshold && draft.threshold) {
        patch.threshold = draft.threshold;
        match.threshold = draft.threshold;
      }
      if (!match.evidenceToProvide && draft.evidenceToProvide) patch.evidenceToProvide = draft.evidenceToProvide;
      if (draft.isPassFail !== match.isPassFail) {
        // Passes disagree on whether this is pass/fail: show it as pass/fail (the safe
        // reading for a bidder) and say that the readings differ.
        patch.provenance = addPass(patch.provenance, pass, "One reading marks this pass/fail, another only mandatory — check the wording.");
        if (draft.isPassFail) {
          patch.kind = "pass_fail";
          patch.isPassFail = true;
          match.isPassFail = true;
        }
      }
    }
    match.provenance = patch.provenance;
    const previous = updates.get(match.id);
    updates.set(match.id, { id: match.id, patch: { ...previous?.patch, ...patch } });
  }
  return { inserts, updates: [...updates.values()] };
}

export type ExistingQuestion = {
  id: string;
  ref: string;
  title: string | null;
  text: string;
  weighting: number | null;
  maxScore: number | null;
  wordLimit: number | null;
  pageLimit: number | null;
  limitText: string | null;
  guidance: string | null;
  section: string | null;
  citation: QuestionDraft["citation"];
  provenance: Provenance | null;
  locked: boolean;
};

export type QuestionMerge = {
  inserts: Array<QuestionDraft & { provenance: Provenance }>;
  updates: Array<{ id: string; patch: Partial<QuestionDraft> & { provenance: Provenance } }>;
};

const differs = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) > 0.001;

/** Plans how the questions of one pass join what is already there. */
export function mergeQuestionPass(existing: ExistingQuestion[], incoming: QuestionDraft[], pass: PassId): QuestionMerge {
  const inserts: QuestionMerge["inserts"] = [];
  const updates = new Map<string, QuestionMerge["updates"][number]>();
  const known = existing.map((row) => ({ ...row }));
  const shape = (item: { ref: string; title: string | null; text: string; citation: QuestionDraft["citation"] }) => ({ id: item.ref, title: item.title ?? "", text: item.text, quote: item.citation?.quote ?? null });

  for (const draft of incoming) {
    if (inserts.some((item) => sameQuestion(shape(item), shape(draft)))) continue;
    const match = known.find((row) => sameQuestion(shape(row), shape(draft)));
    if (!match) {
      inserts.push({ ...draft, provenance: { passes: [pass] } });
      continue;
    }
    let provenance = addPass(match.provenance, pass);
    const patch: Partial<QuestionDraft> = {};
    if (!match.locked) {
      if (!match.citation?.verified && draft.citation?.verified) patch.citation = draft.citation;
      const fill = <K extends "weighting" | "maxScore" | "wordLimit" | "pageLimit">(key: K, label: string) => {
        if (match[key] === null && draft[key] !== null) {
          patch[key] = draft[key];
          match[key] = draft[key];
        } else if (differs(match[key], draft[key])) {
          provenance = addPass(provenance, pass, `Readings differ on the ${label}: ${match[key]} and ${draft[key]} — check the documents.`);
        }
      };
      fill("weighting", "weighting");
      fill("maxScore", "maximum score");
      fill("wordLimit", "word limit");
      fill("pageLimit", "page limit");
      if (!match.limitText && draft.limitText) patch.limitText = draft.limitText;
      if (!match.guidance && draft.guidance) patch.guidance = draft.guidance;
      if (!match.section && draft.section) patch.section = draft.section;
      if (!match.ref && draft.ref) patch.ref = draft.ref;
    }
    match.provenance = provenance;
    const previous = updates.get(match.id);
    updates.set(match.id, { id: match.id, patch: { ...previous?.patch, ...patch, provenance } });
  }
  return { inserts, updates: [...updates.values()] };
}

// --- Key facts: two readings ------------------------------------------------------------

function comparable(fact: BriefFact): string | null {
  if (fact.status === "not_stated") return null;
  const normalized = (fact.normalized ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.slice(0, 16).replace(" ", "T");
  const magnitudes = thresholdMagnitudes(`${fact.normalized ?? ""} ${fact.value ?? ""}`).filter((value) => Number(value) >= 100);
  if (magnitudes.length > 0) return [...new Set(magnitudes)].sort().join("|");
  const contact = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|https?:\/\/[^\s"')]+/i.exec(`${fact.value ?? ""} ${fact.normalized ?? ""}`);
  return contact ? normaliseText(contact[0]) : null;
}

/** Date-only vs date+time of the same day is not a disagreement about the day. */
function sameReading(a: string, b: string): boolean {
  if (a === b) return true;
  const dateA = /^\d{4}-\d{2}-\d{2}/.exec(a)?.[0];
  const dateB = /^\d{4}-\d{2}-\d{2}/.exec(b)?.[0];
  if (dateA && dateB) return dateA === dateB && (a.length === 10 || b.length === 10);
  return false;
}

/**
 * Reconciles two independent readings of one key fact.
 *  - agree            -> the first reading (the verified one if only one is verified)
 *  - only one stated  -> that reading; if only the second found it, the note says so
 *  - disagree         -> status "conflicting", both readings kept with their citations
 */
export function reconcileFact(primary: BriefFact, second: BriefFact | null | undefined): BriefFact {
  if (!second || second.status === "not_stated") return primary;
  if (primary.status === "not_stated") {
    if (!second.citation?.verified) return primary; // an unverified second opinion is not enough to assert a fact
    return { ...second, note: second.note ?? "Found by the second reading of the pack only — check it." };
  }
  const a = comparable(primary);
  const b = comparable(second);
  if (a === null || b === null) return primary; // free text: nothing mechanical to compare
  if (sameReading(a, b)) {
    // Same day; prefer the reading that carries a time and a verified quote.
    const richer = b.length > a.length && second.citation?.verified ? second : primary;
    if (!primary.citation?.verified && second.citation?.verified) return { ...second, note: second.note ?? primary.note };
    return richer === second ? { ...second, note: second.note ?? primary.note } : primary;
  }
  const lead = !primary.citation?.verified && second.citation?.verified ? second : primary;
  const other = lead === primary ? second : primary;
  return {
    ...lead,
    status: "conflicting",
    note: `Two readings of the pack disagree: “${lead.value ?? lead.normalized}” and “${other.value ?? other.normalized}”. Check the documents.`,
    alternatives: [{ value: other.value, normalized: other.normalized, citation: other.citation }],
  };
}
