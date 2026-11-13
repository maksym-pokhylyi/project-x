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
