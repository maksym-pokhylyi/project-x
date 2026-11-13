/**
 * Plan catalogue — the single source of truth for pricing, limits and feature flags.
 *
 * Pure data: safe to import from client components, scripts and tests.
 * Paddle price ids are NOT stored here; they come from env (see `paddlePriceEnvVar`)
 * so sandbox and production can use different ids. `pnpm paddle:setup` creates the
 * products/prices in Paddle from this file and prints the env lines.
 *
 * Every figure and feature line a person sees — pricing cards, the comparison table,
 * Billing, the landing page — is rendered from this file (through
 * src/config/plan-display.ts, which only formats). Change a number here and it changes
 * everywhere.
 *
 * HOW TO CHANGE THINGS (details in README):
 *  - new plan         -> add a key to PLAN_KEYS + an entry in PLANS, add env vars, run paddle:setup
 *  - new quota metric -> add it to QUOTA_METRICS and to `limits` of every plan
 *  - new feature flag -> add it to PlanFeatures and to `features` of every plan
 */

export const PLAN_KEYS = ["free", "starter", "pro", "business"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
export type PaidPlanKey = Exclude<PlanKey, "free">;

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/**
 * Metered quotas enforced by `consumeQuota(orgId, metric, n)`.
 * `period: "month"` resets at the start of each UTC calendar month;
 * `period: "lifetime"` never resets.
 */
export type QuotaMetricConfig = { label: string; description: string; period: "month" | "lifetime" };

const defineQuotaMetrics = <T extends Record<string, QuotaMetricConfig>>(metrics: T): { [K in keyof T]: QuotaMetricConfig } => metrics;

export const QUOTA_METRICS = defineQuotaMetrics({
  units: {
    label: "Units",
    description: "Placeholder metric of the foundation (not shown to people). Kept until the real meters below are wired.",
    period: "month",
  },
  "bids.monthly": {
    label: "Full bids",
    description: "Full bids started this month: cited check, scored-question matrix, first drafts, marking and Word export.",
    period: "month",
  },
  "briefs.monthly": {
    label: "Cited bid checks",
    description: "Cited bid checks run on their own this month (a full bid includes its check).",
    period: "month",
  },
});

export type QuotaMetric = keyof typeof QUOTA_METRICS;
export const QUOTA_METRIC_KEYS = Object.keys(QUOTA_METRICS) as QuotaMetric[];

/** Numeric limits. `null` means unlimited. */
export type PlanLimits = {
  /** Members per workspace (pending invitations count towards it). */
  seats: number | null;
  /** Estimated AI spend allowed per workspace per UTC month, in USD. */
  aiMonthlyBudgetUsd: number;
  /** Radar sources (claimed companies + manual profiles) a workspace may have. Read by src/features/procurement/access.ts. */
  "radar.profiles": number | null;
  /** Matches shown in full on the radar; `null` = all of them. */
  "radar.matches": number | null;
  /** Cited bid checks every workspace gets once, whatever its plan ("your first check is free"). */
  "briefs.lifetime": number | null;
} & Record<QuotaMetric, number | null>;

/** Boolean feature flags. */
export type PlanFeatures = {
  apiAccess: boolean;
  advancedExports: boolean;
  auditLog: boolean;
  prioritySupport: boolean;
  /** The full radar: every match, daily alerts, buyer and competitor watchlists. Read by src/features/procurement/access.ts. */
  "radar.full": boolean;
  /** Full bids: scored-question matrix, first drafts, marking against the buyer's scheme, Word export, rollover. */
  "bids.drafting": boolean;
  /** A separate workspace for each client (bid writers and consultancies). */
  "workspaces.clients": boolean;
};

export const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  apiAccess: "API access",
  advancedExports: "Export",
  auditLog: "Audit log",
  prioritySupport: "Priority support",
  "radar.full": "Full radar, daily alerts and watchlists",
  "bids.drafting": "Full bids",
  "workspaces.clients": "Separate client workspaces",
};

export type Plan = {
  key: PlanKey;
  name: string;
  description: string;
  /** The same in fewer words, for the narrow plan card on phones. */
  descriptionShort: string;
  /** Price in GBP pence per billing interval; `null` for the free plan. */
  prices: Record<BillingInterval, number> | null;
  limits: PlanLimits;
  features: PlanFeatures;
  /**
   * Feature lines of the pricing card, in order. A line that starts "Everything in …" is the
   * lead-in of the list, not a bullet; the part of a line before ": " is set in bold.
   */
  highlights: string[];
  /** The plan in one line, for Billing: "3 full bids a month · 3 seats · unused bids roll over one month". */
  summary: string;
  /** Label of the card's call to action on public pages. */
  cta: string;
  /** Days of free trial before the first payment (card required). */
  trialDays?: number;
  /** Full bids that can be started during the trial. */
  trialFullBids?: number;
  /** Visually emphasised ("Recommended") on the pricing page. */
  recommended?: boolean;
};

/** ISO 4217 code of the currency every catalogue price is stated in. */
export const PLAN_CURRENCY = "GBP";

/** Annual billing is ten monthly payments: "two months free". */
export const ANNUAL_FREE_MONTHS = 2;

/** Unused full bids roll over for this many months. */
export const BID_ROLLOVER_MONTHS = 1;

/* The numbers the feature lines below repeat. Seats and bids are stated once, here. */
const SEATS = { free: 1, starter: 2, pro: 3, business: 10 } as const;
const FULL_BIDS = { pro: 3, business: 10 } as const;
const FREE_RADAR_MATCHES = 10;
const TRIAL_DAYS = 14;
const TRIAL_FULL_BIDS = 1;
const FULL_BID_CONTENTS = "cited check, scored-question matrix, first drafts from your documents, marking against the buyer’s scheme";

/*
 * The four plan KEYS are the foundation's (free / starter / pro / business) and must not be
 * renamed: subscriptions, env vars and Paddle custom data refer to them. Their display
 * names are the real Bidfolio plans (docs/product/SPEC.md §5, final in the design handoff):
 *
 *   free      -> Free            £0
 *   starter   -> Radar Pro       £29 / month,  £290 / year
 *   pro       -> Bid Desk        £149 / month, £1,490 / year   (recommended, 14-day trial)
 *   business  -> Bid Desk Plus   £349 / month, £3,490 / year
 *
 * The one-off Bid Pass (£99, one full bid) is not a subscription plan: see BID_PASS below.
 * `units` is still the foundation's placeholder quota metric.
 */
export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: "free",
    name: "Free",
    description: "Your page, your radar and one check.",
    descriptionShort: "Your page, your radar and one check.",
    prices: null,
    limits: {
      seats: SEATS.free,
      units: 50,
      aiMonthlyBudgetUsd: 0.5,
      "radar.profiles": 1,
      "radar.matches": FREE_RADAR_MATCHES,
      "briefs.lifetime": 1,
      "briefs.monthly": 0,
      "bids.monthly": 0,
    },
    features: { apiAccess: false, advancedExports: false, auditLog: false, prioritySupport: false, "radar.full": false, "bids.drafting": false, "workspaces.clients": false },
    highlights: [`Your supplier page and radar (top ${FREE_RADAR_MATCHES} matches)`, "Weekly digest", "1 cited bid check"],
    summary: `Your supplier page and radar (top ${FREE_RADAR_MATCHES} matches) · weekly digest · 1 cited bid check`,
    cta: "Find your company",
  },
  starter: {
    key: "starter",
    name: "Radar Pro",
    description: "Hear first, and keep watch on buyers and rivals.",
    descriptionShort: "Hear first, and keep watch.",
    prices: { month: 2900, year: 29000 },
    limits: {
      seats: SEATS.starter,
      units: 1000,
      aiMonthlyBudgetUsd: 5,
      "radar.profiles": 5,
      "radar.matches": null,
      "briefs.lifetime": 1,
      "briefs.monthly": 1,
      "bids.monthly": 0,
    },
    features: { apiAccess: false, advancedExports: true, auditLog: false, prioritySupport: false, "radar.full": true, "bids.drafting": false, "workspaces.clients": false },
    highlights: ["Full radar and daily alerts", "Buyer and competitor watchlists", "Export", "1 cited bid check a month", `${SEATS.starter} seats`],
    summary: `Full radar and daily alerts · 1 cited bid check a month · ${SEATS.starter} seats`,
    cta: "Start Radar Pro",
  },
  pro: {
    key: "pro",
    name: "Bid Desk",
    description: "From tender pack to marked first draft.",
    descriptionShort: "Tender pack to marked draft.",
    prices: { month: 14900, year: 149000 },
    limits: {
      seats: SEATS.pro,
      units: 10000,
      aiMonthlyBudgetUsd: 25,
      "radar.profiles": 5,
      "radar.matches": null,
      "briefs.lifetime": 1,
      "briefs.monthly": null,
      "bids.monthly": FULL_BIDS.pro,
    },
    features: { apiAccess: true, advancedExports: true, auditLog: true, prioritySupport: false, "radar.full": true, "bids.drafting": true, "workspaces.clients": false },
    highlights: [
      "Everything in Radar Pro, and:",
      `${FULL_BIDS.pro} full bids a month: ${FULL_BID_CONTENTS}, Word export`,
      "Unused bids roll over one month",
      `${SEATS.pro} seats`,
      `${TRIAL_DAYS}-day trial, ${TRIAL_FULL_BIDS === 1 ? "one full bid" : `${TRIAL_FULL_BIDS} full bids`} included`,
      "Pause or cancel in two clicks",
    ],
    summary: `${FULL_BIDS.pro} full bids a month · ${SEATS.pro} seats · unused bids roll over one month`,
    cta: `Start ${TRIAL_DAYS}-day trial`,
    trialDays: TRIAL_DAYS,
    trialFullBids: TRIAL_FULL_BIDS,
    recommended: true,
  },
  business: {
    key: "business",
    name: "Bid Desk Plus",
    description: "For bid writers and consultancies.",
    descriptionShort: "For bid writers.",
    prices: { month: 34900, year: 349000 },
    limits: {
      seats: SEATS.business,
      units: 100000,
      aiMonthlyBudgetUsd: 100,
      "radar.profiles": 5,
      "radar.matches": null,
      "briefs.lifetime": 1,
      "briefs.monthly": null,
      "bids.monthly": FULL_BIDS.business,
    },
    features: { apiAccess: true, advancedExports: true, auditLog: true, prioritySupport: true, "radar.full": true, "bids.drafting": true, "workspaces.clients": true },
    highlights: ["Everything in Bid Desk, with:", `${FULL_BIDS.business} full bids a month`, `${SEATS.business} seats`, "Separate client workspaces"],
    summary: `${FULL_BIDS.business} full bids a month · ${SEATS.business} seats · separate client workspaces · unused bids roll over one month`,
    cta: "Start Bid Desk Plus",
  },
};

export const PAID_PLAN_KEYS = PLAN_KEYS.filter((key): key is PaidPlanKey => key !== "free");

/**
 * Bid Pass: one full bid, paid once, with no subscription. It adds one full bid to any plan,
 * including Free. Not a plan key — a workspace can hold a plan and buy passes — but part of
 * the catalogue: `pnpm paddle:setup` creates its product and one-off price
 * (env: PADDLE_PRICE_BID_PASS).
 */
export const BID_PASS = {
  key: "bid_pass",
  name: "Bid Pass",
  /** One-off price in GBP pence. */
  price: 9900,
  /** Full bids one pass adds. */
  fullBids: 1,
  headline: "Bid a few times a year? Pay per bid.",
  description: `One full bid, no subscription: ${FULL_BID_CONTENTS} and Word export.`,
  /** The same in fewer words, for the landing page on phones. */
  descriptionShort: `One full bid, no subscription. Everything a ${PLANS.pro.name} bid includes.`,
  /** A pass stays valid for as long as the account exists. */
  expires: false,
  cta: "Buy a Bid Pass",
} as const;

/** Name of the env var holding the Paddle price id of the Bid Pass. */
export const BID_PASS_PRICE_ENV_VAR = "PADDLE_PRICE_BID_PASS";

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (PLAN_KEYS as readonly string[]).includes(value);
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "month" || value === "year";
}

/** Rank used to label a change as upgrade or downgrade. */
export function planRank(key: PlanKey): number {
  return PLAN_KEYS.indexOf(key);
}

/** Name of the env var holding the Paddle price id, e.g. PADDLE_PRICE_STARTER_MONTHLY. */
export function paddlePriceEnvVar(plan: PaidPlanKey, interval: BillingInterval): string {
  return `PADDLE_PRICE_${plan.toUpperCase()}_${interval === "month" ? "MONTHLY" : "ANNUAL"}`;
}

/** "£29" / "£1,490" / "£24.17" — catalogue prices in pounds; pence only when not whole. */
export function formatPrice(pence: number): string {
  const pounds = pence / 100;
  const digits = Number.isInteger(pounds) ? 0 : 2;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: PLAN_CURRENCY,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(pounds);
}

/** Percentage saved by paying annually instead of 12 monthly payments. */
export function annualSavingsPercent(plan: Plan): number {
  if (!plan.prices) return 0;
  const yearlyAtMonthlyRate = plan.prices.month * 12;
  return Math.round(((yearlyAtMonthlyRate - plan.prices.year) / yearlyAtMonthlyRate) * 100);
}

/* ------------------------------------------------------------------------------------------
 * The comparison table ("Compare the plans"), derived from the limits and flags above so
 * that it cannot drift from what the product enforces.
 * --------------------------------------------------------------------------------------- */

/** A cell of the comparison table: text, true (included), false (not included) or null (does not apply). */
export type ComparisonValue = string | boolean | null;
/** The text of a cell whose limit is zero; the table sets it in muted ink. */
export const COMPARISON_NONE = "None";
export type ComparisonRow = { label: string; values: Record<PlanKey, ComparisonValue> };
export type ComparisonGroup = { title: string; rows: ComparisonRow[] };

const perPlan = (pick: (plan: Plan) => ComparisonValue): Record<PlanKey, ComparisonValue> =>
  Object.fromEntries(PLAN_KEYS.map((key) => [key, pick(PLANS[key])])) as Record<PlanKey, ComparisonValue>;

const fullBidOnly = perPlan((plan) => plan.features["bids.drafting"]);

export const PLAN_COMPARISON: ComparisonGroup[] = [
  {
    title: "Radar",
    rows: [
      { label: "Supplier page", values: perPlan(() => true) },
      { label: "Radar matches", values: perPlan((plan) => (plan.limits["radar.matches"] === null ? "All" : `Top ${plan.limits["radar.matches"]}`)) },
      { label: "Alerts", values: perPlan((plan) => (plan.features["radar.full"] ? "Daily alerts" : "Weekly digest")) },
      { label: "Buyer and competitor watchlists", values: perPlan((plan) => plan.features["radar.full"]) },
      { label: "Export", values: perPlan((plan) => plan.features.advancedExports) },
    ],
  },
  {
    title: "Bids",
    rows: [
      {
        label: "Cited bid checks",
        values: perPlan((plan) =>
          plan.features["bids.drafting"] ? "With every full bid" : plan.limits["briefs.monthly"] ? `${plan.limits["briefs.monthly"]} a month` : String(plan.limits["briefs.lifetime"] ?? 0),
        ),
      },
      { label: "Full bids a month", values: perPlan((plan) => (plan.limits["bids.monthly"] ? String(plan.limits["bids.monthly"]) : COMPARISON_NONE)) },
      { label: "Scored-question matrix", values: fullBidOnly },
      { label: "First drafts from your documents", values: fullBidOnly },
      { label: "Marking against the buyer’s scheme", values: fullBidOnly },
      { label: "Word export", values: fullBidOnly },
      { label: "Unused bids roll over one month", values: fullBidOnly },
    ],
  },
  {
    title: "Team and billing",
    rows: [
      { label: "Seats", values: perPlan((plan) => (plan.limits.seats === null ? "Unlimited" : String(plan.limits.seats))) },
      { label: "Separate client workspaces", values: perPlan((plan) => plan.features["workspaces.clients"]) },
      { label: `${TRIAL_DAYS}-day trial`, values: perPlan((plan) => Boolean(plan.trialDays)) },
      /* Nothing to pause or cancel on Free: the cell reads "Not applicable". */
      { label: "Pause or cancel in two clicks", values: perPlan((plan) => (plan.prices ? true : null)) },
    ],
  },
];
