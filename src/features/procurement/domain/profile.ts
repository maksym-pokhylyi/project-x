import { cpvDivision, cpvDivisionLabel, cpvPrefixes, cpvStem, isCpvCode } from "./cpv";
import { formatMoneyShort } from "./money";
import { ABROAD, NATIONWIDE, regionsLabel } from "./regions";
import { tokenise, topKeywords } from "./text";

/**
 * Supplier trade profile and match scoring (PURE).
 *
 * A profile says what a supplier does, derived from its published awards:
 *  - CPV weights for every prefix of its codes (division down to the full code), recent
 *    awards counting more (half-life 18 months) and the first-listed (main) code of an
 *    award counting more than its additional codes — 22% of tenders lead with a
 *    division-level code and half list several, so exact-code matching misses
 *    (docs/domain/fts-data-profile.md §6 #15);
 *  - keywords from award titles;
 *  - regions delivered in, plus the home region;
 *  - a value band (p10–p90 of awards attributable to the supplier alone).
 */

export type ProfileAward = {
  title: string;
  /** Main code first. */
  cpvCodes: string[];
  regions: string[];
  valueAmount: number | null;
  currency: string | null;
  valueShared: boolean;
  isFramework: boolean;
  competition: string;
  /** ISO date of the award (or its publication). */
  date: string;
  buyerId: string | null;
  buyerName: string | null;
};

export type SupplierProfileData = {
  cpvWeights: Record<string, number>;
  cpvDivisions: string[];
  cpvGroups: string[];
  topCpv: Array<{ code: string; label: string | null; weight: number }>;
  keywords: string[];
  regions: string[];
  homeRegion: string | null;
  valueLow: number | null;
  valueMedian: number | null;
  valueHigh: number | null;
  awardsCount: number;
  totalValue: number;
  summary: string;
  stats: {
    buyers: Array<{ id: string; name: string; awards: number }>;
    competition: Record<string, number>;
    firstAwardAt: string | null;
    lastAwardAt: string | null;
    mainDivision: string | null;
  };
};

const HALF_LIFE_MONTHS = 18;
const MONTH_MS = 30.4375 * 86_400_000;
/** Weight of an award's additional CPV codes relative to its first (main) code. */
const SECONDARY_CODE_WEIGHT = 0.35;

export function recencyWeight(dateIso: string, now: Date): number {
  const ageMonths = Math.max(0, (now.getTime() - Date.parse(dateIso)) / MONTH_MS);
  return Math.max(0.1, Math.pow(0.5, ageMonths / HALF_LIFE_MONTHS));
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (index - low);
}

/** A figure that can be attributed to one supplier: not shared, not a framework ceiling, in GBP. */
export function isAttributableValue(award: Pick<ProfileAward, "valueAmount" | "currency" | "valueShared" | "isFramework">): boolean {
  return (
    award.valueAmount !== null && award.valueAmount > 0 && award.valueAmount < 1_000_000_000 && !award.valueShared && !award.isFramework && (award.currency ?? "GBP") === "GBP"
  );
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * The levels at which a profile's trade is defined, as specific as its own coding allows:
 * classes (4 digits) where it has them, groups (3) only where no class sits beneath, and
 * divisions (2) only where no group does. "Same trade" queries OR the three together.
 */
export function tradeLevels(cpvWeights: Record<string, number>): { classes: string[]; groups: string[]; divisions: string[] } {
  const strong = (length: number, floor: number, ratio: number) => {
    const entries = Object.entries(cpvWeights).filter(([prefix]) => prefix.length === length);
    const top = Math.max(0, ...entries.map(([, weight]) => weight));
    return entries.filter(([, weight]) => weight >= Math.max(floor, top * ratio)).map(([prefix]) => prefix);
  };
  const classes = strong(4, 0.08, 0.4);
  const groups = strong(3, 0.08, 0.4).filter((group) => !classes.some((value) => value.startsWith(group)));
  const divisions = strong(2, 0.1, 0.4).filter((division) => !classes.some((value) => value.startsWith(division)) && !groups.some((value) => value.startsWith(division)));
  return { classes, groups, divisions };
}

export function buildSupplierProfile(
  supplier: { name: string; region: string | null },
  awards: ProfileAward[],
  cpvLabels: ReadonlyMap<string, string> | Record<string, string>,
  now: Date,
): SupplierProfileData {
  const labelOf = (code: string): string | null => (cpvLabels instanceof Map ? cpvLabels.get(code) : (cpvLabels as Record<string, string>)[code]) ?? null;
  const prefixWeight = new Map<string, number>();
  const codeWeight = new Map<string, number>();
  const regionWeight = new Map<string, number>();
  const buyers = new Map<string, { id: string; name: string; awards: number }>();
  const competition: Record<string, number> = {};
  let totalWeight = 0;

  for (const award of awards) {
    const weight = recencyWeight(award.date, now);
    totalWeight += weight;
    const codes = [...new Set(award.cpvCodes.filter(isCpvCode))];
    // Per award, each prefix counts once, at the weight of the strongest code that carries it.
    const perAward = new Map<string, number>();
    codes.forEach((code, index) => {
      const share = index === 0 ? 1 : SECONDARY_CODE_WEIGHT;
      for (const prefix of cpvPrefixes(code)) perAward.set(prefix, Math.max(perAward.get(prefix) ?? 0, share));
      codeWeight.set(code, (codeWeight.get(code) ?? 0) + weight * share);
    });
    for (const [prefix, share] of perAward) prefixWeight.set(prefix, (prefixWeight.get(prefix) ?? 0) + weight * share);
    for (const region of new Set(award.regions)) regionWeight.set(region, (regionWeight.get(region) ?? 0) + weight);
    if (award.buyerId && award.buyerName) {
      const entry = buyers.get(award.buyerId) ?? { id: award.buyerId, name: award.buyerName, awards: 0 };
      entry.awards += 1;
      buyers.set(award.buyerId, entry);
    }
    competition[award.competition] = (competition[award.competition] ?? 0) + 1;
  }

  const share = (value: number) => (totalWeight > 0 ? value / totalWeight : 0);
  const rankedPrefixes = [...prefixWeight.entries()].map(([prefix, value]) => [prefix, share(value)] as const).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const cpvWeights: Record<string, number> = {};
  for (const [prefix, value] of rankedPrefixes.slice(0, 120)) {
    if (value >= 0.04 || Object.keys(cpvWeights).length < 10) cpvWeights[prefix] = round(value);
  }
  const strongest = (length: number, floor: number, ratio: number, max: number) => {
    const all = rankedPrefixes.filter(([prefix]) => prefix.length === length);
    const top = all[0]?.[1] ?? 0;
    return all.filter(([, value]) => value >= Math.max(floor, top * ratio)).slice(0, max).map(([prefix]) => prefix);
  };
  const cpvDivisions = strongest(2, 0.1, 0.4, 8);
  const cpvGroups = strongest(3, 0.08, 0.4, 12);

  const topCpv = [...codeWeight.entries()]
    // Prefer specific codes; a bare division code says little.
    .map(([code, value]) => ({ code, label: labelOf(code), weight: round(share(value)), depth: cpvStem(code).length }))
    .sort((a, b) => b.weight * (b.depth > 2 ? 1 : 0.5) - a.weight * (a.depth > 2 ? 1 : 0.5) || (a.code < b.code ? -1 : 1))
    .slice(0, 6)
    .map(({ code, label, weight }) => ({ code, label, weight }));

  // Place and buyer names are not what a supplier does: keep them out of the keywords.
  const keywords = topKeywords(
    awards.map((award) => ({ text: stripWords(award.title, award.buyerName), weight: recencyWeight(award.date, now) })),
    12,
  );

  const specificRegions = [...regionWeight.entries()].filter(([region]) => region !== NATIONWIDE && region !== ABROAD).sort((a, b) => b[1] - a[1]);
  const regions = specificRegions.filter(([, value]) => share(value) >= 0.15).map(([region]) => region);
  if (regions.length === 0 && specificRegions.length > 0) regions.push(specificRegions[0]![0]);
  if (supplier.region && supplier.region !== NATIONWIDE && !regions.includes(supplier.region)) regions.push(supplier.region);
  // Mostly UK-wide work: the supplier travels.
  if (share(regionWeight.get(NATIONWIDE) ?? 0) >= 0.5 || specificRegions.filter(([, value]) => share(value) >= 0.1).length >= 5) regions.push(NATIONWIDE);

  const values = awards.filter(isAttributableValue).map((award) => award.valueAmount!).sort((a, b) => a - b);
  const totalValue = values.reduce((sum, value) => sum + value, 0);
  const dates = awards.map((award) => award.date).sort();
  const mainDivision = cpvDivisions[0] ?? null;
  const topBuyers = [...buyers.values()].sort((a, b) => b.awards - a.awards || (a.name < b.name ? -1 : 1));

  const count = awards.length;
  const parts: string[] = [];
  parts.push(`${supplier.name} is named in ${count} published public contract award${count === 1 ? "" : "s"}`);
  const worth = formatMoneyShort(totalValue);
  if (worth && values.length > 0) parts.push(`worth ${worth}`);
  if (topBuyers.length > 0) parts.push(`from ${topBuyers.length} buyer${topBuyers.length === 1 ? "" : "s"}`);
  let summary = parts.join(" ");
  if (mainDivision) summary += `, mostly in ${cpvDivisionLabel(mainDivision).toLowerCase()}`;
  const where = regionsLabel(regions.filter((region) => region !== NATIONWIDE).slice(0, 2));
  if (where) summary += ` (${where})`;
  summary += ".";

  return {
    cpvWeights,
    cpvDivisions,
    cpvGroups,
    topCpv,
    keywords,
    regions,
    homeRegion: supplier.region && supplier.region !== NATIONWIDE ? supplier.region : null,
    valueLow: values.length > 0 ? round(percentile(values, 0.1)!, 2) : null,
    valueMedian: values.length > 0 ? round(percentile(values, 0.5)!, 2) : null,
    valueHigh: values.length > 0 ? round(percentile(values, 0.9)!, 2) : null,
    awardsCount: count,
    totalValue: round(totalValue, 2),
    summary,
    stats: {
      buyers: topBuyers.slice(0, 8),
      competition,
      firstAwardAt: dates[0] ?? null,
      lastAwardAt: dates[dates.length - 1] ?? null,
      mainDivision,
    },
  };
}

/** UK place names that crowd contract titles ("Suffolk Highways…", "…for Kent"). */
const PLACE_WORDS = new Set(
  (
    "aberdeen anglesey antrim armagh ayrshire barnsley bath bedford bedfordshire belfast berkshire birmingham blackpool bolton bournemouth bradford brighton bristol " +
    "buckinghamshire bury cambridge cambridgeshire cardiff carlisle ceredigion cheshire cornwall coventry cumbria derby derbyshire devon doncaster dorset dudley durham " +
    "dundee edinburgh essex exeter fife gateshead glasgow gloucester gloucestershire gwent gwynedd hampshire hereford herefordshire hertfordshire highland hull humber " +
    "kent kirklees lancashire leeds leicester leicestershire lincoln lincolnshire liverpool luton manchester merseyside middlesbrough midlands newcastle norfolk " +
    "northampton northamptonshire northumberland norwich nottingham nottinghamshire oxford oxfordshire pembrokeshire peterborough plymouth portsmouth powys reading " +
    "rotherham salford sandwell sheffield shropshire somerset southampton staffordshire stockport stoke suffolk sunderland surrey sussex swansea swindon tameside " +
    "teesside thames tyne tyneside wakefield walsall warwickshire westminster wiltshire wirral wolverhampton worcester worcestershire wrexham york yorkshire"
  ).split(/\s+/),
);

function stripWords(title: string, buyerName: string | null): string {
  const drop = new Set([...tokenise(buyerName), ...PLACE_WORDS]);
  // Replace with a separator so words on either side do not form a pair.
  return tokenise(title)
    .map((token) => (drop.has(token) ? "/" : token))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Radar spec: what we match against (from a supplier profile or a manual radar profile)
// ---------------------------------------------------------------------------

export type RadarSpec = {
  /** Cache key: "s:<supplier id>" or "r:<radar profile id>". */
  key: string;
  supplierId: string | null;
  label: string;
  /** Weight (0..1) for every CPV prefix the profile covers, lengths 2–8. */
  cpvWeights: Record<string, number>;
  /** Every division the profile touches, however lightly: the candidate net. */
  cpvDivisions: string[];
  /** Strong groups, for display and filters. */
  cpvGroups: string[];
  keywords: string[];
  /** Top-level regions; may include "UK" for suppliers that work nationwide. Empty = no preference. */
  regions: string[];
  valueLow: number | null;
  valueHigh: number | null;
};

/** Spec for a manually described radar: every chosen code counts fully at each of its depths. */
export function specFromManualProfile(profile: {
  id: string;
  name: string;
  cpvCodes: string[];
  keywords: string[];
  regions: string[];
  valueMin: number | null;
  valueMax: number | null;
}): RadarSpec {
  const cpvWeights: Record<string, number> = {};
  for (const code of profile.cpvCodes.filter(isCpvCode)) for (const prefix of cpvPrefixes(code)) cpvWeights[prefix] = 1;
  const prefixes = Object.keys(cpvWeights);
  return {
    key: `r:${profile.id}`,
    supplierId: null,
    label: profile.name,
    cpvWeights,
    cpvDivisions: prefixes.filter((prefix) => prefix.length === 2),
    cpvGroups: prefixes.filter((prefix) => prefix.length === 3),
    keywords: profile.keywords,
    regions: profile.regions,
    valueLow: profile.valueMin,
    valueHigh: profile.valueMax,
  };
}

export type CpvMatch = {
  score: number;
  /** Deepest prefix the notice shares with the profile. */
  prefix: string | null;
  /**
   * "line": one code is the other, or a broader/narrower version of it.
   * "sibling": both are more specific than what they share (roofing vs plumbing under construction).
   */
  relation: "line" | "sibling" | null;
};

const DEPTH_FACTOR = [0, 0, 0.4, 0.65, 0.85, 0.95, 1, 1, 1];
const SIBLING_FACTOR = 0.55;
/**
 * Divisions so wide that sharing one says little on its own (construction, health and
 * social care, business services…). A division-only overlap there needs supporting text.
 */
const BROAD_DIVISIONS = new Set(["33", "34", "42", "44", "45", "50", "71", "72", "73", "75", "79", "85", "90", "98"]);
const BROAD_DIVISION_FACTOR = 0.28;

/** How closely a set of CPV codes matches a profile's trade. */
export function scoreCpv(cpvWeights: Record<string, number>, codes: readonly string[]): CpvMatch {
  let best: CpvMatch = { score: 0, prefix: null, relation: null };
  const keys = Object.keys(cpvWeights);
  for (const code of codes) {
    if (!isCpvCode(code)) continue;
    const prefixes = cpvPrefixes(code);
    for (let index = prefixes.length - 1; index >= 0; index -= 1) {
      const prefix = prefixes[index]!;
      const weight = cpvWeights[prefix];
      if (weight === undefined) continue;
      const noticeIsDeeper = index < prefixes.length - 1;
      const profileIsDeeper = keys.some((key) => key.length > prefix.length && key.startsWith(prefix));
      const relation: CpvMatch["relation"] = noticeIsDeeper && profileIsDeeper ? "sibling" : "line";
      const depthFactor = prefix.length === 2 && BROAD_DIVISIONS.has(prefix) ? BROAD_DIVISION_FACTOR : DEPTH_FACTOR[prefix.length]!;
      const score = depthFactor * (relation === "sibling" ? SIBLING_FACTOR : 1) * (0.4 + 0.6 * Math.sqrt(Math.min(1, weight)));
      if (score > best.score) best = { score, prefix, relation };
      break; // shallower prefixes of this code can only score lower
    }
  }
  return best;
}

export type ScoreInput = {
  title: string;
  cpvCodes: string[];
  regions: string[];
  valueAmount: number | null;
  /** ts_rank_cd(search, query, 32) over title, CPV labels and description — in [0, 1). */
  textRank: number;
};

export type ScoreBreakdown = {
  total: number;
  cpv: number;
  text: number;
  region: number;
  value: number;
  /** Deepest CPV prefix shared with the profile, e.g. "7731". */
  cpvPrefix: string | null;
  cpvRelation: CpvMatch["relation"];
  /** Profile keywords found in the notice title. */
  keywordHits: string[];
  regionMatch: "local" | "nationwide" | "unknown" | "elsewhere";
  /** The notice is far larger than anything the profile has won. */
  oversized: boolean;
};

export const SCORE_WEIGHTS = { cpv: 0.45, text: 0.2, region: 0.18, value: 0.17 } as const;
/** A tender in a region the supplier has never worked in is rarely worth a small firm's time. */
const ELSEWHERE_PENALTY = 0.6;
/** A notice worth more than this multiple of the profile's largest awards is ranked down. */
const OVERSIZE_MULTIPLE = 10;
const OVERSIZE_PENALTY = 0.8;
/** A notice listing this many regions is effectively nationwide. */
const WIDE_REGION_COUNT = 6;
/**
 * Trade signal needed for a match: a real CPV overlap, or keywords in the title, or a weak
 * CPV overlap backed by some text evidence. Region and size alone never make a match.
 */
const MIN_CPV_SIGNAL = 0.3;
const MIN_TEXT_SIGNAL = 0.3;
const WEAK_CPV_SIGNAL = 0.2;
const WEAK_TEXT_SIGNAL = 0.15;
export const MIN_MATCH_SCORE = 0.3;

/** Light stemming so "medicines" meets "medicine" and "surveys" meets "survey". */
function stem(token: string): string {
  if (token.length <= 4) return token;
  return token.replace(/ies$/, "y").replace(/sses$/, "ss").replace(/([^s])s$/, "$1");
}

function keywordHits(keywords: readonly string[], title: string): string[] {
  const haystack = ` ${tokenise(title).map(stem).join(" ")} `;
  const hits: string[] = [];
  for (const keyword of keywords) {
    const tokens = tokenise(keyword);
    const needle = tokens.map(stem).join(" ");
    const original = tokens.join(" ");
    // Matching is on stems; what we report is the keyword as the profile spells it.
    if (needle.length >= 3 && haystack.includes(` ${needle} `) && !hits.includes(original)) hits.push(original);
  }
  // A pair and its parts are one hit, not three.
  return hits.filter((hit) => !hits.some((other) => other !== hit && other.includes(" ") && ` ${other} `.includes(` ${hit} `)));
}

export function scoreNotice(spec: RadarSpec, notice: ScoreInput): ScoreBreakdown {
  const cpvMatch = scoreCpv(spec.cpvWeights, notice.cpvCodes);
  const cpv = cpvMatch.score;

  // Title hits carry the text score; the SQL rank adds a little for matches in the description.
  const hits = keywordHits(spec.keywords, notice.title);
  const phraseHits = hits.filter((hit) => hit.includes(" ")).length;
  const text = Math.min(1, 0.5 * phraseHits + 0.3 * (hits.length - phraseHits) + Math.min(0.45, Math.max(0, notice.textRank) * 0.9));

  let region: number;
  let regionMatch: ScoreBreakdown["regionMatch"];
  const specific = spec.regions.filter((value) => value !== NATIONWIDE);
  if (notice.regions.includes(ABROAD)) {
    region = 0;
    regionMatch = "elsewhere";
  } else if (notice.regions.length === 0) {
    region = 0.5;
    regionMatch = "unknown";
  } else if (notice.regions.length < WIDE_REGION_COUNT && notice.regions.some((value) => specific.includes(value))) {
    region = 1;
    regionMatch = "local";
  } else if (notice.regions.includes(NATIONWIDE) || notice.regions.length >= WIDE_REGION_COUNT) {
    region = 0.7;
    regionMatch = "nationwide";
  } else if (spec.regions.length === 0) {
    region = 0.6;
    regionMatch = "unknown";
  } else if (spec.regions.includes(NATIONWIDE)) {
    region = 0.75;
    regionMatch = "nationwide";
  } else {
    region = 0;
    regionMatch = "elsewhere";
  }

  let value = 0.5;
  let oversized = false;
  if (notice.valueAmount !== null && notice.valueAmount > 0 && (spec.valueLow !== null || spec.valueHigh !== null)) {
    const low = spec.valueLow ?? spec.valueHigh! / 10;
    const high = spec.valueHigh ?? spec.valueLow! * 10;
    if (notice.valueAmount >= low / 2 && notice.valueAmount <= high * 3) value = 1;
    else if (notice.valueAmount >= low / 5 && notice.valueAmount <= high * 10) value = 0.5;
    else value = 0.1;
    oversized = notice.valueAmount > high * OVERSIZE_MULTIPLE;
  }

  let total = SCORE_WEIGHTS.cpv * cpv + SCORE_WEIGHTS.text * text + SCORE_WEIGHTS.region * region + SCORE_WEIGHTS.value * value;
  if (regionMatch === "elsewhere") total *= ELSEWHERE_PENALTY;
  if (oversized) total *= OVERSIZE_PENALTY;
  const hasTradeSignal = cpv >= MIN_CPV_SIGNAL || text >= MIN_TEXT_SIGNAL || (cpv >= WEAK_CPV_SIGNAL && text >= WEAK_TEXT_SIGNAL);
  if (!hasTradeSignal) total = 0;
  return {
    total: round(total, 4),
    cpv: round(cpv),
    text: round(text),
    region,
    value,
    cpvPrefix: cpvMatch.prefix,
    cpvRelation: cpvMatch.relation,
    keywordHits: hits,
    regionMatch,
    oversized,
  };
}

/** Division of the profile's strongest trade, for labels. */
export function mainDivisionOf(spec: Pick<RadarSpec, "cpvWeights">): string | null {
  const divisions = Object.entries(spec.cpvWeights).filter(([prefix]) => prefix.length === 2).sort((a, b) => b[1] - a[1]);
  return divisions[0] ? cpvDivision(divisions[0][0]) : null;
}
