import { PLANS, PLAN_KEYS, formatPrice, type BillingInterval, type PlanKey } from "./plans";
import { site } from "./site";

/**
 * Display adapter between the plan catalogue (src/config/plans.ts — the source of truth for
 * names, prices, seats and bullets) and the pricing UI: pricing cards, the landing-page
 * teaser, the comparison table and Settings → Billing all read from here.
 *
 * Pure data and pure functions: safe to import from client components.
 * What is NOT in the catalogue (the one-off Bid Pass, the comparison rows, trial wording)
 * lives in this file so that the catalogue's shape stays untouched.
 */

export type PlanPriceDisplay = {
  /** "£29", "£290", "£0" */
  amount: string;
  /** "per month" | "per year" | "" (free) */
  period: string;
  /** Line under the price. */
  note: string;
};

export type PlanDisplay = {
  key: PlanKey;
  name: string;
  summary: string;
  bullets: string[];
  recommended: boolean;
  seats: number | null;
  /** Shown as a small line under the call to action, e.g. the trial terms. */
  footnote: string | null;
  monthly: PlanPriceDisplay;
  annual: PlanPriceDisplay;
};

const FOOTNOTES: Record<PlanKey, string | null> = {
  free: "No card needed.",
  starter: "Pause or cancel in two clicks.",
  pro: `${site.facts.trialDays}-day trial, card required. Pause or cancel in two clicks.`,
  business: "Pause or cancel in two clicks.",
};

export function planPrice(key: PlanKey, interval: BillingInterval): PlanPriceDisplay {
  const prices = PLANS[key].prices;
  if (!prices) return { amount: formatPrice(0), period: "", note: "Free. No time limit." };
  if (interval === "year") {
    return {
      amount: formatPrice(prices.year),
      period: "per year",
      note: `Two months free. Works out at ${formatPrice(Math.round(prices.year / 12))} a month.`,
    };
  }
  return { amount: formatPrice(prices.month), period: "per month", note: "Billed monthly." };
}

export function planDisplay(key: PlanKey): PlanDisplay {
  const plan = PLANS[key];
  return {
    key,
    name: plan.name,
    summary: plan.description,
    bullets: plan.highlights,
    recommended: Boolean(plan.recommended),
    seats: plan.limits.seats,
    footnote: FOOTNOTES[key],
    monthly: planPrice(key, "month"),
    annual: planPrice(key, "year"),
  };
}

export const PLAN_DISPLAYS: PlanDisplay[] = PLAN_KEYS.map(planDisplay);

/** How many monthly payments an annual plan saves (10 × monthly = annual → 2). */
export const ANNUAL_FREE_MONTHS = 2;

/**
 * Bid Pass: one full bid, paid once, no subscription. Not a plan key — it is sold as a
 * one-off and shown as a first-class option next to the plans.
 */
export const BID_PASS = {
  name: "Bid Pass",
  pricePence: 9900,
  price: formatPrice(9900),
  period: "one-off",
  summary: "One full bid, paid once. No subscription.",
  audience: "For firms that bid a few times a year.",
  bullets: [
    "One full bid, from tender pack to Word export",
    "Cited check and scored-question matrix",
    "First drafts written only from your evidence",
    "Evaluator-style marking",
    "Works on any plan, including Free",
  ],
  footnote: "Nothing renews. Buy another when you next bid.",
} as const;

/** A cell of the comparison table: text, or true (included) / false (not included). */
export type ComparisonValue = string | boolean;

export type ComparisonRow = {
  label: string;
  /** Short clarification under the label. */
  detail?: string;
  values: Record<PlanKey, ComparisonValue>;
};

export type ComparisonGroup = { title: string; rows: ComparisonRow[] };

const seats = (key: PlanKey): string => {
  const value = PLANS[key].limits.seats;
  return value === null ? "Unlimited" : String(value);
};

/** Plan comparison (docs/product/SPEC.md §5). Seats come from the catalogue. */
export const COMPARISON: ComparisonGroup[] = [
  {
    title: "Radar",
    rows: [
      {
        label: "Supplier page and radar",
        detail: "Open tenders like the ones you have won, contracts ending soon, buyers in your trade.",
        values: { free: "Top 10 matches", starter: "Every match", pro: "Every match", business: "Every match" },
      },
      {
        label: "Radar profiles",
        detail: "A profile is a set of trades, regions and contract values to watch.",
        values: { free: "1", starter: "5", pro: "5", business: "5" },
      },
      { label: "Email digest", values: { free: "Weekly", starter: "Daily", pro: "Daily", business: "Daily" } },
      { label: "Deadline reminders for saved tenders", values: { free: true, starter: true, pro: true, business: true } },
      { label: "Buyer and competitor watchlists", values: { free: false, starter: true, pro: true, business: true } },
      { label: "Export to CSV", values: { free: false, starter: true, pro: true, business: true } },
    ],
  },
  {
    title: "Bids",
    rows: [
      {
        label: "Cited bid checks",
        detail: "Pass/fail requirements, key dates and scored questions, each quoted with file and page.",
        values: { free: "1 in total", starter: "1 a month", pro: "With every bid", business: "With every bid" },
      },
      {
        label: "Full bids",
        detail: "Check, scored-question matrix, first drafts from your evidence, evaluator-style marking, Word export.",
        values: { free: false, starter: false, pro: "3 a month", business: "10 a month" },
      },
      { label: "Unused bids roll over", values: { free: false, starter: false, pro: "One month", business: "One month" } },
    ],
  },
  {
    title: "Team",
    rows: [
      { label: "Seats", values: { free: seats("free"), starter: seats("starter"), pro: seats("pro"), business: seats("business") } },
      { label: "Separate client workspaces", values: { free: false, starter: false, pro: false, business: true } },
    ],
  },
  {
    title: "Billing",
    rows: [
      { label: "Free trial", values: { free: false, starter: false, pro: `${site.facts.trialDays} days, card required`, business: false } },
      { label: "Annual billing", values: { free: false, starter: "Two months free", pro: "Two months free", business: "Two months free" } },
      { label: "Pause or cancel in two clicks", values: { free: false, starter: true, pro: true, business: true } },
      { label: "Reminder before an annual renewal", values: { free: false, starter: "7 days before", pro: "7 days before", business: "7 days before" } },
    ],
  },
];
