import { countWords } from "@/features/bids/constants";

/**
 * Pure, client-safe helpers for answer text: evidence markers `[E3]`, evidence gaps
 * `[EVIDENCE NEEDED: …]`, word limits. Everything a model says about its own answer
 * (word counts, which sources it used) is recomputed here instead of being trusted.
 */

/** Words per A4 side used to turn a page limit into a working word limit (our assumption, shown in the UI). */
export const WORDS_PER_PAGE = 450;

export const GAP_PATTERN = /\[\s*EVIDENCE[\s_-]*NEEDED\s*[:\-–—]?\s*([^\]]*)\]/gi;
export const MARKER_PATTERN = /\[(E\d{1,3})\]/g;

/** Rewrites every variant of the gap marker (`[EVIDENCE_NEEDED: x]`, `[Evidence needed - x]`) to the canonical form. */
export function normaliseGapMarkers(text: string): string {
  return text.replace(GAP_PATTERN, (_whole, what: string) => `[EVIDENCE NEEDED: ${what.trim() || "supporting evidence"}]`);
}

/** The evidence gaps in an answer, in order, without duplicates. */
export function findEvidenceGaps(text: string): string[] {
  const gaps: string[] = [];
  for (const match of text.matchAll(GAP_PATTERN)) {
    const what = (match[1] ?? "").trim() || "supporting evidence";
    if (!gaps.includes(what)) gaps.push(what);
  }
  return gaps;
}

/** Evidence markers used in an answer ("E1", "E4"), in order of first use. */
export function findEvidenceMarkers(text: string): string[] {
  const markers: string[] = [];
  for (const match of text.matchAll(MARKER_PATTERN)) if (!markers.includes(match[1]!)) markers.push(match[1]!);
  return markers;
}

/** Removes things models append that are not part of the answer. */
export function cleanModelAnswer(raw: string): string {
  let text = raw.trim();
  const fence = /^```[a-z]*\s*\n([\s\S]*?)\n```\s*$/i.exec(text);
  if (fence) text = fence[1]!.trim();
  text = text
    .split("\n")
    // A model's own word count is unreliable (the spike saw "889" on a 966-word answer): drop it.
    .filter((line) => !/^\s*[\[(*_]*\s*(total\s+)?word\s*count\s*[:=\-–]?\s*~?\s*\d[\d,]*\s*(words)?\s*[\])*_]*\s*$/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return normaliseGapMarkers(text);
}

/** The word limit to enforce: the stated word limit, else the page limit converted. */
export function effectiveWordLimit(question: { wordLimit: number | null; pageLimit: number | null }): { limit: number | null; fromPages: boolean } {
  if (question.wordLimit && question.wordLimit > 0) return { limit: question.wordLimit, fromPages: false };
  if (question.pageLimit && question.pageLimit > 0) return { limit: Math.round(question.pageLimit * WORDS_PER_PAGE), fromPages: true };
  return { limit: null, fromPages: false };
}

/**
 * Cuts an answer to at most `limit` words, ending at a sentence or paragraph boundary
 * where one exists in the last fifth of the allowance. Last resort after the model was
 * asked to shorten and still overran.
 */
export function trimToWordLimit(text: string, limit: number): string {
  if (countWords(text) <= limit) return text;
  const tokens = text.split(/(\s+)/); // words and the whitespace between them
  let words = 0;
  let cut = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token.trim() === "" || /^\[E\d+\]$/.test(token)) continue;
    words += 1;
    if (words > limit) break;
    cut = i + 1;
  }
  let kept = tokens.slice(0, cut).join("").trimEnd();
  const floor = Math.floor(kept.length * 0.8);
  const boundary = Math.max(kept.lastIndexOf(". "), kept.lastIndexOf(".\n"), kept.lastIndexOf("\n\n"));
  if (kept.endsWith(".") || kept.endsWith("]")) return kept;
  if (boundary >= floor) kept = kept.slice(0, boundary + 1).trimEnd();
  return kept;
}

export type WordLimitState = "none" | "ok" | "near" | "over";

/** Live word-count state for the editor: amber from 90% of the limit, danger over it. */
export function wordLimitState(words: number, limit: number | null): WordLimitState {
  if (!limit) return "none";
  if (words > limit) return "over";
  if (words >= limit * 0.9) return "near";
  return "ok";
}

/** Short stable hash of answer text (to tell whether an evaluation is for the current text). */
export function answerHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Figures (money, percentages, counts of 3+ digits, years) in a text, canonicalised. */
export function figuresIn(text: string): string[] {
  const figures = new Set<string>();
  for (const match of text.matchAll(/£\s?\d[\d,]*(?:\.\d+)?\s*(?:m|k|million|thousand|bn)?\b|\b\d[\d,]*(?:\.\d+)?\s?%|\b\d{3,}(?:,\d{3})*(?:\.\d+)?\b/gi)) {
    figures.add(match[0].toLowerCase().replace(/[\s,]/g, ""));
  }
  return [...figures];
}
