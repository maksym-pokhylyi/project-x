import { PLANS, isPlanKey, type Plan, type PlanFeatures, type PlanKey, type PlanLimits } from "@/config/plans";

/**
 * Entitlement resolution — PURE (no I/O), so it is trivially testable and can be reused
 * anywhere. `getOrgEntitlements()` in ./subscription.ts is the DB-backed wrapper.
 *
 * Rules (Paddle subscription statuses):
 *   none                 -> free
 *   active | trialing    -> subscribed plan
 *   past_due             -> subscribed plan during the grace period, then free
 *   paused | canceled    -> free
 *   anything unexpected  -> free (fail closed), flagged in `source`
 *
 * Note: a subscription with a SCHEDULED cancellation keeps status "active" in Paddle
 * until the period ends, so customers keep what they paid for without extra logic here.
 */
export type SubscriptionState = {
  status: string;
  planKey: string;
  pastDueSince: Date | null;
};

export type EntitlementSource =
  | "no_subscription"
  | "active"
  | "trialing"
  | "past_due_grace"
  | "past_due_expired"
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
  options: { graceDays: number; now?: Date },
): Entitlements {
  if (!subscription) return build("free", "no_subscription", null);

  const subscribed = isPlanKey(subscription.planKey) ? subscription.planKey : null;
  if (!subscribed) return build("free", "unknown_plan", null);

  const now = options.now ?? new Date();
  switch (subscription.status) {
    case "active":
      return build(subscribed, "active", subscribed);
    case "trialing":
      return build(subscribed, "trialing", subscribed);
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
