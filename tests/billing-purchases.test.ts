import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

/**
 * The bids module behind the fulfilment seam, as its contract describes it: one credit per
 * external reference, granting is idempotent, a used credit cannot be revoked.
 */
const bids = vi.hoisted(() => {
  const state = {
    credits: new Map<string, { organizationId: string; used: boolean }>(),
    grants: [] as Array<{ organizationId: string; source: string; externalRef: string; expiresAt: Date | null | undefined; inTransaction: boolean }>,
    revokes: [] as string[],
  };
  return {
    state,
    grantBidPass: async (organizationId: string, grant: { source: string; externalRef?: string | null; expiresAt?: Date | null }, executor?: unknown) => {
      const externalRef = grant.externalRef ?? "";
      state.grants.push({ organizationId, source: grant.source, externalRef, expiresAt: grant.expiresAt, inTransaction: Boolean(executor) });
      if (state.credits.has(externalRef)) return false;
      state.credits.set(externalRef, { organizationId, used: false });
      return true;
    },
    revokeBidPass: async (_organizationId: string, externalRef: string) => {
      state.revokes.push(externalRef);
      const credit = state.credits.get(externalRef);
      if (!credit) return "not_found" as const;
      if (credit.used) return "already_used" as const;
      state.credits.delete(externalRef);
      return "revoked" as const;
    },
  };
});
vi.mock("@/features/bids/access", () => ({ grantBidPass: bids.grantBidPass, revokeBidPass: bids.revokeBidPass }));

import { POST } from "@/app/api/webhooks/paddle/route";
import { db } from "@/db";
import { auditLog, billingPayments, billingPurchases, errorLog, events, members, subscriptions, webhookEvents } from "@/db/schema";
import { signCheckoutData } from "@/lib/billing/checkout-signature";
import { purchaseExternalRefs } from "@/lib/billing/fulfilment";
import { ONE_OFF_PRODUCTS, getOneOffPriceId, oneOffFromPriceId } from "@/lib/billing/one-off";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { processStoredEvent } from "@/lib/billing/webhooks";
import { addMember, createTestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";
import { adjustmentEvent, createBillingOrg, oneOffPurchaseEvent, ownerIdOf, paddleEvent, signedWebhookRequest } from "./helpers/paddle";

/**
 * One-off purchases (Bid Pass): recorded only through server-signed checkout data, fulfilled
 * exactly once in the same transaction, revoked by a full refund or chargeback when unused.
 */
const ORG = "org_purchase";
const OTHER = "org_purchase_other";

async function deliver(envelope: unknown) {
  const response = await POST(signedWebhookRequest(envelope));
  return (await response.json()) as { outcome?: string; duplicate?: boolean };
}
const outcome = async (envelope: unknown) => (await deliver(envelope)).outcome;
const purchases = () => db.select().from(billingPurchases);
const purchaseOf = async (transactionId: string) => (await db.select().from(billingPurchases).where(eq(billingPurchases.paddleTransactionId, transactionId)))[0]!;
const paymentOf = async (transactionId: string) => (await db.select().from(billingPayments).where(eq(billingPayments.paddleTransactionId, transactionId)))[0]!;
const storedEvent = async (eventId: string) => (await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId)))[0]!;
const errors = () => db.select().from(errorLog);
const eventNames = async () => (await db.select({ name: events.name }).from(events)).map((row) => row.name);
const txn = (envelope: { data: { id: string } }) => envelope.data.id;

beforeEach(async () => {
  bids.state.credits.clear();
  bids.state.grants = [];
  bids.state.revokes = [];
  await resetDatabase();
  await createBillingOrg(ORG);
  await createBillingOrg(OTHER);
});

describe("the one-off catalogue", () => {
  it("maps the Bid Pass to its price id, both ways", () => {
    expect(ONE_OFF_PRODUCTS).toEqual({ bid_pass: { priceEnvVar: "PADDLE_PRICE_BID_PASS", label: "Bid Pass" } });
    expect(getOneOffPriceId("bid_pass")).toBe("pri_test_bid_pass");
    expect(oneOffFromPriceId("pri_test_bid_pass")).toBe("bid_pass");
    expect(oneOffFromPriceId("pri_test_pro_monthly")).toBeNull();
    expect(oneOffFromPriceId(null)).toBeNull();
    expect(purchaseExternalRefs("txn_1", 3)).toEqual(["paddle:txn_1:1", "paddle:txn_1:2", "paddle:txn_1:3"]);
  });
});

describe("webhook: a completed one-off transaction becomes a purchase", () => {
  it("records the purchase, the receipt and the grant — in one go — for the workspace that signed the checkout", async () => {
    const envelope = oneOffPurchaseEvent({ organizationId: ORG });
    expect(await deliver(envelope)).toEqual({ received: true, duplicate: false, outcome: "processed" });

    const purchase = await purchaseOf(txn(envelope));
    expect(purchase).toMatchObject({
      organizationId: ORG,
      userId: ownerIdOf(ORG),
      kind: "bid_pass",
      priceId: "pri_test_bid_pass",
      quantity: 1,
      amountMinor: 9900,
      currency: "GBP",
      status: "completed",
      revokedAt: null,
      paddleEnvironment: "sandbox",
    });
    expect(purchase.fulfilledAt).toBeInstanceOf(Date);
    // The stored transaction has no payment attempts (card, cardholder, PayPal address) and no checkout link.
    const raw = purchase.raw as Record<string, unknown>;
    expect(raw.id).toBe(txn(envelope));
    expect(raw).not.toHaveProperty("payments");
    expect(raw).not.toHaveProperty("checkout");
    expect(JSON.stringify(raw)).not.toContain("Sam Miller");

    // Exactly one grant, through the seam, inside the webhook's transaction, without an expiry.
    expect(bids.state.grants).toEqual([{ organizationId: ORG, source: "paddle", externalRef: `paddle:${txn(envelope)}:1`, expiresAt: null, inTransaction: true }]);

    expect(await paymentOf(txn(envelope))).toMatchObject({ organizationId: ORG, kind: "one_off", product: "bid_pass", quantity: 1, totalMinor: 9900, taxMinor: 1650, subtotalMinor: 8250, currency: "GBP", status: "completed", paddleSubscriptionId: null });
    const [audit] = await db.select().from(auditLog);
    expect(audit).toMatchObject({ organizationId: ORG, actorType: "paddle", action: "billing.purchase_completed", target: `transaction:${txn(envelope)}`, metadata: { kind: "bid_pass", quantity: 1, amount: 9900, currency: "GBP", userId: ownerIdOf(ORG), fulfilled: true } });
    expect(await eventNames()).toEqual(expect.arrayContaining(["billing.purchase_completed", "billing.payment_succeeded"]));
    // A purchase is not a subscription: the plan does not change.
    expect(await db.select().from(subscriptions)).toHaveLength(0);
    expect((await getOrgEntitlements(ORG)).planKey).toBe("free");
    expect(await errors()).toHaveLength(0);
  });

  it("grants one pass per unit, each under its own reference", async () => {
    const envelope = oneOffPurchaseEvent({ organizationId: ORG, quantity: 3 });
    expect(await outcome(envelope)).toBe("processed");
    expect(await purchaseOf(txn(envelope))).toMatchObject({ quantity: 3, amountMinor: 29700 });
    expect(bids.state.grants.map((grant) => grant.externalRef)).toEqual([1, 2, 3].map((n) => `paddle:${txn(envelope)}:${n}`));
  });

  it("works on any plan, next to a live subscription, and the buyer may be an admin or member of the workspace", async () => {
    await outcome(paddleEvent("subscription.created", { organizationId: ORG }));
    const admin = await createTestUser({ email: "admin@example.com" });
    await addMember(ORG, admin, "admin");
    const envelope = oneOffPurchaseEvent({ organizationId: ORG, userId: admin.id });
    expect(await outcome(envelope)).toBe("processed");
    expect(await purchaseOf(txn(envelope))).toMatchObject({ organizationId: ORG, userId: admin.id });
    expect(await db.select().from(subscriptions)).toMatchObject([{ status: "active", planKey: "pro" }]);
  });

  it("a duplicate delivery, simultaneous deliveries, a forced replay and a second event for the same transaction never grant twice", async () => {
    const envelope = oneOffPurchaseEvent({ organizationId: ORG });
    const results = await Promise.all([deliver(envelope), deliver(envelope), deliver(envelope)]);
    expect(results.filter((result) => result.duplicate === false)).toHaveLength(1);
    expect((await deliver(envelope)).duplicate).toBe(true);

    const audits = (await db.select().from(auditLog)).length;
    const tracked = (await db.select().from(events)).length;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(await processStoredEvent(envelope.event_id, { force: true })).toEqual({ ok: true, duplicate: false, outcome: "processed" });
    }
    // Paddle sending the completed transaction under another event id (it should not, but it must not matter).
    expect(await outcome({ ...envelope, event_id: `${envelope.event_id}_again` })).toBe("processed");

    expect(await purchases()).toHaveLength(1);
    expect(await db.select().from(billingPayments)).toHaveLength(1);
    expect(bids.state.grants).toHaveLength(1);
    expect((await db.select().from(auditLog)).length).toBe(audits);
    expect((await db.select().from(events)).length).toBe(tracked);
  });

  it("forged or unsigned checkout data records nothing, grants nothing — and the operator is told, because money was taken", async () => {
    const unsigned = oneOffPurchaseEvent({ mutate: (data) => void (data.custom_data = { organization_id: ORG, user_id: ownerIdOf(ORG) }) });
    expect(await outcome(unsigned)).toBe("ignored_unverified");
    expect((await storedEvent(unsigned.event_id)).error).toMatch(/checkout data rejected \(unsigned\)/);

    const madeUp = oneOffPurchaseEvent({ organizationId: ORG, mutate: (data) => void ((data.custom_data as Record<string, unknown>).sig = "A".repeat(43)) });
    expect(await outcome(madeUp)).toBe("ignored_unverified");

    // Signed for the attacker's own workspace, then pointed at another one.
    const crossed = oneOffPurchaseEvent({ organizationId: ORG, mutate: (data) => void ((data.custom_data as Record<string, unknown>).organization_id = OTHER) });
    expect(await outcome(crossed)).toBe("ignored_unverified");

    const anonymous = oneOffPurchaseEvent({});
    expect(await outcome(anonymous)).toBe("ignored_unmapped");
    const vanished = oneOffPurchaseEvent({ mutate: (data) => void (data.custom_data = signCheckoutData({ organizationId: "org_deleted_since", userId: ownerIdOf(ORG) })) });
    expect(await outcome(vanished)).toBe("ignored_unmapped");

    expect(await purchases()).toHaveLength(0);
    expect(await db.select().from(billingPayments)).toHaveLength(0);
    expect(await db.select().from(auditLog)).toHaveLength(0);
    expect(bids.state.grants).toHaveLength(0);
    const reported = await errors();
    expect(reported).toHaveLength(5);
    expect(reported.every((row) => row.route === "webhook:paddle" && row.message.includes("the customer was charged and nothing was granted"))).toBe(true);
    expect(reported.every((row) => row.organizationId === null)).toBe(true); // nothing is attributed to a workspace that was only NAMED
  });

  it("expired signed data, or a signer who left the workspace, is refused", async () => {
    const stale = oneOffPurchaseEvent({
      organizationId: ORG,
      occurredAt: "2026-11-13T10:00:00Z",
      mutate: (data) => void (data.custom_data = signCheckoutData({ organizationId: ORG, userId: ownerIdOf(ORG), issuedAt: new Date("2026-11-11T09:00:00Z") })),
    });
    expect(await outcome(stale)).toBe("ignored_unverified");
    expect((await storedEvent(stale.event_id)).error).toMatch(/validity window/);
    // …also when the event claims to be OLDER than its own checkout by more than the clock skew.
    const fromTheFuture = oneOffPurchaseEvent({
      organizationId: ORG,
      occurredAt: "2026-11-13T10:00:00Z",
      mutate: (data) => void (data.custom_data = signCheckoutData({ organizationId: ORG, userId: ownerIdOf(ORG), issuedAt: new Date("2026-11-13T10:30:00Z") })),
    });
    expect(await outcome(fromTheFuture)).toBe("ignored_unverified");

    const stranger = await createTestUser({ email: "stranger@example.com" });
    const notMember = oneOffPurchaseEvent({ organizationId: ORG, userId: stranger.id });
    expect(await outcome(notMember)).toBe("ignored_unverified");
    const left = oneOffPurchaseEvent({ organizationId: ORG });
    await db.delete(members).where(eq(members.userId, ownerIdOf(ORG)));
    expect(await outcome(left)).toBe("ignored_unverified");
    expect((await storedEvent(left.event_id)).error).toMatch(/not a member/);

    expect(await purchases()).toHaveLength(0);
    expect(bids.state.grants).toHaveLength(0);
    expect((await errors()).filter((row) => row.organizationId === ORG)).toHaveLength(4);
  });

  it("a price that is not in the one-off catalogue is parked as unmapped and surfaced to the operator", async () => {
    const envelope = oneOffPurchaseEvent({ organizationId: ORG, priceId: "pri_some_other_product" });
    expect(await outcome(envelope)).toBe("ignored_unmapped");
    const stored = await storedEvent(envelope.event_id);
    expect(stored).toMatchObject({ outcome: "ignored_unmapped" });
    expect(stored.processedAt).toBeInstanceOf(Date);
    expect(stored.error).toContain("pri_some_other_product");
    expect(await purchases()).toHaveLength(0);
    expect(bids.state.grants).toHaveLength(0);
    const [reported] = await errors();
    expect(reported).toMatchObject({ route: "webhook:paddle", organizationId: ORG });
    expect(reported!.message).toContain("not a price of the one-off catalogue");
    // A replay (after fixing the configuration) goes through the same checks.
    expect(await processStoredEvent(envelope.event_id, { force: true })).toMatchObject({ ok: true, outcome: "ignored_unmapped" });
  });

  it("an unusable quantity is not fulfilled blindly", async () => {
    const envelope = oneOffPurchaseEvent({ organizationId: ORG, quantity: 101 });
    expect(await outcome(envelope)).toBe("ignored_unmapped");
    expect(await purchases()).toHaveLength(0);
    expect(bids.state.grants).toHaveLength(0);
    expect((await errors())[0]!.message).toContain("unusable quantity (101)");
  });

  it("a Bid Pass inside a subscription's transaction is not fulfilled silently: the payment is recorded and the operator is told", async () => {
    await outcome(paddleEvent("subscription.created", { organizationId: ORG }));
    const envelope = oneOffPurchaseEvent({ organizationId: ORG, mutate: (data) => void (data.subscription_id = "sub_01hv8x29kz0t586xy6zn1a62ny") });
    expect(await outcome(envelope)).toBe("processed");
    expect(await purchases()).toHaveLength(0);
    expect(bids.state.grants).toHaveLength(0);
    expect(await paymentOf(txn(envelope))).toMatchObject({ kind: "subscription", organizationId: ORG });
    expect((await errors())[0]!.message).toContain("was NOT fulfilled");
  });

  it("a plan price without a subscription id is still a subscription payment, not a purchase", async () => {
    const envelope = oneOffPurchaseEvent({ organizationId: ORG, priceId: "pri_test_pro_monthly" });
    expect(await outcome(envelope)).toBe("processed");
    expect(await purchases()).toHaveLength(0);
    expect((await db.select().from(auditLog))[0]).toMatchObject({ action: "billing.payment_succeeded" });
    expect(await errors()).toHaveLength(0);
  });

  it("other items in the same transaction are flagged; the pass itself is granted", async () => {
    const envelope = oneOffPurchaseEvent({
      organizationId: ORG,
      mutate: (data) => {
        const [pass] = data.items as unknown as Array<Record<string, unknown>>;
        data.items = [pass!, { ...pass!, price: { ...(pass!.price as object), id: "pri_unknown_addon" } }] as unknown as typeof data.items;
      },
    });
    expect(await outcome(envelope)).toBe("processed");
    expect(await purchaseOf(txn(envelope))).toMatchObject({ kind: "bid_pass", quantity: 1, amountMinor: 9900 });
    expect(bids.state.grants).toHaveLength(1);
    expect((await errors())[0]!.message).toContain("1 more item(s)");
  });
});

describe("webhook: refunds and chargebacks of a one-off purchase", () => {
  async function bought(options: Parameters<typeof oneOffPurchaseEvent>[0] = {}) {
    const envelope = oneOffPurchaseEvent({ organizationId: ORG, ...options });
    expect(await outcome(envelope)).toBe("processed");
    return txn(envelope);
  }

  it("a full refund of an UNUSED pass revokes it; the pending request before it changes nothing", async () => {
    const transactionId = await bought();
    const pending = adjustmentEvent({ transactionId, status: "pending_approval", adjustmentId: "adj_refund_1" });
    expect(await outcome(pending)).toBe("processed");
    expect(await purchaseOf(transactionId)).toMatchObject({ status: "completed", revokedAt: null });
    expect(bids.state.revokes).toEqual([]);
    expect(await errors()).toHaveLength(0);

    const approved = adjustmentEvent({ transactionId, status: "approved", adjustmentId: "adj_refund_1", eventType: "adjustment.updated" });
    expect(await outcome(approved)).toBe("processed");
    const purchase = await purchaseOf(transactionId);
    expect(purchase.status).toBe("refunded");
    expect(purchase.revokedAt).toBeInstanceOf(Date);
    expect(bids.state.revokes).toEqual([`paddle:${transactionId}:1`]);
    expect(bids.state.credits.size).toBe(0);
    expect((await paymentOf(transactionId)).status).toBe("refunded");

    const audits = await db.select().from(auditLog).where(eq(auditLog.action, "billing.adjustment_refund"));
    expect(audits).toHaveLength(2);
    expect(audits[1]).toMatchObject({ organizationId: ORG, target: "adjustment:adj_refund_1", metadata: { status: "approved", transactionId, purchase: "bid_pass", purchaseStatus: "refunded", revoked: 1, kept: 0, amount: "9900", currency: "GBP" } });
    const [notice] = await errors();
    expect(notice).toMatchObject({ route: "webhook:paddle", organizationId: ORG });
    expect(notice!.message).toMatch(/Bid Pass purchase .* was refunded in full \(£99\.00\); 1 unused unit\(s\) were taken back/);
    expect(await eventNames()).toContain("billing.purchase_adjusted");
  });

  it("a pass that was already USED stays with the customer, and the operator is told", async () => {
    const transactionId = await bought();
    bids.state.credits.get(`paddle:${transactionId}:1`)!.used = true;
    expect(await outcome(adjustmentEvent({ transactionId }))).toBe("processed");
    const purchase = await purchaseOf(transactionId);
    expect(purchase).toMatchObject({ status: "refunded", revokedAt: null }); // refunded, but nothing could be taken back
    expect(bids.state.credits.size).toBe(1);
    expect((await errors())[0]!.message).toMatch(/1 of 1 had already been used and stay with the customer/);
    expect((await db.select().from(auditLog).where(eq(auditLog.action, "billing.adjustment_refund")))[0]!.metadata).toMatchObject({ revoked: 0, kept: 1 });
  });

  it("of several passes, the unused ones are taken back and the used ones reported", async () => {
    const transactionId = await bought({ quantity: 3 });
    bids.state.credits.get(`paddle:${transactionId}:2`)!.used = true;
    expect(await outcome(adjustmentEvent({ transactionId, total: 29700 }))).toBe("processed");
    expect((await purchaseOf(transactionId)).revokedAt).toBeInstanceOf(Date);
    expect([...bids.state.credits.keys()]).toEqual([`paddle:${transactionId}:2`]);
    expect((await errors())[0]!.message).toMatch(/1 of 3 had already been used .*\(2 taken back\)/);
  });

  it("a partial refund never revokes: it is flagged", async () => {
    const transactionId = await bought();
    expect(await outcome(adjustmentEvent({ transactionId, type: "partial", total: 3000 }))).toBe("processed");
    expect(await purchaseOf(transactionId)).toMatchObject({ status: "partially_refunded", revokedAt: null });
    expect(bids.state.revokes).toEqual([]);
    expect((await paymentOf(transactionId)).status).toBe("partially_refunded");
    expect((await errors())[0]!.message).toMatch(/partial refund approved \(£30\.00\); nothing was revoked/);
    // A second partial refund does not turn it into "refunded" either.
    await outcome(adjustmentEvent({ transactionId, type: "partial", total: 3000, adjustmentId: "adj_second_partial" }));
    expect(await purchaseOf(transactionId)).toMatchObject({ status: "partially_refunded", revokedAt: null });
  });

  it("an adjustment that covers the whole amount is a full refund, whatever its `type` says", async () => {
    const transactionId = await bought();
    expect(await outcome(adjustmentEvent({ transactionId, type: "partial", total: 9900 }))).toBe("processed");
    expect((await purchaseOf(transactionId)).status).toBe("refunded");
    expect(bids.state.revokes).toHaveLength(1);
    const other = await bought();
    expect(await outcome(adjustmentEvent({ transactionId: other, type: null, total: 100, adjustmentId: "adj_typeless" }))).toBe("processed");
    expect((await purchaseOf(other)).status).toBe("partially_refunded"); // no type and a small amount: partial
  });

  it("a chargeback marks the purchase disputed and revokes it; a reversal makes the payment stand again", async () => {
    const transactionId = await bought();
    expect(await outcome(adjustmentEvent({ transactionId, action: "chargeback_warning", adjustmentId: "adj_warning" }))).toBe("processed");
    expect(await purchaseOf(transactionId)).toMatchObject({ status: "completed", revokedAt: null });
    expect((await errors())[0]!.message).toContain("chargeback warning received");

    expect(await outcome(adjustmentEvent({ transactionId, action: "chargeback", adjustmentId: "adj_chargeback" }))).toBe("processed");
    const disputed = await purchaseOf(transactionId);
    expect(disputed.status).toBe("disputed");
    expect(disputed.revokedAt).toBeInstanceOf(Date);
    expect((await paymentOf(transactionId)).status).toBe("disputed");

    expect(await outcome(adjustmentEvent({ transactionId, action: "chargeback_reverse", adjustmentId: "adj_reverse" }))).toBe("processed");
    expect((await purchaseOf(transactionId)).status).toBe("completed");
    expect((await paymentOf(transactionId)).status).toBe("completed");
    expect((await errors()).at(-1)!.message).toMatch(/chargeback was reversed, the payment stands again — it was revoked earlier: restore it by hand/);
    expect((await db.select().from(auditLog)).map((row) => row.action)).toEqual(expect.arrayContaining(["billing.adjustment_chargeback_warning", "billing.adjustment_chargeback", "billing.adjustment_chargeback_reverse"]));
  });

  it("duplicates and forced replays of a refund revoke once and report once", async () => {
    const transactionId = await bought();
    const refund = adjustmentEvent({ transactionId });
    expect(await outcome(refund)).toBe("processed");
    expect((await deliver(refund)).duplicate).toBe(true);
    const before = { audits: (await db.select().from(auditLog)).length, errors: (await errors()).length, tracked: (await db.select().from(events)).length };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(await processStoredEvent(refund.event_id, { force: true })).toEqual({ ok: true, duplicate: false, outcome: "processed" });
    }
    expect(bids.state.revokes).toHaveLength(1);
    expect({ audits: (await db.select().from(auditLog)).length, errors: (await errors()).length, tracked: (await db.select().from(events)).length }).toEqual(before);
    // Replaying the PURCHASE after its refund does not hand the pass out again.
    const [purchaseEvent] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventType, "transaction.completed"));
    expect(await processStoredEvent(purchaseEvent!.eventId, { force: true })).toMatchObject({ ok: true, outcome: "processed" });
    expect(bids.state.grants).toHaveLength(1);
    expect(bids.state.credits.size).toBe(0);
  });

  it("out of order: a refund that was RECEIVED before the payment event means nothing is granted", async () => {
    const envelope = oneOffPurchaseEvent({ organizationId: ORG });
    const transactionId = txn(envelope);
    // The payment event failed for a while; meanwhile the customer was refunded.
    expect(await outcome(adjustmentEvent({ transactionId, status: "pending_approval", adjustmentId: "adj_early" }))).toBe("ignored_unmapped");
    expect(await outcome(adjustmentEvent({ transactionId, status: "approved", adjustmentId: "adj_early", eventType: "adjustment.updated" }))).toBe("ignored_unmapped");

    expect(await outcome(envelope)).toBe("processed");
    const purchase = await purchaseOf(transactionId);
    expect(purchase).toMatchObject({ status: "refunded", fulfilledAt: null });
    expect(purchase.revokedAt).toBeInstanceOf(Date);
    expect(bids.state.grants).toHaveLength(0);
    expect((await paymentOf(transactionId)).status).toBe("refunded");
    expect((await db.select().from(auditLog))[0]).toMatchObject({ action: "billing.purchase_completed", metadata: { status: "refunded", fulfilled: false } });
    expect((await errors()).at(-1)!.message).toContain("was refunded or disputed before its payment event was processed: nothing was granted");
    // No later replay can fulfil it.
    expect(await processStoredEvent(envelope.event_id, { force: true })).toMatchObject({ ok: true, outcome: "processed" });
    expect(bids.state.grants).toHaveLength(0);
  });

  it("out of order: an earlier PARTIAL refund does not stop the fulfilment", async () => {
    const envelope = oneOffPurchaseEvent({ organizationId: ORG });
    await outcome(adjustmentEvent({ transactionId: txn(envelope), type: "partial", total: 1000 }));
    expect(await outcome(envelope)).toBe("processed");
    const purchase = await purchaseOf(txn(envelope));
    expect(purchase.status).toBe("partially_refunded");
    expect(purchase.fulfilledAt).toBeInstanceOf(Date);
    expect(bids.state.grants).toHaveLength(1);
  });

  it("an adjustment for a transaction nobody recorded is parked; the lookup of earlier refunds uses its index", async () => {
    expect(await outcome(adjustmentEvent({ transactionId: "txn_never_seen_here" }))).toBe("ignored_unmapped");
    expect(await purchases()).toHaveLength(0);
    const plan = await db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      return tx.execute(sql`explain select payload from webhook_events where event_type like 'adjustment.%' and (payload -> 'data' ->> 'transaction_id') = 'txn_x'`);
    });
    expect(JSON.stringify(plan)).toContain("webhook_events_adjustment_transaction_idx");
  });

  it("the refund of a SUBSCRIPTION payment marks its receipt and leaves the subscription to the operator", async () => {
    await outcome(paddleEvent("subscription.created", { organizationId: ORG }));
    const payment = paddleEvent("transaction.completed", { organizationId: ORG });
    await outcome(payment);
    expect((await paymentOf(txn(payment))).status).toBe("completed");
    expect(await outcome(adjustmentEvent({ transactionId: txn(payment), subscriptionId: "sub_01hv8x29kz0t586xy6zn1a62ny", total: 65215 }))).toBe("processed");
    expect((await paymentOf(txn(payment))).status).toBe("refunded");
    expect((await db.select().from(subscriptions))[0]!.status).toBe("active");
    expect((await errors())[0]!.message).toContain("refund approved");
  });
});
