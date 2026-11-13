/**
 * How names and figures taken from a notice are written in a letter (PURE).
 *
 * Two thirds of supplier names are published in capitals ("HINCKLEY PLUMBING AND HEATING
 * SERVICES LIMITED"). A letter that shouts reads as machine-made, so names in capitals are
 * set in ordinary case; names that already use mixed case are left exactly as published.
 * The founder checks every letter against the company's page before sending
 * (docs/gtm/02-outreach-kit.md §1 step 8) — this is a sensible default, not a guarantee.
 */

const LOWER_WORDS = new Set(["and", "of", "the", "for", "in", "on", "at", "by", "to", "with", "upon", "an"]);
/** Short words that are ordinary words, not initials: set in ordinary case. */
const SHORT_WORDS = new Set([
  "co", "air", "all", "art", "bay", "big", "box", "bus", "car", "cab", "day", "eco", "eye", "fit", "fix", "fun", "gas", "gym", "hub", "ice", "inn", "ink", "job",
  "key", "kit", "lab", "law", "log", "man", "map", "men", "net", "new", "now", "oak", "oil", "old", "one", "our", "out", "own", "pay", "pet", "pro", "pub", "red",
  "sea", "sky", "son", "spa", "sun", "tax", "tea", "ten", "top", "toy", "two", "van", "way", "web", "win", "yes", "you", "zoo", "bee", "fox", "owl", "elm", "ash",
  "bio", "mid", "age", "aid", "arc", "ace", "bar", "bed", "bin", "bit", "bow", "boy", "cup", "cut", "dot", "dry", "ear", "end", "era", "far", "fen", "few", "fly",
  "fog", "gap", "gem", "hat", "hay", "hen", "hop", "hot", "ivy", "jet", "joy", "lea", "lee", "let", "lid", "lit", "lot", "low", "mac", "max", "may", "mix", "nut",
  "oat", "odd", "off", "pan", "pen", "pin", "pit", "pod", "raw", "ray", "rex", "rig", "rod", "row", "run", "set", "sir", "six", "tap", "tec", "tek", "tip", "ton",
  "up", "us", "use", "vet", "wax", "wet", "zen", "go", "my", "we", "be", "do", "it", "is", "me", "no", "so", "get", "its", "pop", "how", "ark", "are", "med", "de",
  // Given names and short place names: "IAN WILLIAMS LIMITED" is a person's company, not an abbreviation.
  "ian", "tom", "jim", "bob", "sam", "joe", "ben", "dan", "ken", "roy", "tim", "guy", "kay", "amy", "eve", "ann", "sue", "pat", "don", "les", "reg", "rob", "ron", "stu",
  "ted", "vic", "wes", "zoe", "mel", "jon", "jan", "jay", "gus", "len", "lou", "ned", "nat", "ada", "ava", "eva", "ida", "kim", "liz", "meg", "viv", "alf", "bev", "des",
  "dom", "gil", "hal", "huw", "jed", "lyn", "nev", "raj", "ros", "sid", "sol", "syd", "val", "wyn", "jo", "al", "ed", "ely", "rye", "wye", "exe", "usk", "ayr", "esk",
  "tay", "dee", "doe",
]);
/** Forms that keep their capitals whatever the rest of the name does. */
const KEEP_UPPER = new Set([
  "plc", "llp", "cic", "uk", "gb", "nhs", "ni", "eu", "usa", "it", "hr", "ict", "fm", "hvac", "cctv", "dvla", "dvsa", "defra", "esfa", "fcdo", "dstl", "ukri", "ukhsa",
  "nhse", "hmrc", "mod", "bbc", "tfl", "ii", "iii", "iv",
]);
/** Words with one fixed spelling. */
const FIXED_FORMS: Record<string, string> = {
  limited: "Limited", ltd: "Ltd", cyf: "Cyf", cyfyngedig: "Cyfyngedig", st: "St", mr: "Mr", mrs: "Mrs", ms: "Ms", dr: "Dr", jnr: "Jnr", snr: "Snr", inc: "Inc",
};

function capitalise(word: string): string {
  if (!word) return word;
  // "MCDONALD" -> "McDonald", "O'BRIEN" -> "O'Brien", "SMITH-JONES" -> "Smith-Jones"
  return word
    .split("-")
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index > 0 && LOWER_WORDS.has(lower)) return lower; // "Stoke-on-Trent"
      if (/^mc[a-z]{2,}$/.test(lower)) return `Mc${lower.charAt(2).toUpperCase()}${lower.slice(3)}`;
      const apostrophe = /^([a-z])(['’])([a-z]{2,})$/.exec(lower);
      if (apostrophe) return `${apostrophe[1]!.toUpperCase()}${apostrophe[2]}${apostrophe[3]!.charAt(0).toUpperCase()}${apostrophe[3]!.slice(1)}`;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("-");
}

function caseToken(token: string, index: number): string {
  const match = /^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/.exec(token);
  if (!match) return token;
  const [, lead = "", core = "", trail = ""] = match;
  if (!core) return token;
  const lower = core.toLowerCase();
  if (FIXED_FORMS[lower]) return `${lead}${FIXED_FORMS[lower]}${trail}`;
  if (/\d/.test(core)) return token; // "24/7", "A1", "3D"
  if (KEEP_UPPER.has(lower)) return `${lead}${core.toUpperCase()}${trail}`;
  if (index > 0 && LOWER_WORDS.has(lower)) return `${lead}${lower}${trail}`;
  // Initials and abbreviations: one or two letters, anything without a vowel ("HMPPS", "BT"),
  // dotted forms ("J.S."), and three-letter forms that are not ordinary words ("ABC", "DHL").
  if (core.length === 1 || core.includes(".") || core.includes("&") || !/[aeiouy]/i.test(core)) return `${lead}${core.toUpperCase()}${trail}`;
  if (core.length <= 3 && !SHORT_WORDS.has(lower) && !LOWER_WORDS.has(lower)) return `${lead}${core.toUpperCase()}${trail}`;
  return `${lead}${capitalise(core)}${trail}`;
}

/** A name published in capitals, set in ordinary case; any other name unchanged (whitespace tidied). */
export function displayName(published: string): string {
  const name = published.replace(/\s+/g, " ").trim();
  if (!name || /[a-z]/.test(name)) return name;
  return name
    .split(" ")
    .map((token, index) => caseToken(token, index))
    .join(" ");
}

const LEGAL_SUFFIX =
  /[\s,]+(?:limited liability partnership|public limited company|community interest company|limited|ltd\.?|plc|p\.l\.c\.?|llp|l\.l\.p\.?|cic|c\.i\.c\.?|cyf\.?|cyfyngedig)$/i;

/** The name without its legal suffix, for the second mention: "Home Support Matters CIC" -> "Home Support Matters". */
export function shortCompanyName(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  const short = trimmed.replace(LEGAL_SUFFIX, "").replace(/[\s,.-]+$/, "");
  // "Limited" on its own, or a name that is all suffix: keep what was published.
  return short.length >= 2 ? short : trimmed;
}

/** "Acme" -> "Acme's", "John Flowers" -> "John Flowers'". */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

const MAX_TITLE_WORDS = 12;

/**
 * A contract title as it is quoted in a letter: one line, no quotation marks of its own,
 * and cut to its first twelve words with an ellipsis when longer (kit §5).
 */
export function quotedTitle(title: string): string {
  const clean = title
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/["“”]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  const words = clean.split(" ");
  if (words.length <= MAX_TITLE_WORDS) return clean;
  const kept = words.slice(0, MAX_TITLE_WORDS);
  // Do not stop on a word that leads nowhere ("… for parks and…").
  while (kept.length > 3 && DANGLING.has(kept.at(-1)!.toLowerCase().replace(/[^a-z&]/g, ""))) kept.pop();
  return `${kept.join(" ").replace(/[\s,;:.\-–—(/&]+$/, "")}…`;
}

const DANGLING = new Set(["and", "of", "for", "the", "to", "in", "at", "on", "with", "by", "a", "an", "&", "or", "from"]);

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

/** "3 November 2026" (UK time). */
export function longDate(value: Date | string): string {
  return LONG_DATE.format(new Date(value));
}

export type AwardFigure = { valueAmount: number | null; valueGross: number | null; currency: string | null; valueShared: boolean; isFramework: boolean };

const MIN_VALUE = 1_000;
const MAX_VALUE = 100_000_000;

/**
 * The contract value as a letter may state it (kit §5): the figure in the notice when it is
 * this supplier's alone — "£370,000", or "£175,000 including VAT" when only the gross figure
 * was published. Null (the letter then says nothing about value) when there is no figure,
 * it is a placeholder, it is implausibly large, it is shared between several suppliers or
 * the award is a framework ceiling.
 */
export function letterValue(award: AwardFigure): string | null {
  if (award.valueShared || award.isFramework) return null;
  const amount = award.valueAmount;
  if (amount === null || !Number.isFinite(amount) || amount < MIN_VALUE || amount > MAX_VALUE) return null;
  const currency = (award.currency ?? "GBP").toUpperCase();
  let text: string;
  try {
    text = new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
  } catch {
    return null;
  }
  const grossOnly = award.valueGross !== null && Math.abs(award.valueGross - amount) < 0.005;
  return grossOnly ? `${text} including VAT` : text;
}
