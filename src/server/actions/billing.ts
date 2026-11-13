"use server";

import { isBillingInterval, type BillingInterval, type PaidPlanKey } from "@/config/plans";
import { features } from "@/env";
import { track } from "@/lib/analytics";
import { recordAudit } from "@/lib/audit";
import { changeSubscriptionPlan, createBillingLinks, type BillingLinks } from "@/lib/billing/paddle";
import { getPriceId } from "@/lib/billing/prices";
import { BillingNotConfiguredError, ConflictError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { changePlanSchema, parseInput } from "@/lib/validation";
import { runAction, type ActionResult } from "../http";
import { requireOrg } from "../session";

export type CheckoutParams = {
  priceId: string;
  customerEmail: string;
  /** Echoed back by Paddle in webhooks; this is how a payment is tied to a workspace. */
  customData: { organization_id: string; user_id: string };
};

/**
 * Prepares an overlay checkout for the ACTIVE workspace (owner only).
 * The browser only receives values derived from the session: it cannot choose which
 * workspace a payment is attributed to.
 */
export async function startCheckoutAction(input: unknown): Promise<ActionResult<CheckoutParams>> {
  return runAction("billing.start_checkout", async () => {
    const ctx = await requireOrg({ role: "owner" });
    const parsed = parseInput(changePlanSchema, input);
    const plan = parsed.plan as PaidPlanKey;
    const interval: BillingInterval = isBillingInterval(parsed.interval) ? parsed.interval : "month";
    if (!features.paddleCheckout) throw new BillingNotConfiguredError();
    const priceId = getPriceId(plan, interval);
    if (!priceId) throw new BillingNotConfiguredError();
    if (ctx.subscription && ["active", "trialing", "past_due"].includes(ctx.subscription.status)) {
      throw new ConflictError("This workspace already has a subscription. Change the plan instead of starting a new one.");
    }
    await enforceRateLimit(`checkout:${ctx.organization.id}`, { limit: 20, windowSeconds: 3600 });
    await track("billing.checkout_started", { organizationId: ctx.organization.id, userId: ctx.user.id }, { plan, interval });
    return {
      priceId,
      customerEmail: ctx.user.email,
      customData: { organization_id: ctx.organization.id, user_id: ctx.user.id },
    };
  });
}

/** Creates fresh Paddle customer-portal links for the active workspace (owner only). */
export async function openBillingPortalAction(): Promise<ActionResult<BillingLinks>> {
  return runAction("billing.open_portal", async () => {
    const ctx = await requireOrg({ role: "owner" });
    await enforceRateLimit(`portal:${ctx.organization.id}`, { limit: 30, windowSeconds: 3600 });
    const links = await createBillingLinks(ctx.organization.id);
    await track("billing.portal_opened", { organizationId: ctx.organization.id, userId: ctx.user.id });
    return links;
  });
}

/**
 * Upgrades/downgrades the existing subscription (owner only). The local subscription row
 * changes only when Paddle's `subscription.updated` webhook arrives.
 */
export async function changePlanAction(input: unknown): Promise<ActionResult> {
  return runAction("billing.change_plan", async () => {
    const ctx = await requireOrg({ role: "owner" });
    const parsed = parseInput(changePlanSchema, input);
    const plan = parsed.plan as PaidPlanKey;
    const interval: BillingInterval = isBillingInterval(parsed.interval) ? parsed.interval : "month";
    await enforceRateLimit(`change-plan:${ctx.organization.id}`, { limit: 10, windowSeconds: 3600 });
    await changeSubscriptionPlan(ctx.organization.id, plan, interval);
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: { type: "user", id: ctx.user.id },
      action: "billing.plan_change_requested",
      target: ctx.subscription?.paddleSubscriptionId ? `subscription:${ctx.subscription.paddleSubscriptionId}` : null,
      metadata: { from: ctx.subscription?.planKey ?? null, to: plan, interval },
    });
    return undefined;
  });
}
