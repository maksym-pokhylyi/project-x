import { PLANS, isPlanKey, type Plan, type PlanFeatures, type PlanKey, type PlanLimits } from "@/config/plans";

/**
 * Entitlement resolution — PURE (no I/O), so it is trivially testable and can be reused
 * anywhere. `getOrgEntitlements()` in ./subscription.ts is the DB-backed wrapper.
 *
 * Rules (Paddle subscription statuses):
 *   none                 -> free
 *   active | trialing    -> subscribed plan — unless the paid period ended more than
 *                           `periodEndGraceDays` ago without any renewal reaching us
 *                           ("period_lapsed"): then free
 *   past_due             -> subscribed plan during the grace period, then free
 *   paused | canceled    -> free
 *   anything unexpected  -> free (fail closed), flagged in `source`
 *
 * Note: a subscription with a SCHEDULED cancellation keeps status "active" in Paddle
 * until the period ends, so customers keep what they paid for without extra logic here.
 *
 * Why "period_lapsed": the row only changes when a webhook arrives. If the cancellation or
 * past-due event is lost (outage, rotated secret, a payload we choke on), `active` would
 * grant the plan forever. Every renewal moves `currentPeriodEnd` forward, so an end date
 * well in the past means we are no longer hearing from Paddle about this subscription —
 * paid access stops until an event or the daily reconciliation job refreshes the row.
 * Rows without an end date (plans granted by hand) are not affected.
 */
export type SubscriptionState = {
  status: string;
  planKey: string;
  pastDueSince: Date | null;
  /** End of the period that has been paid for. Optional for backwards compatibility. */
  currentPeriodEnd?: Date | null;
};

/** Default tolerance after `currentPeriodEnd` before an active subscription stops granting its plan. */
export const DEFAULT_PERIOD_END_GRACE_DAYS = 3;

export type EntitlementSource =
  | "no_subscription"
  | "active"
  | "trialing"
  | "past_due_grace"
  | "past_due_expired"
  | "period_lapsed"
  | "paused"
  | "canceled"
  | "unknown_plan"
  | "unknown_status";

export type Entitlements = {
  /** The plan whose limits/features apply right now. */
  planKey: PlanKey;
  plan: Plan;
  limits: PlanLimits;
  features: PlanFeatures;
  /** True when a paid plan is currently being honoured. */
  isPaid: boolean;
  /** Why this plan applies. */
  source: EntitlementSource;
  /** The plan on the subscription record, even when it is not being honoured. */
  subscribedPlanKey: PlanKey | null;
  /** Only for past_due within grace: when paid access ends unless payment succeeds. */
  graceEndsAt: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function build(planKey: PlanKey, source: EntitlementSource, subscribedPlanKey: PlanKey | null, graceEndsAt: Date | null = null): Entitlements {
  const plan = PLANS[planKey];
  return {
    planKey,
    plan,
    limits: plan.limits,
    features: plan.features,
    isPaid: planKey !== "free",
    source,
    subscribedPlanKey,
    graceEndsAt,
  };
}

export function resolveEntitlements(
  subscription: SubscriptionState | null | undefined,
  options: { graceDays: number; now?: Date; periodEndGraceDays?: number },
): Entitlements {
  if (!subscription) return build("free", "no_subscription", null);

  const subscribed = isPlanKey(subscription.planKey) ? subscription.planKey : null;
  if (!subscribed) return build("free", "unknown_plan", null);

  const now = options.now ?? new Date();
  const periodEndGraceMs = (options.periodEndGraceDays ?? DEFAULT_PERIOD_END_GRACE_DAYS) * DAY_MS;
  const periodLapsed = Boolean(subscription.currentPeriodEnd) && now.getTime() > subscription.currentPeriodEnd!.getTime() + periodEndGraceMs;
  switch (subscription.status) {
    case "active":
      return periodLapsed ? build("free", "period_lapsed", subscribed) : build(subscribed, "active", subscribed);
    case "trialing":
      return periodLapsed ? build("free", "period_lapsed", subscribed) : build(subscribed, "trialing", subscribed);
    case "past_due": {
      // Without a recorded start we cannot prove the grace period is still running: fail closed.
      if (!subscription.pastDueSince) return build("free", "past_due_expired", subscribed);
      const graceEndsAt = new Date(subscription.pastDueSince.getTime() + options.graceDays * DAY_MS);
      return now < graceEndsAt
        ? build(subscribed, "past_due_grace", subscribed, graceEndsAt)
        : build("free", "past_due_expired", subscribed);
    }
    case "paused":
      return build("free", "paused", subscribed);
    case "canceled":
      return build("free", "canceled", subscribed);
    default:
      return build("free", "unknown_status", subscribed);
  }
}

/** Remaining amount for a limit, `null` when unlimited. */
export function remaining(limit: number | null, used: number): number | null {
  return limit === null ? null : Math.max(0, limit - used);
}
