/**
 * Plan catalogue — the single source of truth for pricing, limits and feature flags.
 *
 * Pure data: safe to import from client components, scripts and tests.
 * Paddle price ids are NOT stored here; they come from env (see `paddlePriceEnvVar`)
 * so sandbox and production can use different ids. `pnpm paddle:setup` creates the
 * products/prices in Paddle from this file and prints the env lines.
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
    description: "Placeholder metric. Rename to whatever your product meters (documents, reports, API calls…).",
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
} & Record<QuotaMetric, number | null>;

/** Boolean feature flags. */
export type PlanFeatures = {
  apiAccess: boolean;
  advancedExports: boolean;
  auditLog: boolean;
  prioritySupport: boolean;
};

export const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  apiAccess: "API access",
  advancedExports: "Advanced exports",
  auditLog: "Audit log",
  prioritySupport: "Priority support",
};

export type Plan = {
  key: PlanKey;
  name: string;
  description: string;
  /** Price in GBP pence per billing interval; `null` for the free plan. */
  prices: Record<BillingInterval, number> | null;
  limits: PlanLimits;
  features: PlanFeatures;
  /** Marketing bullet points for pricing cards. */
  highlights: string[];
  /** Visually emphasised on the pricing page. */
  recommended?: boolean;
};

/** ISO 4217 code of the currency every catalogue price is stated in. */
export const PLAN_CURRENCY = "GBP";

/*
 * The four plan KEYS are the foundation's (free / starter / pro / business) and must not be
 * renamed: subscriptions, env vars and Paddle custom data refer to them. Their display
 * names are the real Bidfolio plans:
 *
 *   free      -> Free            £0
 *   starter   -> Radar Pro       £29 / month,  £290 / year
 *   pro       -> Bid Desk        £149 / month, £1,490 / year
 *   business  -> Bid Desk Plus   £349 / month, £3,490 / year
 *
 * Annual billing is two months free. The one-off Bid Pass (£99, one full bid) is not a
 * subscription plan; its display data lives in src/config/plan-display.ts, together with
 * the comparison table. `units` is still the foundation's placeholder quota metric.
 */
export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: "free",
    name: "Free",
    description: "Your supplier page, kept up to date.",
    prices: null,
    limits: { seats: 1, units: 50, aiMonthlyBudgetUsd: 0.5 },
    features: { apiAccess: false, advancedExports: false, auditLog: false, prioritySupport: false },
    highlights: [
      "Your public contract wins on one page",
      "Your top 10 open tenders like your past work, with deadlines",
      "Rival contracts ending soon, and buyers in your trade",
      "Weekly digest by email",
      "1 cited bid check, free",
    ],
  },
  starter: {
    key: "starter",
    name: "Radar Pro",
    description: "Hear about the right tenders the day they are published.",
    prices: { month: 2900, year: 29000 },
    limits: { seats: 2, units: 1000, aiMonthlyBudgetUsd: 5 },
    features: { apiAccess: false, advancedExports: true, auditLog: false, prioritySupport: false },
    highlights: [
      "Everything in Free",
      "Every matching tender, across up to 5 radar profiles",
      "Daily email alerts for new matching tenders",
      "Watchlists for rivals and buyers",
      "Export to CSV",
      "1 cited bid check a month",
      "2 seats",
    ],
  },
  pro: {
    key: "pro",
    name: "Bid Desk",
    description: "From tender pack to marked first draft.",
    prices: { month: 14900, year: 149000 },
    limits: { seats: 3, units: 10000, aiMonthlyBudgetUsd: 25 },
    features: { apiAccess: true, advancedExports: true, auditLog: true, prioritySupport: false },
    highlights: [
      "Everything in Radar Pro",
      "3 full bids a month; unused bids roll over one month",
      "Cited bid check: every requirement quoted and cited",
      "Scored questions with weightings and word limits",
      "First-draft answers from your own documents",
      "Evaluator-style marking of each answer",
      "Export to Word",
      "3 seats",
    ],
    recommended: true,
  },
  business: {
    key: "business",
    name: "Bid Desk Plus",
    description: "For teams and bid writers with several bids on the go.",
    prices: { month: 34900, year: 349000 },
    limits: { seats: 10, units: 100000, aiMonthlyBudgetUsd: 100 },
    features: { apiAccess: true, advancedExports: true, auditLog: true, prioritySupport: true },
    highlights: [
      "Everything in Bid Desk",
      "10 full bids a month; unused bids roll over one month",
      "A separate workspace for each client",
      "10 seats for your team",
    ],
  },
};

export const PAID_PLAN_KEYS = PLAN_KEYS.filter((key): key is PaidPlanKey => key !== "free");

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
