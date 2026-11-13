import "server-only";
import { eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { billingPurchases } from "@/db/schema";
// ┌─ INTEGRATION SEAM (bids module) ──────────────────────────────────────────────────────┐
// │ When the bids module is merged, import the real functions instead and delete the stub: │
// │   import { grantBidPass, revokeBidPass } from "@/features/bids/access";                │
// └────────────────────────────────────────────────────────────────────────────────────────┘
import { grantBidPass, revokeBidPass } from "./bids-access-stub";

/**
 * Fulfilment of one-off purchases: the hook between "Paddle says this was paid" and "the
 * product hands it over".
 *
 * Both functions run INSIDE the webhook's transaction (the `tx` that inserted or locked the
 * `billing_purchases` row), so a purchase and its fulfilment commit together or not at all:
 *  - fulfilPurchase() is called for a new purchase; `fulfilled_at` records that it ran. A
 *    duplicate delivery or a replay finds the row fulfilled and does nothing.
 *  - revokePurchase() is called for a FULL refund or chargeback; `revoked_at` records it.
 *    A partial refund never revokes.
 *
 * The foundation knows nothing about bids: a small switch on the product kind, and for the
 * Bid Pass two calls into the bids module (the import above is the only seam).
 */
export type PurchaseRow = typeof billingPurchases.$inferSelect;

export type FulfilmentResult = {
  /** False when nothing was done: already fulfilled, revoked, or refunded before it could be. */
  fulfilled: boolean;
  /** One stable reference per unit bought (`paddle:<transaction id>:<n>`), as passed to the product. */
  externalRefs: string[];
};

export type RevocationResult = {
  /** Units that were still unused and have been taken back. */
  revoked: string[];
  /** Units that had already been used: they stay with the customer, and the operator is told. */
  kept: string[];
};

/** How the bids module is told where a pass came from. */
export const PADDLE_GRANT_SOURCE = "paddle";

/** Stable reference of every unit of a purchase: `paddle:<transaction id>:<n>`, n = 1…quantity. */
export function purchaseExternalRefs(transactionId: string, quantity: number): string[] {
  return Array.from({ length: Math.max(0, Math.trunc(quantity)) }, (_, index) => `paddle:${transactionId}:${index + 1}`);
}

/** A purchase that was fully refunded or charged back is never handed over (again). */
const FULFILLABLE_STATUSES = new Set(["completed", "partially_refunded"]);

/**
 * Hands a paid purchase to the product. Idempotent: does nothing for a purchase that is
 * already fulfilled, revoked, or no longer paid for.
 */
export async function fulfilPurchase(tx: Tx, purchase: PurchaseRow): Promise<FulfilmentResult> {
  if (purchase.fulfilledAt || purchase.revokedAt || !FULFILLABLE_STATUSES.has(purchase.status)) return { fulfilled: false, externalRefs: [] };
  switch (purchase.kind) {
    case "bid_pass": {
      const externalRefs = await fulfilBidPass(tx, {
        organizationId: purchase.organizationId,
        transactionId: purchase.paddleTransactionId,
        quantity: purchase.quantity,
        userId: purchase.userId,
      });
      return { fulfilled: true, externalRefs };
    }
    default:
      // A catalogue entry without a fulfilment: fail the event so it is retried and visible, instead of taking money silently.
      throw new Error(`No fulfilment is implemented for the one-off product "${purchase.kind}"`);
  }
}

/**
 * Takes back what is still unused of a purchase after a FULL refund or chargeback.
 * Idempotent: a purchase that is already revoked is left alone. A purchase that was never
 * fulfilled is simply marked revoked, so that it can never be fulfilled later.
 *
 * `revoked_at` is set unless every unit had already been used (then nothing was taken back:
 * the purchase stands and the operator decides).
 */
export async function revokePurchase(tx: Tx, purchase: PurchaseRow): Promise<RevocationResult> {
  if (purchase.revokedAt) return { revoked: [], kept: [] };
  let result: RevocationResult = { revoked: [], kept: [] };
  if (purchase.fulfilledAt) {
    switch (purchase.kind) {
      case "bid_pass":
        result = await revokeBidPasses(tx, { organizationId: purchase.organizationId, transactionId: purchase.paddleTransactionId, quantity: purchase.quantity });
        break;
      default:
        throw new Error(`No revocation is implemented for the one-off product "${purchase.kind}"`);
    }
  }
  if (result.kept.length > 0 && result.revoked.length === 0) return result;
  await tx.update(billingPurchases).set({ revokedAt: new Date() }).where(eq(billingPurchases.id, purchase.id));
  return result;
}

// ---------------------------------------------------------------------------
// Bid Pass
// ---------------------------------------------------------------------------

/**
 * Grants `quantity` Bid Passes to a workspace — one per unit, each under its own external
 * reference, without an expiry (a Bid Pass lasts as long as the account) — and records the
 * hand-over on the purchase. Returns the references. `userId` (the buyer) is recorded on
 * the purchase; the grant itself belongs to the workspace.
 */
export async function fulfilBidPass(
  tx: Tx,
  input: { organizationId: string; transactionId: string; quantity: number; userId: string | null },
): Promise<string[]> {
  const externalRefs = purchaseExternalRefs(input.transactionId, input.quantity);
  for (const externalRef of externalRefs) {
    // Idempotent on externalRef: a pass that already exists is not granted twice.
    await grantBidPass(input.organizationId, { source: PADDLE_GRANT_SOURCE, externalRef, expiresAt: null }, tx);
  }
  await tx.update(billingPurchases).set({ fulfilledAt: new Date() }).where(eq(billingPurchases.paddleTransactionId, input.transactionId));
  return externalRefs;
}

/**
 * Takes back every Bid Pass of a purchase that has not been spent. A pass that was already
 * used for a bid stays with the customer (`kept`); one that no longer exists needs nothing.
 */
export async function revokeBidPasses(tx: Tx, input: { organizationId: string; transactionId: string; quantity: number }): Promise<RevocationResult> {
  const result: RevocationResult = { revoked: [], kept: [] };
  for (const externalRef of purchaseExternalRefs(input.transactionId, input.quantity)) {
    const outcome = await revokeBidPass(input.organizationId, externalRef, tx);
    if (outcome === "revoked") result.revoked.push(externalRef);
    else if (outcome === "already_used") result.kept.push(externalRef);
  }
  return result;
}
