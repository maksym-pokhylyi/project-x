import "server-only";
import { Environment, LogLevel, Paddle } from "@paddle/paddle-node-sdk";
import type { BillingInterval, PaidPlanKey } from "@/config/plans";
import { env, features } from "@/env";
import { BillingNotConfiguredError, ConflictError } from "@/lib/errors";
import { reportError } from "@/lib/report-error";
import { getPriceId } from "./prices";
import { getSubscription, type SubscriptionRow } from "./subscription";

let client: Paddle | null = null;

/**
 * Server-side Paddle API client. Throws a typed error when PADDLE_API_KEY is absent, or
 * when billing is switched off for this deployment (sandbox credentials on real production
 * without ALLOW_SANDBOX_BILLING=1).
 */
export function getPaddle(): Paddle {
  if (!env.PADDLE_API_KEY || !features.paddleApi) throw new BillingNotConfiguredError();
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

/** The parts of the Paddle SDK used for self-service links (injectable in tests). */
export type PaddlePortalClient = {
  subscriptions: { get(subscriptionId: string): Promise<{ customerId: string; managementUrls?: { updatePaymentMethod?: string | null; cancel?: string | null } | null }> };
  customers: { get(customerId: string): Promise<{ email?: string | null }> };
  customerPortalSessions: {
    create(
      customerId: string,
      subscriptionIds: string[],
    ): Promise<{ urls: { general: { overview: string }; subscriptions: Array<{ id: string; cancelSubscription?: string | null; updateSubscriptionPaymentMethod?: string | null }> } }>;
  };
};

/**
 * Self-service billing links for a workspace.
 *
 * A Paddle customer-portal session is an authenticated session for a CUSTOMER: invoices,
 * addresses, payment methods and every subscription of that customer. It is therefore
 * created only when all of this holds:
 *  - the workspace's subscription and customer id were bound by an event carrying this
 *    server's checkout signature (`subscriptions.verified_at`) — never by browser-supplied
 *    data alone;
 *  - Paddle confirms that subscription really belongs to that customer;
 *  - the customer's e-mail in Paddle is the caller's own VERIFIED e-mail. Paddle itself
 *    lets the owner of that mailbox into the portal, so nothing more is granted. This is
 *    what stops a checkout opened with someone else's billing e-mail from yielding a
 *    session for that someone's existing Paddle customer.
 * Otherwise only the subscription's own links are returned (update payment method /
 * cancel THIS subscription), which expose nothing about the customer.
 */
export async function createBillingLinks(
  organizationId: string,
  caller?: { email: string; emailVerified: boolean } | null,
  paddle?: PaddlePortalClient,
): Promise<BillingLinks> {
  const subscription = await getSubscription(organizationId);
  if (!subscription?.paddleCustomerId || !subscription.paddleSubscriptionId) {
    throw new ConflictError("This workspace has no billing account yet. Choose a plan first.");
  }
  if (!subscription.verifiedAt) {
    throw new ConflictError("Self-service billing is not available for this subscription. Please contact support.");
  }
  const api = paddle ?? (getPaddle() as unknown as PaddlePortalClient);
  const { paddleCustomerId: customerId, paddleSubscriptionId: subscriptionId } = subscription;

  const remote = await api.subscriptions.get(subscriptionId);
  if (remote.customerId !== customerId) {
    await reportError(new Error(`Paddle reports a different customer for ${subscriptionId} than the one bound to the workspace`), {
      route: "billing:portal",
      organizationId,
    });
    throw new ConflictError("Self-service billing is not available for this subscription. Please contact support.");
  }
  const ownLinks: BillingLinks = {
    portalUrl: null,
    updatePaymentMethodUrl: remote.managementUrls?.updatePaymentMethod ?? null,
    cancelUrl: remote.managementUrls?.cancel ?? null,
  };

  if (!caller?.emailVerified) return ownLinks;
  try {
    const customer = await api.customers.get(customerId);
    if (!customer.email || customer.email.trim().toLowerCase() !== caller.email.trim().toLowerCase()) return ownLinks;
    const session = await api.customerPortalSessions.create(customerId, [subscriptionId]);
    const deepLinks = session.urls.subscriptions.find((entry) => entry.id === subscriptionId);
    return {
      portalUrl: session.urls.general.overview,
      updatePaymentMethodUrl: deepLinks?.updateSubscriptionPaymentMethod ?? ownLinks.updatePaymentMethodUrl,
      cancelUrl: deepLinks?.cancelSubscription ?? ownLinks.cancelUrl,
    };
  } catch {
    // The portal is a convenience; the subscription's own links always work.
    return ownLinks;
  }
}

/**
 * Why the plan of this subscription cannot be changed right now — a sentence for the user —
 * or null when it can. PURE: changeSubscriptionPlan() enforces it, the Billing overview shows it.
 *
 * Two of the rules are Paddle's, checked against the sandbox API (scripts/paddle-verify-sandbox.ts):
 *  - a subscription IN TRIAL cannot have its price swapped (`subscription_trialing_items_update_invalid_options`:
 *    "You can't add or remove items for a subscription in trial…");
 *  - nothing can be updated while a pause or cancellation is scheduled (`subscription_locked_pending_changes`).
 */
export function planChangeBlocker(
  subscription: Pick<SubscriptionRow, "status" | "paddleSubscriptionId" | "verifiedAt" | "cancelAt" | "pauseAt"> | null | undefined,
): string | null {
  if (!subscription?.paddleSubscriptionId || !["active", "trialing"].includes(subscription.status)) {
    return "There is no active subscription to change. Start a new one from the plans below.";
  }
  // Changing the plan charges the card behind the subscription: only for a subscription
  // that was bound to this workspace by its own owner's signed checkout.
  if (!subscription.verifiedAt) return "This subscription cannot be changed here. Please contact support.";
  if (subscription.status === "trialing") return "Your plan can be changed once your trial has ended. Until then you can keep the trial or cancel it.";
  if (subscription.cancelAt) return "This subscription is scheduled to cancel. Undo the cancellation first.";
  if (subscription.pauseAt) return "This subscription is scheduled to pause. Undo the pause first.";
  return null;
}

/**
 * Moves an existing live subscription to another plan/interval (upgrade or downgrade).
 *
 * Paddle prorates immediately: an upgrade charges the difference now, a downgrade creates
 * a credit on the customer's balance that is taken off the next payments. `prorated_immediately`
 * is also the only prorated mode Paddle allows when the billing interval changes. Our database
 * is NOT touched here — the resulting `subscription.updated` webhook is the single writer of
 * subscription state.
 */
export async function changeSubscriptionPlan(
  organizationId: string,
  plan: PaidPlanKey,
  interval: BillingInterval,
  /** The part of the Paddle SDK used here (injectable in tests). */
  paddle?: { subscriptions: { update(subscriptionId: string, body: { items: Array<{ priceId: string; quantity: number }>; prorationBillingMode: "prorated_immediately" }): Promise<unknown> } },
): Promise<void> {
  const subscription = await getSubscription(organizationId);
  const blocker = planChangeBlocker(subscription);
  if (blocker || !subscription?.paddleSubscriptionId) throw new ConflictError(blocker ?? "There is no active subscription to change.");
  const priceId = getPriceId(plan, interval);
  if (!priceId) throw new BillingNotConfiguredError();
  if (priceId === subscription.priceId) throw new ConflictError("The workspace is already on this plan.");

  await (paddle ?? getPaddle()).subscriptions.update(subscription.paddleSubscriptionId, {
    items: [{ priceId, quantity: subscription.quantity || 1 }],
    prorationBillingMode: "prorated_immediately",
  });
}
