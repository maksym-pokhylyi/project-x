import { pageFromLoc } from "@/features/bids/locations";
import type { Citation, CitationMatch } from "@/features/bids/types";
import type { TextUnit } from "../extract/types";

/**
 * Programmatic citation check.
 *
 * The model must support every extracted item with a verbatim quote and the file + location
 * it copied it from. Nothing the model says about its own citation is trusted: this module
 * looks the quote up in the text we extracted ourselves and only then marks it `verified`.
 *
 *   exact           quote is at the cited location (whitespace/punctuation-insensitive)
 *   relocated       quote exists, on another page of the same file  -> location corrected
 *   relocated_file  quote exists, in another file of the pack       -> file + location corrected
 *   fuzzy           most of the quote is at one location and every number in it is there too
 *   not_found       -> "Verify in documents"
 */

export type PackFile = { id: string; name: string; units: TextUnit[] };

type IndexedUnit = { fileId: string; fileName: string; loc: string; norm: string; tight: string; numbers: Set<string> };

export type PackIndex = {
  files: Array<{ id: string; name: string; units: IndexedUnit[]; tight: string }>;
  units: IndexedUnit[];
  tight: string;
};

/** Case-, whitespace- and typography-insensitive form that keeps word boundaries. */
export function normaliseText(text: string): string {
  return (text ?? "")
    .normalize("NFKC")
    .replace(/­/g, "")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/[•●▪‣]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Only letters, digits and £ % @: immune to line-break hyphenation, bullets and table pipes. */
export function tightText(text: string): string {
  return normaliseText(text).replace(/[^a-z0-9£%@]+/g, "");
}

const NUMBER_WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  fifteen: "15",
  twenty: "20",
  thirty: "30",
  sixty: "60",
  ninety: "90",
};

function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value * 1000) / 1000);
}

/**
 * Every quantity in a text in canonical form, so "£5m", "£5 million" and "£5,000,000" all
 * yield "5000000" (and also the bare "5"). Small number words count ("two" -> "2").
 */
export function numberTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  const source = normaliseText(text);
  const pattern = /(\d[\d,]*(?:\.\d+)?)(?:\s*(million|billion|thousand|m|bn|k)(?![a-z]))?/g;
  for (const match of source.matchAll(pattern)) {
    const raw = match[1]!.replace(/,/g, "");
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    tokens.add(canonicalNumber(value));
    const unit = match[2];
    const multiplier = unit === "million" || unit === "m" ? 1e6 : unit === "billion" || unit === "bn" ? 1e9 : unit === "thousand" || unit === "k" ? 1e3 : null;
    if (multiplier) tokens.add(canonicalNumber(value * multiplier));
  }
  for (const word of source.split(/[^a-z]+/)) {
    const mapped = NUMBER_WORDS[word];
    if (mapped) tokens.add(mapped);
  }
  tokens.delete("");
  return tokens;
}

/**
 * The magnitudes a threshold states ("£5,000,000" -> 5000000; "£5m" -> 5000000), i.e. for
 * each number only its largest reading. Used to check a figure is grounded in the source.
 */
export function thresholdMagnitudes(text: string): string[] {
  const out: string[] = [];
  const source = normaliseText(text);
  const pattern = /(\d[\d,]*(?:\.\d+)?)(?:\s*(million|billion|thousand|m|bn|k)(?![a-z]))?/g;
  for (const match of source.matchAll(pattern)) {
    const value = Number(match[1]!.replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    const unit = match[2];
    const multiplier = unit === "million" || unit === "m" ? 1e6 : unit === "billion" || unit === "bn" ? 1e9 : unit === "thousand" || unit === "k" ? 1e3 : 1;
    out.push(canonicalNumber(value * multiplier));
  }
  return out;
}

export function buildPackIndex(files: PackFile[]): PackIndex {
  const indexedFiles = files.map((file) => {
    const units = file.units.map((unit) => ({
      fileId: file.id,
      fileName: file.name,
      loc: unit.loc,
      norm: normaliseText(unit.text),
      tight: tightText(unit.text),
      numbers: numberTokens(unit.text),
    }));
    return { id: file.id, name: file.name, units, tight: units.map((unit) => unit.tight).join("") };
  });
  return {
    files: indexedFiles,
    units: indexedFiles.flatMap((file) => file.units),
    tight: indexedFiles.map((file) => file.tight).join(""),
  };
}

function baseName(name: string): string {
  return name.split("/").pop() ?? name;
}

/** Finds the pack file a model-written file name refers to (exact, then forgiving). */
export function resolveFile(index: PackIndex, name: string | null | undefined): PackIndex["files"][number] | null {
  if (!name) return null;
  const wanted = name.trim();
  const exact = index.files.find((file) => file.name === wanted);
  if (exact) return exact;
  const lower = normaliseText(wanted);
  const insensitive = index.files.filter((file) => normaliseText(file.name) === lower || normaliseText(baseName(file.name)) === lower);
  if (insensitive.length === 1) return insensitive[0]!;
  const tightWanted = tightText(wanted.replace(/\.[a-z0-9]{2,5}$/i, ""));
  if (tightWanted.length < 4) return null;
  const loose = index.files.filter((file) => {
    const tightName = tightText(file.name.replace(/\.[a-z0-9]{2,5}$/i, ""));
    return tightName.includes(tightWanted) || tightWanted.includes(tightName);
  });
  return loose.length === 1 ? loose[0]! : null;
}

/** Quote parts between ellipses ("…", "...", "[...]") that are long enough to look up. */
function quoteParts(quote: string): string[] {
  const parts = quote
    .split(/\s*(?:\[\s*(?:\.\.\.|…)\s*\]|\.\.\.|…)\s*/)
    .map((part) => tightText(part))
    .filter((part) => part.length >= 8);
  return parts.length > 0 ? parts : [tightText(quote)].filter(Boolean);
}

function shingles(quote: string, size = 5): string[] {
  const words = normaliseText(quote).split(" ").filter(Boolean);
  if (words.length < size) return [];
  const out: string[] = [];
  for (let i = 0; i + size <= words.length; i += 1) {
    const shingle = tightText(words.slice(i, i + size).join(" "));
    if (shingle.length >= 10) out.push(shingle);
  }
  return out;
}

function shingleShare(parts: string[], haystack: string): number {
  if (parts.length === 0) return 0;
  let hits = 0;
  for (const part of parts) if (haystack.includes(part)) hits += 1;
  return hits / parts.length;
}

function numbersGrounded(quote: string, unit: IndexedUnit): boolean {
  for (const magnitude of thresholdMagnitudes(quote)) {
    if (!unit.numbers.has(magnitude)) return false;
  }
  return true;
}

/** Quotes shorter than this are too easy to "find" somewhere else, so they are never relocated. */
const MIN_RELOCATABLE_CHARS = 20;
const FUZZY_AT_LOC = 0.7;
const FUZZY_ELSEWHERE = 0.85;

export type RawCitation = { file: string | null | undefined; loc: string | null | undefined; quote: string | null | undefined };

function build(match: CitationMatch, raw: RawCitation, unit: IndexedUnit | null, fileFallback: PackIndex["files"][number] | null): Citation {
  const loc = unit?.loc ?? (raw.loc ?? "").trim();
  return {
    fileId: unit?.fileId ?? fileFallback?.id ?? null,
    fileName: unit?.fileName ?? fileFallback?.name ?? (raw.file ?? "").trim(),
    loc,
    page: pageFromLoc(loc),
    quote: (raw.quote ?? "").trim(),
    verified: match === "exact" || match === "relocated" || match === "relocated_file" || match === "fuzzy",
    match,
  };
}

/** Checks one citation against the extracted pack text. Never throws. */
export function verifyCitation(index: PackIndex, raw: RawCitation): Citation {
  const quote = (raw.quote ?? "").trim();
  const file = resolveFile(index, raw.file);
  if (!quote || tightText(quote).length < 4) return build("none", raw, null, file);

  const parts = quoteParts(quote);
  const whole = tightText(quote);
  const containsAll = (haystack: string) => parts.every((part) => haystack.includes(part));
  const loc = (raw.loc ?? "").trim().toLowerCase();
  const citedIndex = file ? file.units.findIndex((unit) => unit.loc.toLowerCase() === loc) : -1;
  const cited = file && citedIndex >= 0 ? file.units[citedIndex]! : null;

  // 1. At the cited location (also across the boundary with the next / previous page).
  if (file && cited) {
    if (containsAll(cited.tight)) return build("exact", raw, cited, file);
    const next = file.units[citedIndex + 1];
    const previous = file.units[citedIndex - 1];
    if (next && containsAll(cited.tight + next.tight)) return build("exact", raw, cited, file);
    if (previous && containsAll(previous.tight + cited.tight)) return build("exact", raw, cited, file);
  }

  // 2. Verbatim somewhere else: correct the location (never for very short quotes).
  if (whole.length >= MIN_RELOCATABLE_CHARS) {
    const inFile = (candidate: PackIndex["files"][number]) =>
      candidate.units.find((unit) => containsAll(unit.tight)) ?? candidate.units.find((unit, i) => containsAll(unit.tight + (candidate.units[i + 1]?.tight ?? "")));
    if (file && containsAll(file.tight)) {
      const unit = inFile(file);
      if (unit) return build("relocated", raw, unit, file);
    }
    if (containsAll(index.tight)) {
      for (const other of index.files) {
        if (other === file) continue;
        const unit = inFile(other);
        if (unit) return build("relocated_file", raw, unit, other);
      }
    }
  }

  // 3. Fuzzy: most 5-word shingles at one location AND every number of the quote present there.
  const quoteShingles = shingles(quote);
  if (quoteShingles.length >= 3) {
    if (cited && shingleShare(quoteShingles, cited.tight) >= FUZZY_AT_LOC && numbersGrounded(quote, cited)) {
      return build("fuzzy", raw, cited, file);
    }
    if (shingleShare(quoteShingles, index.tight) >= FUZZY_ELSEWHERE) {
      let best: { unit: IndexedUnit; share: number } | null = null;
      for (const unit of index.units) {
        const share = shingleShare(quoteShingles, unit.tight);
        if (share >= FUZZY_ELSEWHERE && (!best || share > best.share)) best = { unit, share };
      }
      if (best && numbersGrounded(quote, best.unit)) return build("fuzzy", raw, best.unit, file);
    }
  }
  return build("not_found", raw, null, file);
}

/**
 * True when every figure in `threshold` ("£5,000,000", "2 references in 3 years") can be
 * found in the quote or at the cited location. A requirement whose number is not in its
 * source must be re-checked by a person even if the quote itself was found.
 */
export function thresholdGrounded(index: PackIndex, citation: Citation, threshold: string | null | undefined): boolean {
  if (!threshold) return true;
  const magnitudes = thresholdMagnitudes(threshold);
  if (magnitudes.length === 0) return true;
  const available = numberTokens(citation.quote);
  const file = index.files.find((candidate) => candidate.id === citation.fileId);
  const position = file ? file.units.findIndex((candidate) => candidate.loc === citation.loc) : -1;
  if (file && position >= 0) {
    // A figure often sits a line above or below the quoted sentence, sometimes across a page break.
    for (const unit of [file.units[position - 1], file.units[position], file.units[position + 1]]) {
      if (unit) for (const token of unit.numbers) available.add(token);
    }
  }
  return magnitudes.every((magnitude) => available.has(magnitude));
}

/** Share of verified citations, for pack statistics. */
export function citationStats(citations: Array<Citation | null | undefined>): { total: number; verified: number } {
  const present = citations.filter((citation): citation is Citation => Boolean(citation));
  return { total: present.length, verified: present.filter((citation) => citation.verified).length };
}
