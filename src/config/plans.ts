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
export const QUOTA_METRICS = {
  units: {
    label: "Units",
    description: "Placeholder metric. Rename to whatever your product meters (documents, reports, API calls…).",
    period: "month",
  },
} as const satisfies Record<string, { label: string; description: string; period: "month" | "lifetime" }>;

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
  /** Price in USD cents per billing interval; `null` for the free plan. */
  prices: Record<BillingInterval, number> | null;
  limits: PlanLimits;
  features: PlanFeatures;
  /** Marketing bullet points for pricing cards. */
  highlights: string[];
  /** Visually emphasised on the pricing page. */
  recommended?: boolean;
};

export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: "free",
    name: "Free",
    description: "Try the product with a small workspace.",
    prices: null,
    limits: { seats: 2, units: 50, aiMonthlyBudgetUsd: 0.5 },
    features: { apiAccess: false, advancedExports: false, auditLog: false, prioritySupport: false },
    highlights: ["2 seats", "50 units / month", "Community support"],
  },
  starter: {
    key: "starter",
    name: "Starter",
    description: "For small teams getting real work done.",
    prices: { month: 2900, year: 29000 },
    limits: { seats: 5, units: 1000, aiMonthlyBudgetUsd: 5 },
    features: { apiAccess: false, advancedExports: true, auditLog: false, prioritySupport: false },
    highlights: ["5 seats", "1,000 units / month", "Advanced exports", "Email support"],
  },
  pro: {
    key: "pro",
    name: "Pro",
    description: "For growing teams that rely on it daily.",
    prices: { month: 7900, year: 79000 },
    limits: { seats: 15, units: 10000, aiMonthlyBudgetUsd: 25 },
    features: { apiAccess: true, advancedExports: true, auditLog: true, prioritySupport: false },
    highlights: ["15 seats", "10,000 units / month", "API access", "Audit log"],
    recommended: true,
  },
  business: {
    key: "business",
    name: "Business",
    description: "For organisations with higher volume and support needs.",
    prices: { month: 19900, year: 199000 },
    limits: { seats: 50, units: 100000, aiMonthlyBudgetUsd: 100 },
    features: { apiAccess: true, advancedExports: true, auditLog: true, prioritySupport: true },
    highlights: ["50 seats", "100,000 units / month", "Priority support", "Everything in Pro"],
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

/** "$29" / "$290" — whole-dollar display for catalogue prices. */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
  }).format(dollars);
}

/** Percentage saved by paying annually instead of 12 monthly payments. */
export function annualSavingsPercent(plan: Plan): number {
  if (!plan.prices) return 0;
  const yearlyAtMonthlyRate = plan.prices.month * 12;
  return Math.round(((yearlyAtMonthlyRate - plan.prices.year) / yearlyAtMonthlyRate) * 100);
}
