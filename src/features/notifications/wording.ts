import { formatMoneyExact, formatMoneyShort } from "@/features/procurement/domain/money";

/**
 * Wording helpers for scheduled e-mails (PURE): names, counts, money, subject lines.
 * Voice (DESIGN.md §2): plain British English, numbers before adjectives, no hype.
 */

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** "three" for 3, "12" for 12: small numbers read better as words in a sentence. */
export function numberWord(count: number): string {
  return Number.isInteger(count) && count >= 0 && count <= 10 ? NUMBER_WORDS[count]! : count.toLocaleString("en-GB");
}

export function capitalise(text: string): string {
  return text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);
}

/** "1 new tender", "3 new tenders" */
export function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? singular : plural}`;
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** "Joanne" from "Joanne Pike"; null when there is nothing usable. */
export function firstName(fullName: string | null | undefined): string | null {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  const cleaned = first.replace(/[<>"]/g, "").slice(0, 40);
  return cleaned.length > 0 ? cleaned : null;
}

const LEGAL_SUFFIX = /[\s,]+(?:limited liability partnership|public limited company|community interest company|limited|ltd\.?|llp|plc|cic|c\.i\.c\.?|lp|llc|inc\.?)$/i;
const TRADING_AS = /\s+(?:t\/a|trading as)\s+.+$/i;
/** Words that describe a business rather than name it; dropped from the END of a name only. */
const GENERIC_TAIL = new Set([
  "services",
  "service",
  "solutions",
  "group",
  "holdings",
  "building",
  "builders",
  "construction",
  "contractors",
  "contracting",
  "maintenance",
  "property",
  "consulting",
  "consultancy",
  "consultants",
  "associates",
  "partnership",
  "enterprises",
  "international",
  "systems",
  "technologies",
  "technology",
  "engineering",
  "supplies",
  "trading",
  "company",
  "management",
  "uk",
  "gb",
]);
const FILLER = new Set(["the", "a", "an", "and", "&", "of"]);

function significantWords(words: string[]): number {
  return words.filter((word) => !FILLER.has(word.toLowerCase())).length;
}

const SMALL_WORDS = new Set(["and", "of", "the", "for", "in", "at", "on", "to", "with"]);

function sentenceCaseWord(word: string, first: boolean): string {
  const lower = word.toLowerCase();
  if (!first && SMALL_WORDS.has(lower)) return lower;
  // Initials and acronyms stay as they are: up to three letters, no vowel, or with a digit.
  if (word.length <= 3 || !/[AEIOUY]/.test(word) || /\d/.test(word)) return word;
  const cased = lower[0]!.toUpperCase() + lower.slice(1);
  return /^Mc[a-z]{2,}/.test(cased) ? `Mc${cased[2]!.toUpperCase()}${cased.slice(3)}` : cased;
}

/**
 * Registered names are often published in capitals ("NEWBURY COMMERCIAL GLAZING"). In a
 * sentence that reads as shouting, so a name WITHOUT ANY lower-case letter is set in
 * capitalised words: "Newbury Commercial Glazing". Initials and short acronyms keep their
 * capitals ("KPMG", "A R Demolition", "Perk UK"). A name with any lower-case letter was
 * typed with care and is left exactly as it is.
 */
export function calmCase(name: string): string {
  if (/[a-z]/.test(name) || !/[A-Z]{4,}/.test(name)) return name;
  let first = true;
  return name.replace(/[A-Z0-9]+/g, (word) => {
    const cased = sentenceCaseWord(word, first);
    first = false;
    return cased;
  });
}

/**
 * The name people call a company: "Aldermoor & Pike" for "Aldermoor & Pike Building Services
 * Ltd". Drops the trading-as tail and the legal form, then generic descriptors from the end
 * while at least two real words remain; a name published in capitals is calmed (calmCase).
 * Used in subject lines and sentences — the footer always gives the registered name in full.
 */
export function shortCompanyName(name: string): string {
  return calmCase(shortRegisteredName(name));
}

function shortRegisteredName(name: string): string {
  const full = name.replace(/\s+/g, " ").trim();
  let value = full.replace(TRADING_AS, "");
  for (let pass = 0; pass < 3 && LEGAL_SUFFIX.test(value); pass += 1) value = value.replace(LEGAL_SUFFIX, "");
  value = value.replace(/[\s,&-]+$/, "").trim();
  const words = value.split(" ");
  while (words.length > 1) {
    const last = words[words.length - 1]!.toLowerCase().replace(/[^a-z]/g, "");
    if (!GENERIC_TAIL.has(last)) break;
    const rest = words.slice(0, -1);
    // Never cut a name down to a single real word or to something ending in "&" / "and".
    while (rest.length > 0 && FILLER.has(rest[rest.length - 1]!.toLowerCase())) rest.pop();
    if (significantWords(rest) < 2) break;
    words.length = 0;
    words.push(...rest);
  }
  const result = words.join(" ").trim();
  return result.length >= 2 ? result : full;
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

function wholeUnits(amount: number, currency: string | null): string | null {
  return formatMoneyExact(Math.round(amount), currency);
}

/**
 * An ESTIMATED value as the digest shows it: "est. £640,000", "est. £1.1m". Estimates of a
 * million and more are rounded like the app does (an estimate to the pound is false
 * precision); below that the published figure is given in full. Null when nothing was
 * published — a value is never invented.
 */
export function formatEstimate(amount: number | null | undefined, currency: string | null = "GBP"): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) return null;
  const figure = amount >= 1_000_000 ? formatMoneyShort(amount, currency) : wholeUnits(amount, currency);
  return figure ? `est. ${figure}` : null;
}

/** The value of an awarded contract, in full: "£2,100,000". Null when it was not published for this supplier alone. */
export function formatContractValue(amount: number | null | undefined, currency: string | null = "GBP"): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) return null;
  return wholeUnits(amount, currency);
}

// ---------------------------------------------------------------------------
// Subject lines
// ---------------------------------------------------------------------------

/** RFC 5322 recommends lines of at most 78 characters: subjects stay under that. */
export const SUBJECT_MAX = 77;
const MIN_NAME = 12;

/** Cuts at a word boundary (when that keeps at least half) and adds "…". Never returns more than `max` characters. */
export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 1) return max === 1 ? "…" : "";
  const cut = text.slice(0, max - 1);
  const boundary = cut.lastIndexOf(" ");
  const kept = (boundary >= Math.floor(max / 2) ? cut.slice(0, boundary) : cut).replace(/[\s,;:·&(\-–]+$/, "");
  return `${kept}…`;
}

/**
 * Assembles `lead + name + tail` within SUBJECT_MAX: the name is shortened first (down to
 * MIN_NAME characters), then the tail is dropped, then the whole line is cut.
 */
function fitSubject(lead: string, name: string, tail: string): string {
  const full = `${lead}${name}${tail}`;
  if (full.length <= SUBJECT_MAX) return full;
  const room = SUBJECT_MAX - lead.length - tail.length;
  if (room >= MIN_NAME) return `${lead}${truncateAtWord(name, room)}${tail}`;
  const withoutTail = `${lead}${name}`;
  if (withoutTail.length <= SUBJECT_MAX) return withoutTail;
  const roomWithoutTail = SUBJECT_MAX - lead.length;
  return roomWithoutTail >= MIN_NAME ? `${lead}${truncateAtWord(name, roomWithoutTail)}` : truncateAtWord(withoutTail, SUBJECT_MAX);
}

/** Longest title an e-mail prints in full; buyers sometimes put a paragraph in the title field. */
export const TITLE_MAX = 140;

/** A notice title for an e-mail: one line, cut at a word with "…" when it runs past TITLE_MAX. */
export function clipTitle(title: string, max: number = TITLE_MAX): string {
  return truncateAtWord(singleLine(title), max);
}

/** No line breaks or control characters in a header, whatever a notice title contains. */
export function singleLine(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * "3 new tenders for Aldermoor & Pike · 2 contracts ending soon". With no new tenders the
 * contracts lead: "2 contracts ending soon in your trade · Aldermoor & Pike".
 */
export function digestSubject(input: { company: string; matches: number; ending: number }): string {
  const company = singleLine(input.company);
  if (input.matches > 0) {
    const tail = input.ending > 0 ? ` · ${countOf(input.ending, "contract")} ending soon` : "";
    return fitSubject(`${countOf(input.matches, "new tender")} for `, company, tail);
  }
  return fitSubject(`${countOf(input.ending, "contract")} ending soon in your trade · `, company, "");
}

/** "2 new tenders for Aldermoor & Pike" */
export function alertSubject(input: { company: string; matches: number }): string {
  return fitSubject(`${countOf(input.matches, "new tender")} for `, singleLine(input.company), "");
}

/** "Closes in 2 days: School kitchen refurbishments, Phase 2 (+1 more)" */
export function reminderSubject(input: { daysLeft: number; title: string; more: number }): string {
  const lead = `${closesIn(input.daysLeft)}: `;
  const tail = input.more > 0 ? ` (+${input.more} more)` : "";
  return fitSubject(lead, singleLine(input.title), tail);
}

/** "Closes in 2 days", "Closes tomorrow", "Closes today" */
export function closesIn(daysLeft: number): string {
  if (daysLeft <= 0) return "Closes today";
  return daysLeft === 1 ? "Closes tomorrow" : `Closes in ${daysLeft} days`;
}

/** "Your Bid Desk annual plan renews in 7 days" */
export function renewalSubject(input: { planName: string; daysLeft: number }): string {
  const when = input.daysLeft <= 0 ? "today" : input.daysLeft === 1 ? "tomorrow" : `in ${input.daysLeft} days`;
  return truncateAtWord(`Your ${singleLine(input.planName)} annual plan renews ${when}`, SUBJECT_MAX);
}
