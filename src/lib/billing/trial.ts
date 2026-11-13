import "server-only";
import { eq } from "drizzle-orm";
import { BILLING_INTERVALS, PAID_PLAN_KEYS, paddlePriceEnvVar, type BillingInterval, type PaidPlanKey } from "@/config/plans";
import { db, type DbOrTx } from "@/db";
import { subscriptions } from "@/db/schema";
import { env } from "@/env";
import { getPriceId, planFromPriceId } from "./prices";

/**
 * Trials are offered once per workspace.
 *
 * In Paddle a trial belongs to the PRICE (its `trial_period`), so "no second trial" means
 * sending a returning workspace to a twin price without one. The twins are optional env vars
 * named after the normal ones with a `_NOTRIAL` suffix (PADDLE_PRICE_PRO_MONTHLY_NOTRIAL,
 * PADDLE_PRICE_PRO_ANNUAL_NOTRIAL). While they are unset everybody gets the normal price —
 * and with it whatever trial that price carries.
 *
 * The webhook maps BOTH prices of a pair to the same plan (planFromCheckoutPriceId), so a
 * subscription bought on a no-trial price is never treated as an unknown price.
 */

/**
 * True only if the workspace has never had a subscription row — whatever its status, and
 * including plans granted by hand. A cancelled or paused subscription has used the trial.
 */
export async function isTrialEligible(organizationId: string, executor: DbOrTx = db): Promise<boolean> {
  const [row] = await executor.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.organizationId, organizationId)).limit(1);
  return !row;
}

/** Name of the env var holding the no-trial twin of a plan price, e.g. PADDLE_PRICE_PRO_MONTHLY_NOTRIAL. */
export function noTrialPriceEnvVar(plan: PaidPlanKey, interval: BillingInterval): string {
  return `${paddlePriceEnvVar(plan, interval)}_NOTRIAL`;
}

/** The no-trial twin of a plan price, or null when none is configured. */
export function getNoTrialPriceId(plan: PaidPlanKey, interval: BillingInterval): string | null {
  const value = (env as Record<string, unknown>)[noTrialPriceEnvVar(plan, interval)];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * The price id a new checkout for `plan`/`interval` must use: the normal price for a workspace
 * that may still have a trial, its no-trial twin for a returning one (falling back to the
 * normal price when no twin is configured). Null when the plan price itself is not configured.
 *
 *   const priceId = selectCheckoutPrice(plan, interval, { trialEligible: await isTrialEligible(ctx.organization.id) });
 */
export function selectCheckoutPrice(plan: PaidPlanKey, interval: BillingInterval, options: { trialEligible: boolean }): string | null {
  const standard = getPriceId(plan, interval);
  if (!standard || options.trialEligible) return standard;
  return getNoTrialPriceId(plan, interval) ?? standard;
}

/**
 * Which plan a subscribed price belongs to — the normal prices (planFromPriceId) AND their
 * no-trial twins. This is the lookup the webhook pipeline uses.
 */
export function planFromCheckoutPriceId(priceId: string | null | undefined): { planKey: PaidPlanKey; interval: BillingInterval } | null {
  const standard = planFromPriceId(priceId);
  if (standard || !priceId) return standard;
  for (const plan of PAID_PLAN_KEYS) {
    for (const interval of BILLING_INTERVALS) {
      if (getNoTrialPriceId(plan, interval) === priceId) return { planKey: plan, interval };
    }
  }
  return null;
}
