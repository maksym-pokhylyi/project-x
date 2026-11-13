import "server-only";
import { Environment, LogLevel, Paddle } from "@paddle/paddle-node-sdk";
import type { BillingInterval, PaidPlanKey } from "@/config/plans";
import { env } from "@/env";
import { BillingNotConfiguredError, ConflictError } from "@/lib/errors";
import { getPriceId } from "./prices";
import { getSubscription } from "./subscription";

let client: Paddle | null = null;

/** Server-side Paddle API client. Throws a typed error when PADDLE_API_KEY is absent. */
export function getPaddle(): Paddle {
  if (!env.PADDLE_API_KEY) throw new BillingNotConfiguredError();
  client ??= new Paddle(env.PADDLE_API_KEY, {
    environment: env.PADDLE_ENV === "production" ? Environment.production : Environment.sandbox,
    logLevel: LogLevel.error,
  });
  return client;
}

export type BillingLinks = {
  /** Authenticated customer-portal home (invoices, payment methods, subscriptions). */
  portalUrl: string | null;
  updatePaymentMethodUrl: string | null;
  cancelUrl: string | null;
};

/**
 * Self-service billing links for a workspace.
 *
 * Preferred: a fresh, authenticated Paddle customer-portal session (links expire, so they
 * are created per click and never cached). Fallback when the portal session cannot be
 * created: the subscription's own `management_urls` (cancel / update payment method).
 */
export async function createBillingLinks(organizationId: string): Promise<BillingLinks> {
  const subscription = await getSubscription(organizationId);
  if (!subscription?.paddleCustomerId) {
    throw new ConflictError("This workspace has no billing account yet. Choose a plan first.");
  }
  const paddle = getPaddle();
  const subscriptionIds = subscription.paddleSubscriptionId ? [subscription.paddleSubscriptionId] : [];
  try {
    const session = await paddle.customerPortalSessions.create(subscription.paddleCustomerId, subscriptionIds);
    const deepLinks = session.urls.subscriptions.find((entry) => entry.id === subscription.paddleSubscriptionId);
    return {
      portalUrl: session.urls.general.overview,
      updatePaymentMethodUrl: deepLinks?.updateSubscriptionPaymentMethod ?? null,
      cancelUrl: deepLinks?.cancelSubscription ?? null,
    };
  } catch (portalError) {
    if (!subscription.paddleSubscriptionId) throw portalError;
    const remote = await paddle.subscriptions.get(subscription.paddleSubscriptionId);
    return {
      portalUrl: null,
      updatePaymentMethodUrl: remote.managementUrls?.updatePaymentMethod ?? null,
      cancelUrl: remote.managementUrls?.cancel ?? null,
    };
  }
}

/**
 * Moves an existing live subscription to another plan/interval (upgrade or downgrade).
 *
 * Paddle prorates immediately: an upgrade charges the difference now, a downgrade creates
 * a credit. `prorated_immediately` is also the only prorated mode Paddle allows when the
 * billing interval changes. Our database is NOT touched here — the resulting
 * `subscription.updated` webhook is the single writer of subscription state.
 */
export async function changeSubscriptionPlan(organizationId: string, plan: PaidPlanKey, interval: BillingInterval): Promise<void> {
  const subscription = await getSubscription(organizationId);
  if (!subscription?.paddleSubscriptionId || !["active", "trialing"].includes(subscription.status)) {
    throw new ConflictError("There is no active subscription to change. Start a new one from the plans below.");
  }
  if (subscription.cancelAt) {
    throw new ConflictError("This subscription is scheduled to cancel. Remove the cancellation in the billing portal first.");
  }
  const priceId = getPriceId(plan, interval);
  if (!priceId) throw new BillingNotConfiguredError();
  if (priceId === subscription.priceId) throw new ConflictError("The workspace is already on this plan.");

  await getPaddle().subscriptions.update(subscription.paddleSubscriptionId, {
    items: [{ priceId, quantity: subscription.quantity || 1 }],
    prorationBillingMode: "prorated_immediately",
  });
}
