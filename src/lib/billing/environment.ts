import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { billingCheckoutNonces, billingPayments, billingPurchases, subscriptions, webhookEvents } from "@/db/schema";
import { env } from "@/env";
import { revokePurchase } from "./fulfilment";

/**
 * Test mode never mixes with live data.
 *
 * Paddle's sandbox and its live environment are two separate worlds with separate ids, but
 * our database is one. Every billing row therefore records the environment it came from
 * (PADDLE_ENV when it was written): `subscriptions.paddle_environment`,
 * `billing_payments.paddle_environment`, `billing_purchases.paddle_environment` and
 * `webhook_events.environment`. Rows from before those columns existed can only be sandbox
 * rows — live billing has never run without them — and are counted as such.
 *
 * That makes test-mode data recognisable, keeps it out of live receipts, stops a sandbox
 * event from being replayed into live state (processStoredEvent), and lets it be removed in
 * one step before going live (purgeSandboxBilling; README "Before switching PADDLE_ENV to
 * production").
 */
export type PaddleEnvironment = "sandbox" | "production";

export type BillingRowCounts = { subscriptions: number; purchases: number; payments: number; events: number };

const sandboxSubscription = sql`${isNotNull(subscriptions.paddleSubscriptionId)} and coalesce(${subscriptions.paddleEnvironment}, 'sandbox') = 'sandbox'`;
const sandboxEvent = sql`${webhookEvents.provider} = 'paddle' and coalesce(${webhookEvents.environment}, 'sandbox') = 'sandbox'`;

/** Billing rows that belong to a Paddle environment. Subscriptions granted by hand (no Paddle id) belong to none. */
export async function countBillingRows(environment: PaddleEnvironment): Promise<BillingRowCounts> {
  const count = sql<number>`count(*)::int`;
  const [[subscriptionRows], [purchaseRows], [paymentRows], [eventRows]] = await Promise.all([
    db
      .select({ value: count })
      .from(subscriptions)
      .where(sql`${isNotNull(subscriptions.paddleSubscriptionId)} and coalesce(${subscriptions.paddleEnvironment}, 'sandbox') = ${environment}`),
    db.select({ value: count }).from(billingPurchases).where(eq(billingPurchases.paddleEnvironment, environment)),
    db.select({ value: count }).from(billingPayments).where(eq(billingPayments.paddleEnvironment, environment)),
    db
      .select({ value: count })
      .from(webhookEvents)
      .where(sql`${webhookEvents.provider} = 'paddle' and coalesce(${webhookEvents.environment}, 'sandbox') = ${environment}`),
  ]);
  return { subscriptions: subscriptionRows?.value ?? 0, purchases: purchaseRows?.value ?? 0, payments: paymentRows?.value ?? 0, events: eventRows?.value ?? 0 };
}

/**
 * Rows of the environment this deployment is NOT running — after going live: sandbox
 * leftovers that still grant plans and passes and block real checkouts for their workspaces.
 */
export async function countForeignBillingRows(): Promise<BillingRowCounts & { environment: PaddleEnvironment }> {
  const environment: PaddleEnvironment = env.PADDLE_ENV === "production" ? "sandbox" : "production";
  return { environment, ...(await countBillingRows(environment)) };
}

export type SandboxPurgeSummary = BillingRowCounts & {
  dryRun: boolean;
  /** Bid Passes (or other one-off units) bought with test cards that were taken back. */
  unitsRevoked: number;
  /** Units that had already been used: what they produced stays, the purchase record goes. */
  unitsAlreadyUsed: number;
};

/**
 * Removes everything that came from the Paddle SANDBOX: subscriptions (their workspaces
 * return to Free and may start a trial again), purchases — taking back what is still unused
 * through the same hook a refund uses — payments, checkout nonces and stored events.
 * Production rows are never touched: the environment is not a parameter on purpose.
 *
 * `dryRun` (the default) only counts. Everything happens in ONE transaction.
 */
export async function purgeSandboxBilling(options: { dryRun?: boolean } = {}): Promise<SandboxPurgeSummary> {
  const dryRun = options.dryRun ?? true;
  if (dryRun) return { dryRun, unitsRevoked: 0, unitsAlreadyUsed: 0, ...(await countBillingRows("sandbox")) };

  return db.transaction(async (tx) => {
    let unitsRevoked = 0;
    let unitsAlreadyUsed = 0;
    const purchases = await tx.select().from(billingPurchases).where(eq(billingPurchases.paddleEnvironment, "sandbox")).for("update");
    for (const purchase of purchases) {
      const revocation = await revokePurchase(tx, purchase);
      unitsRevoked += revocation.revoked.length;
      unitsAlreadyUsed += revocation.kept.length;
    }
    const purchaseRows = await tx.delete(billingPurchases).where(eq(billingPurchases.paddleEnvironment, "sandbox")).returning({ id: billingPurchases.id });
    const paymentRows = await tx.delete(billingPayments).where(eq(billingPayments.paddleEnvironment, "sandbox")).returning({ id: billingPayments.id });

    const subscriptionRows = await tx.select({ id: subscriptions.id, paddleSubscriptionId: subscriptions.paddleSubscriptionId }).from(subscriptions).where(sandboxSubscription).for("update");
    const subscriptionIds = subscriptionRows.map((row) => row.paddleSubscriptionId).filter((id): id is string => id !== null);
    if (subscriptionIds.length > 0) {
      await tx.delete(billingCheckoutNonces).where(inArray(billingCheckoutNonces.paddleSubscriptionId, subscriptionIds));
      await tx.delete(subscriptions).where(and(inArray(subscriptions.id, subscriptionRows.map((row) => row.id)), sandboxSubscription));
    }
    const eventRows = await tx.delete(webhookEvents).where(sandboxEvent).returning({ id: webhookEvents.id });

    return { dryRun, unitsRevoked, unitsAlreadyUsed, subscriptions: subscriptionRows.length, purchases: purchaseRows.length, payments: paymentRows.length, events: eventRows.length };
  });
}
