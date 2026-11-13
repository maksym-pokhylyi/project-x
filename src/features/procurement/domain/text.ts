/**
 * Keyword extraction from contract titles (PURE).
 *
 * Titles are short and formulaic ("Provision of Grounds Maintenance Services — Lot 2"),
 * so a stop list of procurement boilerplate does most of the work. We keep single words
 * and adjacent pairs; a term must be distinctive enough to help full-text matching.
 */
const STOP_WORDS = new Set(
  (
    "a an and are as at be by for from in into is it its of on or that the this to with without via per " +
    "provision provide providing supply supplies supplying supplied delivery deliver delivering purchase purchasing procurement procure " +
    "service services contract contracts contracting framework frameworks agreement agreements lot lots tender tenders tendering " +
    "award awards awarded direct call off calloff mini competition further itt rfq rfp pqq notice project projects programme program " +
    "council borough county city district london university college school schools nhs trust foundation authority department ministry " +
    "limited ltd plc llp new various including include includes related associated general requirement requirements required " +
    "works work year years month months phase stage part number ref reference no extension renewal replacement " +
    "support management managed solution solutions system systems unit units site sites area areas team teams " +
    "january february march april may june july august september october november december " +
    "north south east west northern southern eastern western central national regional local uk england wales scotland ireland british " +
    "one two three four five six seven eight nine ten first second third annual interim temporary short long term"
  ).split(/\s+/),
);

export function tokenise(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isContentWord(token: string): boolean {
  if (token.length < 3 || token.length > 30) return false;
  if (STOP_WORDS.has(token)) return false;
  if (/^\d+$/.test(token)) return false;
  // Reference numbers and codes: "rm6116", "c12345", "2026".
  if (/\d/.test(token) && !/^[a-z]+\d?$/.test(token)) return false;
  return true;
}

/** Distinct terms of one title: content words plus adjacent content-word pairs. */
export function termsOf(text: string | null | undefined): string[] {
  const tokens = tokenise(text);
  const out = new Set<string>();
  let previous: string | null = null;
  for (const token of tokens) {
    if (!isContentWord(token)) {
      previous = null;
      continue;
    }
    out.add(token);
    if (previous) out.add(`${previous} ${token}`);
    previous = token;
  }
  return [...out];
}

/**
 * Ranks terms over weighted documents. A pair outranks its parts when it occurs as often
 * (so "grounds maintenance" beats "maintenance"), and parts of a kept pair are dropped
 * unless they also occur on their own.
 */
export function topKeywords(documents: Array<{ text: string | null | undefined; weight: number }>, limit = 12): string[] {
  const score = new Map<string, number>();
  const count = new Map<string, number>();
  for (const document of documents) {
    for (const term of termsOf(document.text)) {
      score.set(term, (score.get(term) ?? 0) + document.weight);
      count.set(term, (count.get(term) ?? 0) + 1);
    }
  }
  const minCount = documents.length >= 4 ? 2 : 1;
  const candidates = [...score.entries()]
    .filter(([term]) => (count.get(term) ?? 0) >= minCount)
    .map(([term, value]) => ({ term, value: value * (term.includes(" ") ? 1.6 : 1), count: count.get(term) ?? 0 }))
    .sort((a, b) => b.value - a.value || (a.term < b.term ? -1 : 1));

  const kept: string[] = [];
  const covered = new Map<string, number>();
  for (const candidate of candidates) {
    if (kept.length >= limit) break;
    if (!candidate.term.includes(" ")) {
      // Skip a word that (almost) only occurs inside a pair we already kept.
      const inside = covered.get(candidate.term) ?? 0;
      if (inside > 0 && candidate.count <= inside) continue;
    }
    kept.push(candidate.term);
    if (candidate.term.includes(" ")) {
      for (const part of candidate.term.split(" ")) covered.set(part, Math.max(covered.get(part) ?? 0, candidate.count));
    }
  }
  return kept;
}

/** websearch_to_tsquery input: terms OR-ed together, pairs as phrases. */
export function keywordsToWebQuery(keywords: string[]): string | null {
  const parts = keywords
    .map((keyword) => tokenise(keyword).join(" "))
    .filter((keyword) => keyword.length >= 3)
    .slice(0, 16)
    .map((keyword) => (keyword.includes(" ") ? `"${keyword}"` : keyword));
  return parts.length > 0 ? parts.join(" or ") : null;
}
