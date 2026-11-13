import { cpvDivision, cpvDivisionLabel, cpvPrefixes, cpvStem, isCpvCode } from "./cpv";
import { formatMoneyShort } from "./money";
import { NATIONWIDE, regionsLabel } from "./regions";
import { topKeywords } from "./text";

/**
 * Supplier trade profile and match scoring (PURE).
 *
 * A profile says what a supplier does, derived from its published awards:
 *  - CPV weights at 2–5 digit prefixes, recent awards counting more (half-life 18 months) —
 *    22% of tenders lead with a division-level code and half list several, so exact-code
 *    matching misses (docs/domain/fts-data-profile.md §6 #15);
 *  - keywords from award titles;
 *  - regions delivered in, plus the home region;
 *  - a value band (p10–p90 of awards attributable to the supplier alone).
 */

export type ProfileAward = {
  title: string;
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
    const codes = award.cpvCodes.filter(isCpvCode);
    const prefixes = new Set(codes.flatMap(cpvPrefixes));
    for (const prefix of prefixes) prefixWeight.set(prefix, (prefixWeight.get(prefix) ?? 0) + weight);
    for (const code of new Set(codes)) codeWeight.set(code, (codeWeight.get(code) ?? 0) + weight);
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
  for (const [prefix, value] of rankedPrefixes.slice(0, 60)) {
    if (value >= 0.04 || Object.keys(cpvWeights).length < 8) cpvWeights[prefix] = round(value);
  }
  const byLength = (length: number, min: number, atLeast: number) => {
    const all = rankedPrefixes.filter(([prefix]) => prefix.length === length);
    const strong = all.filter(([, value]) => value >= min);
    return (strong.length >= atLeast ? strong : all.slice(0, atLeast)).map(([prefix]) => prefix);
  };
  const cpvDivisions = byLength(2, 0.1, 1).slice(0, 8);
  const cpvGroups = byLength(3, 0.08, 2).slice(0, 12);

  const topCpv = [...codeWeight.entries()]
    // Prefer specific codes; a bare division code says little.
    .map(([code, value]) => ({ code, label: labelOf(code), weight: round(share(value)), depth: cpvStem(code).length }))
    .sort((a, b) => b.weight * (b.depth > 2 ? 1 : 0.5) - a.weight * (a.depth > 2 ? 1 : 0.5) || (a.code < b.code ? -1 : 1))
    .slice(0, 6)
    .map(({ code, label, weight }) => ({ code, label, weight }));

  const keywords = topKeywords(
    awards.map((award) => ({ text: award.title, weight: recencyWeight(award.date, now) })),
    12,
  );

  const specificRegions = [...regionWeight.entries()].filter(([region]) => region !== NATIONWIDE).sort((a, b) => b[1] - a[1]);
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

// ---------------------------------------------------------------------------
// Radar spec: what we match against (from a supplier profile or a manual radar profile)
// ---------------------------------------------------------------------------

export type RadarSpec = {
  /** Cache key: "s:<supplier id>" or "r:<radar profile id>". */
  key: string;
  supplierId: string | null;
  label: string;
  cpvWeights: Record<string, number>;
  cpvDivisions: string[];
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

export type ScoreInput = {
  cpvCodes: string[];
  regions: string[];
  valueAmount: number | null;
  /** ts_rank_cd(search, query, 32) — already in [0, 1). */
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
  regionMatch: "local" | "nationwide" | "unknown" | "elsewhere";
};

const DEPTH_FACTOR: Record<number, number> = { 2: 0.45, 3: 0.72, 4: 0.9, 5: 1 };
export const SCORE_WEIGHTS = { cpv: 0.5, text: 0.22, region: 0.18, value: 0.1 } as const;
/** A tender in a region the supplier has never worked in is rarely worth a small firm's time. */
const ELSEWHERE_PENALTY = 0.6;
export const MIN_MATCH_SCORE = 0.3;

export function scoreNotice(spec: RadarSpec, notice: ScoreInput): ScoreBreakdown {
  let cpv = 0;
  let cpvPrefix: string | null = null;
  for (const code of notice.cpvCodes) {
    if (!isCpvCode(code)) continue;
    const prefixes = cpvPrefixes(code);
    for (let index = prefixes.length - 1; index >= 0; index -= 1) {
      const prefix = prefixes[index]!;
      const weight = spec.cpvWeights[prefix];
      if (weight === undefined) continue;
      const score = DEPTH_FACTOR[prefix.length]! * (0.4 + 0.6 * Math.sqrt(Math.min(1, weight)));
      if (score > cpv || (score === cpv && cpvPrefix !== null && prefix.length > cpvPrefix.length)) {
        cpv = score;
        cpvPrefix = prefix;
      }
      break; // deeper prefixes of this code were already tried
    }
  }

  const text = Math.min(1, Math.max(0, notice.textRank) * 2.2);

  let region: number;
  let regionMatch: ScoreBreakdown["regionMatch"];
  const specific = spec.regions.filter((value) => value !== NATIONWIDE);
  if (notice.regions.length === 0) {
    region = 0.5;
    regionMatch = "unknown";
  } else if (notice.regions.some((value) => specific.includes(value))) {
    region = 1;
    regionMatch = "local";
  } else if (notice.regions.includes(NATIONWIDE)) {
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
  if (notice.valueAmount !== null && notice.valueAmount > 0 && (spec.valueLow !== null || spec.valueHigh !== null)) {
    const low = spec.valueLow ?? spec.valueHigh! / 10;
    const high = spec.valueHigh ?? spec.valueLow! * 10;
    if (notice.valueAmount >= low / 2 && notice.valueAmount <= high * 3) value = 1;
    else if (notice.valueAmount >= low / 5 && notice.valueAmount <= high * 10) value = 0.5;
    else value = 0.1;
  }

  let total = SCORE_WEIGHTS.cpv * cpv + SCORE_WEIGHTS.text * text + SCORE_WEIGHTS.region * region + SCORE_WEIGHTS.value * value;
  if (regionMatch === "elsewhere") total *= ELSEWHERE_PENALTY;
  // No trade signal at all: region and size alone never make a match.
  if (cpv === 0 && text < 0.2) total = 0;
  return { total: round(total, 4), cpv: round(cpv), text: round(text), region, value, cpvPrefix, regionMatch };
}

/** Division of the profile's strongest trade, for labels. */
export function mainDivisionOf(spec: Pick<RadarSpec, "cpvWeights">): string | null {
  const divisions = Object.entries(spec.cpvWeights).filter(([prefix]) => prefix.length === 2).sort((a, b) => b[1] - a[1]);
  return divisions[0] ? cpvDivision(divisions[0][0]) : null;
}
