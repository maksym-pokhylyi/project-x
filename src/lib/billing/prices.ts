import "server-only";
import {
  BILLING_INTERVALS,
  PAID_PLAN_KEYS,
  paddlePriceEnvVar,
  type BillingInterval,
  type PaidPlanKey,
} from "@/config/plans";
import { env, type ServerEnv } from "@/env";

/** Paddle price id for a plan/interval from env, or null when not configured. */
export function getPriceId(plan: PaidPlanKey, interval: BillingInterval): string | null {
  const value = env[paddlePriceEnvVar(plan, interval) as keyof ServerEnv];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export type PriceCatalogue = Record<PaidPlanKey, Record<BillingInterval, string | null>>;

/** All configured price ids. Safe to pass to the client (price ids are public). */
export function getPriceCatalogue(): PriceCatalogue {
  const catalogue = {} as PriceCatalogue;
  for (const plan of PAID_PLAN_KEYS) {
    catalogue[plan] = { month: getPriceId(plan, "month"), year: getPriceId(plan, "year") };
  }
  return catalogue;
}

/** Reverse lookup used by webhooks: which plan does this Paddle price belong to? */
export function planFromPriceId(priceId: string | null | undefined): { planKey: PaidPlanKey; interval: BillingInterval } | null {
  if (!priceId) return null;
  for (const plan of PAID_PLAN_KEYS) {
    for (const interval of BILLING_INTERVALS) {
      if (getPriceId(plan, interval) === priceId) return { planKey: plan, interval };
    }
  }
  return null;
}
