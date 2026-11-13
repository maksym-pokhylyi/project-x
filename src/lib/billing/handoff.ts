import { isBillingInterval, isPlanKey, type BillingInterval, type PaidPlanKey } from "@/config/plans";

/**
 * The hand-off to Billing: the ONE address every "choose this plan" or "buy a Bid Pass"
 * control in the product points at. Plans are compared on /pricing; the purchase or change
 * is confirmed on Billing, in the panel this address opens.
 *
 *   /app/settings/billing?plan=<starter|pro|business>&interval=<month|year>
 *   /app/settings/billing?buy=bid_pass
 *
 * Signed-out visitors go through sign-up first and land on the same address:
 *   /sign-up?redirect=<the address above, encoded>
 *
 * Pure: safe to import from client components.
 */
export const BILLING_PATH = "/app/settings/billing";

export type BillingHandoff = { plan: PaidPlanKey; interval: BillingInterval } | { buy: "bid_pass" };

/** The address that opens the confirm step for a plan or a Bid Pass. */
export function billingHandoff(target: BillingHandoff): string {
  return "buy" in target ? `${BILLING_PATH}?buy=bid_pass` : `${BILLING_PATH}?plan=${target.plan}&interval=${target.interval}`;
}

/** The same for someone who has no account yet: create one, then land on the confirm step. */
export function signUpThenBilling(target: BillingHandoff): string {
  return `/sign-up?redirect=${encodeURIComponent(billingHandoff(target))}`;
}

/** Reads a hand-off back from a path with its query (the sign-up page shows what was chosen). */
export function parseBillingHandoff(path: string | null | undefined): BillingHandoff | null {
  if (!path || !path.startsWith(`${BILLING_PATH}?`)) return null;
  const query = new URLSearchParams(path.slice(BILLING_PATH.length + 1));
  if (query.get("buy") === "bid_pass") return { buy: "bid_pass" };
  const plan = query.get("plan");
  if (!isPlanKey(plan) || plan === "free") return null;
  const interval = query.get("interval");
  return { plan, interval: isBillingInterval(interval) ? interval : "month" };
}
