"use server";

import { isBillingInterval, type BillingInterval, type PaidPlanKey } from "@/config/plans";
import { features } from "@/env";
import { track } from "@/lib/analytics";
import { recordAudit } from "@/lib/audit";
import { signCheckoutData, type SignedCheckoutData } from "@/lib/billing/checkout-signature";
import { changeSubscriptionPlan, createBillingLinks, type BillingLinks } from "@/lib/billing/paddle";
import { isTrialEligible, selectCheckoutPrice } from "@/lib/billing/trial";
import { BillingNotConfiguredError, ConflictError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { changePlanSchema, parseInput } from "@/lib/validation";
import { runAction, type ActionResult } from "../http";
import { requireOrg } from "../session";

export type CheckoutParams = {
  priceId: string;
  customerEmail: string;
  /**
   * Echoed back by Paddle in webhooks; this is how a payment is tied to a workspace.
   * Signed by the server (HMAC over workspace, user, time and a single-use nonce): the
   * webhook attaches a subscription to a workspace only with a valid signature for it.
   */
  customData: SignedCheckoutData;
};

/**
 * Prepares an overlay checkout for the ACTIVE workspace (owner only).
 * The browser receives values derived from the session, and cannot usefully change them:
 * custom data naming another workspace fails signature verification in the webhook.
 */
export async function startCheckoutAction(input: unknown): Promise<ActionResult<CheckoutParams>> {
  return runAction("billing.start_checkout", async () => {
    const ctx = await requireOrg({ role: "owner" });
    const parsed = parseInput(changePlanSchema, input);
    const plan = parsed.plan as PaidPlanKey;
    const interval: BillingInterval = isBillingInterval(parsed.interval) ? parsed.interval : "month";
    if (!features.paddleCheckout) throw new BillingNotConfiguredError();
    // First subscription of a workspace may start with the trial price; a returning workspace gets the no-trial twin.
    const priceId = selectCheckoutPrice(plan, interval, { trialEligible: await isTrialEligible(ctx.organization.id) });
    if (!priceId) throw new BillingNotConfiguredError();
    if (ctx.subscription && ["active", "trialing", "past_due"].includes(ctx.subscription.status)) {
      throw new ConflictError("This workspace already has a subscription. Change the plan instead of starting a new one.");
    }
    if (ctx.subscription?.status === "paused" && ctx.subscription.paddleSubscriptionId) {
      // A second subscription next to a paused one would bill twice when the first resumes.
      throw new ConflictError("This workspace has a paused subscription. Resume or cancel it under “Manage billing” before starting a new one.");
    }
    await enforceRateLimit(`checkout:${ctx.organization.id}`, { limit: 20, windowSeconds: 3600 });
    await track("billing.checkout_started", { organizationId: ctx.organization.id, userId: ctx.user.id }, { plan, interval });
    return {
      priceId,
      customerEmail: ctx.user.email,
      customData: signCheckoutData({ organizationId: ctx.organization.id, userId: ctx.user.id }),
    };
  });
}

/** Creates fresh Paddle customer-portal links for the active workspace (owner only). */
export async function openBillingPortalAction(): Promise<ActionResult<BillingLinks>> {
  return runAction("billing.open_portal", async () => {
    const ctx = await requireOrg({ role: "owner" });
    await enforceRateLimit(`portal:${ctx.organization.id}`, { limit: 30, windowSeconds: 3600 });
    const links = await createBillingLinks(ctx.organization.id, ctx.user);
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
