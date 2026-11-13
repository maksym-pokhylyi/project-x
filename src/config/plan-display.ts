import {
  ANNUAL_FREE_MONTHS,
  BID_PASS,
  COMPARISON_NONE,
  PLANS,
  PLAN_COMPARISON,
  PLAN_KEYS,
  formatPrice,
  type BillingInterval,
  type ComparisonGroup,
  type ComparisonRow,
  type ComparisonValue,
  type PlanKey,
} from "./plans";

/**
 * Display adapter between the plan catalogue (src/config/plans.ts — the single source of
 * names, prices, limits and feature lines) and the pricing UI: the plan cards, the
 * comparison table, the landing page and Billing all read from here.
 *
 * It only FORMATS: no figure or feature line is written in this file. Pure functions and
 * data: safe to import from client components.
 */

export type { ComparisonGroup, ComparisonRow, ComparisonValue };
export { ANNUAL_FREE_MONTHS, COMPARISON_NONE };

const SMALL_NUMBERS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"] as const;
/** A small count as running text spells it: 2 -> "two". Larger numbers stay as figures. */
export function inWords(count: number): string {
  return SMALL_NUMBERS[count] ?? String(count);
}

/** "two months free" — how annual billing is described everywhere. */
export const ANNUAL_SAVING = `${inWords(ANNUAL_FREE_MONTHS)} months free`;

export type PlanPriceDisplay = {
  /** "£29", "£290", "£0" */
  amount: string;
  /** "a month" | "a year" | "" (free) */
  period: string;
  /** The small line under the price: "or £290 a year" (monthly), "two months free" (annual), "" (free). */
  note: string;
  /** Price and period in one phrase, for table heads and summaries: "£29 a month", "£0". */
  line: string;
};

/** A feature line of a plan card. `lead` is the part set in bold ("3 full bids a month:"). */
export type PlanFeatureLine = { lead: string | null; text: string };

export type PlanDisplay = {
  key: PlanKey;
  name: string;
  summary: string;
  /** The summary in fewer words, for the narrow card on phones. */
  summaryShort: string;
  /** The plan in one line, for Billing. */
  billingLine: string;
  /** "Everything in Radar Pro, and:" — the line above the bullets; null for the first plans. */
  leadIn: string | null;
  features: PlanFeatureLine[];
  /** Label of the card's call to action on public pages. */
  cta: string;
  recommended: boolean;
  seats: number | null;
  trialDays: number | null;
  /** Full bids included in the trial; null when the plan has no trial. */
  trialFullBids: number | null;
  monthly: PlanPriceDisplay;
  annual: PlanPriceDisplay;
};

export function planPrice(key: PlanKey, interval: BillingInterval): PlanPriceDisplay {
  const prices = PLANS[key].prices;
  if (!prices) {
    const amount = formatPrice(0);
    return { amount, period: "", note: "", line: amount };
  }
  if (interval === "year") {
    const amount = formatPrice(prices.year);
    return { amount, period: "a year", note: ANNUAL_SAVING, line: `${amount} a year` };
  }
  const amount = formatPrice(prices.month);
  return { amount, period: "a month", note: `or ${formatPrice(prices.year)} a year`, line: `${amount} a month` };
}

function featureLine(line: string): PlanFeatureLine {
  const colon = line.indexOf(": ");
  return colon === -1 ? { lead: null, text: line } : { lead: line.slice(0, colon + 1), text: line.slice(colon + 2) };
}

export function planDisplay(key: PlanKey): PlanDisplay {
  const plan = PLANS[key];
  /* A highlight that starts "Everything in …" is the lead-in of the list, not a bullet. */
  const [first, ...rest] = plan.highlights;
  const inherits = first?.startsWith("Everything in ") ?? false;
  const lines = inherits ? rest : plan.highlights;
  return {
    key,
    name: plan.name,
    summary: plan.description,
    summaryShort: plan.descriptionShort,
    billingLine: plan.summary,
    leadIn: inherits ? (first ?? null) : null,
    features: lines.map(featureLine),
    cta: plan.cta,
    recommended: Boolean(plan.recommended),
    seats: plan.limits.seats,
    trialDays: plan.trialDays ?? null,
    trialFullBids: plan.trialFullBids ?? null,
    monthly: planPrice(key, "month"),
    annual: planPrice(key, "year"),
  };
}

export const PLAN_DISPLAYS: PlanDisplay[] = PLAN_KEYS.map(planDisplay);

/** The Bid Pass as shown to people. The figures come from the catalogue. */
export const BID_PASS_DISPLAY = {
  name: BID_PASS.name,
  headline: BID_PASS.headline,
  description: BID_PASS.description,
  descriptionShort: BID_PASS.descriptionShort,
  cta: BID_PASS.cta,
  /** "£99" */
  price: formatPrice(BID_PASS.price),
  /** In pence, for structured data. */
  pricePence: BID_PASS.price,
  period: "one-off",
  /** "A Bid Pass adds one full bid for £99." */
  shortLine: `A ${BID_PASS.name} adds one full bid for ${formatPrice(BID_PASS.price)}.`,
} as const;

/** The comparison table, straight from the catalogue. */
export const COMPARISON: ComparisonGroup[] = PLAN_COMPARISON;
