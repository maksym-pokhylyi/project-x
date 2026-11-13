import { cpvDivisionLabel, cpvStem, isCpvCode, sharedCpvDepth, shortCpvLabel } from "./cpv";
import { formatMoneyShort } from "./money";
import type { RadarSpec, ScoreBreakdown } from "./profile";
import { tokenise } from "./text";

/**
 * Deterministic one-line match reasons (PURE). Always available; an LLM-written sentence
 * may replace it for the top matches, but never the other way round.
 *
 * Wording rules (DESIGN.md §2, P2 §4.4): plain, factual, second person, anchored to a
 * published fact — one of the supplier's own awards, or a term in the notice. Never a
 * prediction ("you could win…").
 */
export type ReferenceAward = {
  ocid: string;
  title: string;
  cpvCodes: string[];
  valueAmount: number | null;
  buyerId: string | null;
  buyerName: string | null;
  /** ISO date. */
  date: string;
};

export type ReasonNotice = {
  title: string;
  cpvCodes: string[];
  buyerId: string | null;
  buyerName: string | null;
};

type Closeness = { depth: number; /** One code is the other, or a broader/narrower version of it. */ line: boolean };

function closest(noticeCodes: string[], awardCodes: string[]): Closeness {
  let best: Closeness = { depth: 0, line: false };
  for (const a of noticeCodes) {
    if (!isCpvCode(a)) continue;
    for (const b of awardCodes) {
      if (!isCpvCode(b)) continue;
      const depth = sharedCpvDepth(a, b);
      const line = depth === Math.min(cpvStem(a).length, cpvStem(b).length);
      if (depth > best.depth || (depth === best.depth && line && !best.line)) best = { depth, line };
    }
  }
  return best;
}

/** strong: the same line of work. related: neighbouring codes. broad: only the sector in common. */
function strength(closeness: Closeness): "strong" | "related" | "broad" | "none" {
  if (closeness.depth >= 5 || (closeness.line && closeness.depth >= 3)) return "strong";
  if (closeness.depth >= 3 || (closeness.line && closeness.depth === 2)) return "related";
  if (closeness.depth === 2) return "broad";
  return "none";
}

/**
 * "Same work" on a chip is stricter than `strength`: the same CPV class (four digits) as
 * the same line of work, or the same five-digit category. A shared group ("Building
 * installation work", "Health services") is too wide to call the same work.
 */
function isSameWork(closeness: Closeness): boolean {
  return closeness.depth >= 5 || (closeness.line && closeness.depth >= 4);
}

/** The past award closest to a notice by CPV (same buyer first), or null when nothing is related. */
export function closestReference(notice: Pick<ReasonNotice, "cpvCodes" | "buyerId">, references: readonly ReferenceAward[]): ReferenceAward | null {
  let best: { reference: ReferenceAward; rank: number } | null = null;
  for (const reference of references) {
    const closeness = closest(notice.cpvCodes, reference.cpvCodes);
    if (closeness.depth < 2) continue;
    const sameBuyer = Boolean(notice.buyerId && reference.buyerId === notice.buyerId);
    const rank = (sameBuyer ? 100 : 0) + closeness.depth * 2 + (closeness.line ? 1 : 0);
    if (!best || rank > best.rank) best = { reference, rank };
  }
  return best?.reference ?? null;
}

function yearOf(iso: string): string {
  return iso.slice(0, 4);
}

function awardPhrase(reference: ReferenceAward): string {
  const money = formatMoneyShort(reference.valueAmount);
  return money ? `${money} award` : `${yearOf(reference.date)} award`;
}

/** First profile keyword that appears in the notice title, in the profile's own wording. */
export function keywordInTitle(keywords: string[], title: string): string | null {
  const haystack = ` ${tokenise(title).join(" ")} `;
  for (const keyword of keywords) {
    const needle = tokenise(keyword).join(" ");
    if (needle.length >= 3 && haystack.includes(` ${needle} `)) return needle;
  }
  // Simple plural/singular tolerance for single words.
  for (const keyword of keywords) {
    const needle = tokenise(keyword).join(" ");
    if (needle.includes(" ") || needle.length < 4) continue;
    const stem = needle.replace(/(ing|es|s)$/, "");
    if (stem.length >= 4 && new RegExp(` ${stem}[a-z]{0,3} `).test(haystack)) return needle;
  }
  return null;
}

export function explainMatch(
  spec: Pick<RadarSpec, "keywords" | "supplierId">,
  notice: ReasonNotice,
  breakdown: Pick<ScoreBreakdown, "cpvPrefix" | "cpv" | "text"> & { keywordHits?: string[] },
  references: readonly ReferenceAward[],
  cpvLabels: ReadonlyMap<string, string>,
): string {
  const tradeLabel = (): string => {
    const prefix = breakdown.cpvPrefix;
    if (prefix) {
      const exact = notice.cpvCodes.find((code) => code.startsWith(prefix));
      const label = shortCpvLabel(exact ? cpvLabels.get(exact) : null);
      if (label && prefix.length >= 3) return label;
    }
    return cpvDivisionLabel(prefix ?? notice.cpvCodes[0] ?? "").toLowerCase();
  };

  if (references.length > 0) {
    const scored = references
      .map((reference) => ({ reference, closeness: closest(notice.cpvCodes, reference.cpvCodes), sameBuyer: Boolean(notice.buyerId && reference.buyerId === notice.buyerId) }))
      .sort((a, b) => b.closeness.depth - a.closeness.depth || Number(b.closeness.line) - Number(a.closeness.line) || (a.reference.date < b.reference.date ? 1 : -1));
    const keyword = breakdown.keywordHits?.[0] ?? keywordInTitle(spec.keywords, notice.title);

    const sameBuyer = scored.find((entry) => entry.sameBuyer && entry.closeness.depth >= 2);
    if (sameBuyer && notice.buyerName) {
      const money = formatMoneyShort(sameBuyer.reference.valueAmount);
      const what = money ? `a ${money} contract` : "a contract";
      return `From ${notice.buyerName}, which awarded you ${what} in ${yearOf(sameBuyer.reference.date)}`;
    }
    const best = scored[0]!;
    const from = best.reference.buyerName ? ` from ${best.reference.buyerName}` : "";
    const award = `your ${awardPhrase(best.reference)}${from}`;
    switch (strength(best.closeness)) {
      case "strong":
        return `Same category as ${award}`;
      case "related":
        return keyword ? `Mentions "${keyword}" and is in a related category to ${award}` : `Related category to ${award}: ${tradeLabel()}`;
      case "broad":
        return keyword ? `Mentions "${keyword}", which features in your past awards` : `Same broad trade as ${award}: ${tradeLabel()}`;
      default:
        return keyword ? `Mentions "${keyword}", which features in your past awards` : "Similar wording to contracts you have been awarded";
    }
  }

  // Manually described radar: no award history to point at.
  if (breakdown.cpv > 0) {
    const keyword = keywordInTitle(spec.keywords, notice.title);
    return keyword ? `Matches your trade (${tradeLabel()}) and mentions "${keyword}"` : `Matches your trade: ${tradeLabel()}`;
  }
  const keyword = keywordInTitle(spec.keywords, notice.title);
  return keyword ? `Mentions "${keyword}" from your keywords` : "Matches the keywords on your radar";
}

// ---------------------------------------------------------------------------
// Reason chips: counted facts, never a judgement
// ---------------------------------------------------------------------------

/**
 * The facts behind the chips on a match row (docs/design/handoff/README.md: "only facts we
 * actually have — same category, a buyer you have won from, region; no distances").
 * Everything here is counted from published notices; nothing is estimated.
 */
export type MatchFacts = {
  /** The supplier's own contracts considered (0 for a manually described radar). */
  wins: number;
  /** How many of them were awarded by this notice's buyer. */
  buyerWins: number;
  /** The supplier has contract history and none of it is with this buyer. */
  newBuyer: boolean;
  /** Contracts in the same line of work: the same CPV class as the same line, or the same five-digit category. */
  sameWorkWins: number;
  /** Contracts in a neighbouring category (same CPV group) that are not counted as the same work. */
  relatedWorkWins: number;
  /** Manually described radars: the trade of the profile this notice falls in, in plain words. */
  trade: string | null;
  /** A profile keyword found in the notice title, as the profile spells it. */
  keyword: string | null;
  /** The supplier's contracts with this notice's buyer, newest first (at most five), for the tender page. */
  buyerContracts: Array<{ title: string; valueAmount: number | null; year: string }>;
  /** The notice's own categories that are the same work as one of the supplier's contracts, in plain words. */
  sameWorkLabels: string[];
};

export function matchFacts(
  spec: Pick<RadarSpec, "keywords" | "supplierId">,
  notice: ReasonNotice,
  breakdown: Pick<ScoreBreakdown, "cpvPrefix" | "cpv"> & { keywordHits?: string[] },
  references: readonly ReferenceAward[],
  cpvLabels: ReadonlyMap<string, string>,
): MatchFacts {
  let buyerWins = 0;
  let sameWorkWins = 0;
  let relatedWorkWins = 0;
  const buyerContracts: MatchFacts["buyerContracts"] = [];
  const sameWorkCodes = new Set<string>();
  for (const reference of references) {
    if (notice.buyerId && reference.buyerId === notice.buyerId) {
      buyerWins += 1;
      if (buyerContracts.length < 5) buyerContracts.push({ title: reference.title, valueAmount: reference.valueAmount, year: yearOf(reference.date) });
    }
    const closeness = closest(notice.cpvCodes, reference.cpvCodes);
    if (isSameWork(closeness)) {
      sameWorkWins += 1;
      for (const code of notice.cpvCodes) if (isCpvCode(code) && isSameWork(closest([code], reference.cpvCodes))) sameWorkCodes.add(code);
    } else if (closeness.depth >= 3) relatedWorkWins += 1;
  }
  const sameWorkLabels = [...new Set([...sameWorkCodes].map((code) => shortCpvLabel(cpvLabels.get(code))).filter((label): label is string => Boolean(label)))].slice(0, 4);
  const keyword = breakdown.keywordHits?.[0] ?? keywordInTitle(spec.keywords, notice.title);
  let trade: string | null = null;
  if (references.length === 0 && breakdown.cpv > 0) {
    const prefix = breakdown.cpvPrefix;
    const exact = prefix ? notice.cpvCodes.find((code) => code.startsWith(prefix)) : undefined;
    const label = prefix && prefix.length >= 3 ? shortCpvLabel(exact ? cpvLabels.get(exact) : null) : null;
    trade = label ?? cpvDivisionLabel(prefix ?? notice.cpvCodes[0] ?? "").toLowerCase();
  }
  return {
    wins: references.length,
    buyerWins,
    newBuyer: references.length > 0 && Boolean(notice.buyerId) && buyerWins === 0,
    sameWorkWins,
    relatedWorkWins,
    trade,
    keyword,
    buyerContracts,
    sameWorkLabels,
  };
}

export type ReasonChip = { kind: "buyer" | "work" | "new_buyer" | "trade" | "keyword"; label: string; strong: boolean };

/**
 * The chips of a match row, strongest first: the three kinds the design allows, each a
 * counted fact — wins from this buyer, wins in the same work, "New buyer for you". The
 * place of delivery is a fourth, separate chip (see `placeLabel`).
 * A manually described radar has no wins to count, so it says which of the owner's own
 * choices the notice met: the trade, or the keyword found in its title.
 */
export function reasonChips(facts: MatchFacts): ReasonChip[] {
  const chips: ReasonChip[] = [];
  if (facts.buyerWins > 0) {
    chips.push({ kind: "buyer", strong: true, label: `You have won ${facts.buyerWins} ${facts.buyerWins === 1 ? "contract" : "contracts"} from this buyer` });
  }
  if (facts.sameWorkWins > 0) {
    chips.push({ kind: "work", strong: false, label: facts.wins === 1 ? "Same work as your contract win" : `Same work as ${facts.sameWorkWins} of your wins` });
  }
  if (facts.newBuyer) chips.push({ kind: "new_buyer", strong: false, label: "New buyer for you" });
  if (facts.wins === 0 && facts.trade) chips.push({ kind: "trade", strong: false, label: `Your trade: ${facts.trade}` });
  if (facts.wins === 0 && facts.keyword && !facts.trade) chips.push({ kind: "keyword", strong: false, label: `Mentions “${facts.keyword}”` });
  return chips;
}

/** Guards for model-written reasons before they are cached or shown. */
export function isAcceptableReason(reason: unknown): reason is string {
  if (typeof reason !== "string") return false;
  const text = reason.trim();
  if (text.length < 20 || text.length > 200) return false;
  if (/\n/.test(text)) return false;
  // No promises, no hype, no contact details.
  if (/\b(guarantee|guaranteed|you will win|sure to win|perfect (fit|match)|ideal (fit|match)|don't miss|act now|hurry)\b/i.test(text)) return false;
  if (/@|https?:\/\//i.test(text)) return false;
  return true;
}

/**
 * A model-written reason may only state figures we gave it: every "£…" amount and every
 * four-digit year in the sentence must be one of the allowed facts. Catches the classic
 * slip of turning a year into a price ("your £2026 award").
 */
export function isGroundedReason(reason: string, facts: { amounts: Array<string | null>; years: Array<string | null> }): boolean {
  const amounts = new Set(facts.amounts.filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase()));
  const years = new Set(facts.years.filter((value): value is string => Boolean(value)));
  for (const match of reason.matchAll(/£\s?[\d][\d.,]*\s?(?:bn|m|k)?/gi)) {
    const amount = match[0].replace(/\s+/g, "").replace(/[.,]$/, "").toLowerCase();
    if (!amounts.has(amount)) return false;
  }
  for (const match of reason.matchAll(/\b(19|20)\d{2}\b/g)) {
    if (!years.has(match[0])) return false;
  }
  return true;
}
