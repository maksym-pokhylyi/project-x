import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/paddle/route";
import { db } from "@/db";
import { auditLog, errorLog, events, subscriptions, webhookEvents } from "@/db/schema";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { processStoredEvent } from "@/lib/billing/webhooks";
import { resetDatabase } from "./helpers/db";
import { createBillingOrg, paddleEvent, signedWebhookRequest, type FixtureName } from "./helpers/paddle";

const ORG = "org_webhook_a";
const OTHER_ORG = "org_webhook_b";

const createOrg = createBillingOrg;

async function deliver(envelope: unknown, options?: Parameters<typeof signedWebhookRequest>[1]) {
  const response = await POST(signedWebhookRequest(envelope, options));
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const subscriptionOf = async (organizationId: string) =>
  (await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)))[0] ?? null;
const storedEvent = async (eventId: string) => (await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId)))[0] ?? null;
const eventNames = async () => (await db.select({ name: events.name }).from(events)).map((row) => row.name);

describe("POST /api/webhooks/paddle", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createOrg(ORG);
    await createOrg(OTHER_ORG);
  });

  describe("signature verification", () => {
    it("processes a correctly signed event", async () => {
      const envelope = paddleEvent("subscription.created", { organizationId: ORG });
      const result = await deliver(envelope);
      expect(result).toEqual({ status: 200, body: { received: true, duplicate: false, outcome: "processed" } });
      expect((await storedEvent(envelope.event_id))?.processedAt).toBeInstanceOf(Date);
    });

    it("rejects an invalid signature with 401 and stores nothing", async () => {
      const envelope = paddleEvent("subscription.created", { organizationId: ORG });
      const result = await deliver(envelope, { secret: "wrong-secret" });
      expect(result.status).toBe(401);
      expect(await db.select().from(webhookEvents)).toHaveLength(0);
      expect(await subscriptionOf(ORG)).toBeNull();
    });

    it("rejects a body that was tampered with after signing", async () => {
      const envelope = paddleEvent("subscription.created", { organizationId: ORG });
      // Signature is for ORG, body claims OTHER_ORG.
      const tampered = JSON.stringify(envelope).replace(ORG, OTHER_ORG);
      const result = await deliver(envelope, { body: tampered });
      expect(result.status).toBe(401);
      expect(await db.select().from(webhookEvents)).toHaveLength(0);
      expect(await subscriptionOf(OTHER_ORG)).toBeNull();
    });

    it("rejects a missing signature header and stale timestamps", async () => {
      const envelope = paddleEvent("subscription.created", { organizationId: ORG });
      const unsigned = await POST(
        new Request("http://localhost:3000/api/webhooks/paddle", { method: "POST", body: JSON.stringify(envelope) }),
      );
      expect(unsigned.status).toBe(401);
      const stale = await deliver(envelope, { signedAt: new Date(Date.now() - 10 * 60 * 1000) });
      expect(stale.status).toBe(401);
      expect(await db.select().from(webhookEvents)).toHaveLength(0);
    });

    it("answers 400 for a signed payload that is not a Paddle event", async () => {
      const result = await deliver({ hello: "world" });
      expect(result.status).toBe(400);
      expect(await db.select().from(webhookEvents)).toHaveLength(0);
    });
  });

  describe("idempotency", () => {
    it("returns 200 for a duplicate delivery without reprocessing", async () => {
      const envelope = paddleEvent("subscription.created", { organizationId: ORG });
      expect((await deliver(envelope)).body.duplicate).toBe(false);
      const auditBefore = (await db.select().from(auditLog)).length;
      const eventsBefore = (await db.select().from(events)).length;

      const second = await deliver(envelope);
      expect(second).toEqual({ status: 200, body: { received: true, duplicate: true, outcome: "processed" } });
      expect(await db.select().from(webhookEvents)).toHaveLength(1);
      expect((await db.select().from(auditLog)).length).toBe(auditBefore);
      expect((await db.select().from(events)).length).toBe(eventsBefore);
      expect((await storedEvent(envelope.event_id))?.attempts).toBe(1);
    });

    it("handles simultaneous deliveries of the same event exactly once", async () => {
      const envelope = paddleEvent("subscription.created", { organizationId: ORG });
      const results = await Promise.all([deliver(envelope), deliver(envelope), deliver(envelope)]);
      expect(results.every((result) => result.status === 200)).toBe(true);
      expect(results.filter((result) => result.body.duplicate === false)).toHaveLength(1);
      expect(await db.select().from(subscriptions)).toHaveLength(1);
      expect(await db.select().from(auditLog)).toHaveLength(1);
    });
  });

  describe("out-of-order delivery", () => {
    it("ignores an event older than the last one applied", async () => {
      const newer = paddleEvent("subscription.canceled", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00.500000Z" });
      const older = paddleEvent("subscription.activated", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00.100000Z" });
      await deliver(newer);
      const result = await deliver(older);
      expect(result).toEqual({ status: 200, body: { received: true, duplicate: false, outcome: "ignored_stale" } });
      const subscription = await subscriptionOf(ORG);
      expect(subscription?.status).toBe("canceled");
      expect(subscription?.lastEventAt?.toISOString()).toBe("2026-11-13T10:00:00.500Z");
      expect((await storedEvent(older.event_id))?.outcome).toBe("ignored_stale");
    });

    it("orders events that differ only in microseconds", async () => {
      const later = paddleEvent("subscription.paused", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00.000900Z" });
      const earlier = paddleEvent("subscription.activated", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00.000100Z" });
      await deliver(later);
      expect((await deliver(earlier)).body.outcome).toBe("ignored_stale");
      expect((await subscriptionOf(ORG))?.status).toBe("paused");
    });

    it("applies a newer event after an older one", async () => {
      await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00Z" }));
      const result = await deliver(paddleEvent("subscription.past_due", { organizationId: ORG, occurredAt: "2026-11-13T10:05:00Z" }));
      expect(result.body.outcome).toBe("processed");
      expect((await subscriptionOf(ORG))?.status).toBe("past_due");
    });
  });

  describe("subscription state transitions (Paddle example payloads)", () => {
    it("subscription.created: creates the row from the payload and grants the plan", async () => {
      const envelope = paddleEvent("subscription.created", { organizationId: ORG });
      await deliver(envelope);
      const subscription = await subscriptionOf(ORG);
      expect(subscription).toMatchObject({
        organizationId: ORG,
        paddleSubscriptionId: "sub_01hv8x29kz0t586xy6zn1a62ny",
        paddleCustomerId: "ctm_01hv6y1jedq4p1n0yqn5ba3ky4",
        status: "active",
        planKey: "pro",
        priceId: "pri_test_pro_monthly",
        billingInterval: "month",
        quantity: 10,
        cancelAt: null,
        canceledAt: null,
        pausedAt: null,
        pastDueSince: null,
      });
      const period = envelope.data.current_billing_period as { starts_at: string; ends_at: string };
      expect(subscription?.currentPeriodStart?.toISOString()).toBe(period.starts_at);
      expect(subscription?.currentPeriodEnd?.toISOString()).toBe(period.ends_at);
      expect((await getOrgEntitlements(ORG)).planKey).toBe("pro");
      expect(await eventNames()).toContain("billing.subscription_started");
      const [audit] = await db.select().from(auditLog);
      expect(audit).toMatchObject({ organizationId: ORG, actorType: "paddle", action: "billing.subscription.created" });
    });

    it("subscription.activated: keeps the subscription active", async () => {
      await deliver(paddleEvent("subscription.created", { organizationId: ORG }));
      const result = await deliver(paddleEvent("subscription.activated", { organizationId: ORG }));
      expect(result.body.outcome).toBe("processed");
      expect(await subscriptionOf(ORG)).toMatchObject({ status: "active", planKey: "pro" });
    });

    it("subscription.trialing: grants the plan during the trial and records its end", async () => {
      await deliver(paddleEvent("subscription.trialing", { organizationId: ORG, priceId: "pri_test_starter_monthly" }));
      const subscription = await subscriptionOf(ORG);
      expect(subscription).toMatchObject({ status: "trialing", planKey: "starter" });
      expect(subscription?.trialEnd).toBeInstanceOf(Date);
      expect((await getOrgEntitlements(ORG)).source).toBe("trialing");
    });

    it("subscription.updated: follows a plan and interval change (upgrade)", async () => {
      await deliver(paddleEvent("subscription.created", { organizationId: ORG, priceId: "pri_test_starter_monthly", occurredAt: "2026-11-13T10:00:00Z" }));
      expect((await getOrgEntitlements(ORG)).planKey).toBe("starter");
      await deliver(paddleEvent("subscription.updated", { organizationId: ORG, priceId: "pri_test_business_annual", occurredAt: "2026-11-13T11:00:00Z" }));
      expect(await subscriptionOf(ORG)).toMatchObject({ status: "active", planKey: "business", billingInterval: "year", priceId: "pri_test_business_annual" });
      expect((await getOrgEntitlements(ORG)).planKey).toBe("business");
      expect(await eventNames()).toContain("billing.subscription_changed");
    });

    it("subscription.updated: records a scheduled cancellation while access continues", async () => {
      await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00Z" }));
      await deliver(
        paddleEvent("subscription.updated", {
          organizationId: ORG,
          occurredAt: "2026-11-13T11:00:00Z",
          mutate: (data) => {
            data.scheduled_change = { action: "cancel", effective_at: "2026-12-13T10:00:00Z", resume_at: null };
          },
        }),
      );
      const subscription = await subscriptionOf(ORG);
      expect(subscription?.status).toBe("active");
      expect(subscription?.cancelAt?.toISOString()).toBe("2026-12-13T10:00:00.000Z");
      expect((await getOrgEntitlements(ORG)).isPaid).toBe(true);
    });

    it("subscription.past_due: starts the grace period, then access ends when it elapses", async () => {
      await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: "2026-11-01T10:00:00Z" }));
      const recently = new Date(Date.now() - 60_000).toISOString();
      await deliver(paddleEvent("subscription.past_due", { organizationId: ORG, occurredAt: recently }));
      const subscription = await subscriptionOf(ORG);
      expect(subscription?.status).toBe("past_due");
      expect(subscription?.pastDueSince?.toISOString()).toBe(new Date(recently).toISOString());
      expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "pro", source: "past_due_grace" });
      expect(await eventNames()).toContain("billing.subscription_past_due");

      // A later past_due update must not restart the clock.
      await deliver(paddleEvent("subscription.updated", { organizationId: ORG, mutate: (data) => void (data.status = "past_due") }));
      expect((await subscriptionOf(ORG))?.pastDueSince?.toISOString()).toBe(new Date(recently).toISOString());

      await db.update(subscriptions).set({ pastDueSince: new Date(Date.now() - 8 * 86_400_000) }).where(eq(subscriptions.organizationId, ORG));
      expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "free", source: "past_due_expired" });
    });

    it("recovering from past_due clears the grace clock", async () => {
      await deliver(paddleEvent("subscription.past_due", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00Z" }));
      await deliver(paddleEvent("subscription.updated", { organizationId: ORG, occurredAt: "2026-11-13T12:00:00Z" }));
      expect(await subscriptionOf(ORG)).toMatchObject({ status: "active", pastDueSince: null });
    });

    it("subscription.paused then subscription.resumed", async () => {
      await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00Z" }));
      await deliver(paddleEvent("subscription.paused", { organizationId: ORG, occurredAt: "2026-11-13T11:00:00Z" }));
      let subscription = await subscriptionOf(ORG);
      expect(subscription?.status).toBe("paused");
      expect(subscription?.pausedAt).toBeInstanceOf(Date);
      expect((await getOrgEntitlements(ORG)).planKey).toBe("free");

      await deliver(paddleEvent("subscription.resumed", { organizationId: ORG, occurredAt: "2026-11-13T12:00:00Z" }));
      subscription = await subscriptionOf(ORG);
      expect(subscription).toMatchObject({ status: "active", pausedAt: null });
      expect((await getOrgEntitlements(ORG)).planKey).toBe("pro");
      expect(await eventNames()).toEqual(expect.arrayContaining(["billing.subscription_paused", "billing.subscription_resumed"]));
    });

    it("subscription.canceled: revokes paid access immediately", async () => {
      await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00Z" }));
      await deliver(paddleEvent("subscription.canceled", { organizationId: ORG, occurredAt: "2026-11-13T11:00:00Z" }));
      const subscription = await subscriptionOf(ORG);
      expect(subscription?.status).toBe("canceled");
      expect(subscription?.canceledAt).toBeInstanceOf(Date);
      expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "free", source: "canceled", subscribedPlanKey: "pro" });
      expect(await eventNames()).toContain("billing.subscription_canceled");
    });

    it("maps follow-up events by subscription id when custom_data is absent", async () => {
      await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00Z" }));
      const result = await deliver(paddleEvent("subscription.canceled", { organizationId: null, occurredAt: "2026-11-13T11:00:00Z" }));
      expect(result.body.outcome).toBe("processed");
      expect((await subscriptionOf(ORG))?.status).toBe("canceled");
    });

    it("falls back to free for a price id that is not in the catalogue", async () => {
      const result = await deliver(paddleEvent("subscription.created", { organizationId: ORG, priceId: "pri_not_in_catalogue" }));
      expect(result.body.outcome).toBe("processed");
      expect((await subscriptionOf(ORG))?.planKey).toBe("unknown");
      expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "free", source: "unknown_plan" });
    });

    it("re-subscribing after a cancellation replaces the old subscription", async () => {
      await deliver(paddleEvent("subscription.canceled", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00Z" }));
      const result = await deliver(
        paddleEvent("subscription.created", {
          organizationId: ORG,
          priceId: "pri_test_starter_annual",
          occurredAt: "2026-11-13T09:00:00Z", // older clock on a NEW subscription must still apply
          mutate: (data) => void (data.id = "sub_new_subscription"),
        }),
      );
      expect(result.body.outcome).toBe("processed");
      expect(await subscriptionOf(ORG)).toMatchObject({ paddleSubscriptionId: "sub_new_subscription", status: "active", planKey: "starter" });
    });
  });

  describe("transactions and customers", () => {
    it("transaction.completed: records the payment for the right workspace", async () => {
      const result = await deliver(paddleEvent("transaction.completed", { organizationId: ORG }));
      expect(result.body.outcome).toBe("processed");
      const [audit] = await db.select().from(auditLog);
      expect(audit).toMatchObject({ organizationId: ORG, action: "billing.payment_succeeded", target: "transaction:txn_01hv8wptq8987qeep44cyrewp9" });
      expect(await eventNames()).toContain("billing.payment_succeeded");
      // A payment alone never grants access; only subscription events do.
      expect(await subscriptionOf(ORG)).toBeNull();
      expect((await getOrgEntitlements(ORG)).planKey).toBe("free");
    });

    it("transaction.payment_failed: records the failure via the subscription mapping", async () => {
      await deliver(paddleEvent("subscription.created", { organizationId: ORG }));
      const result = await deliver(
        paddleEvent("transaction.payment_failed", {
          organizationId: null,
          mutate: (data) => void (data.subscription_id = "sub_01hv8x29kz0t586xy6zn1a62ny"),
        }),
      );
      expect(result.body.outcome).toBe("processed");
      const actions = (await db.select().from(auditLog)).map((row) => row.action);
      expect(actions).toContain("billing.payment_failed");
      expect(await eventNames()).toContain("billing.payment_failed");
    });

    it("customer.created/updated: keep the billing email of the linked subscription in sync", async () => {
      // customer.created arrives before the subscription exists: stored, picked up later.
      expect((await deliver(paddleEvent("customer.created"))).body.outcome).toBe("processed");
      await deliver(paddleEvent("subscription.created", { organizationId: ORG }));
      expect((await subscriptionOf(ORG))?.customerEmail).toBe("jo@example.com");

      await deliver(paddleEvent("customer.updated", { mutate: (data) => void (data.email = "billing@example.com") }));
      expect((await subscriptionOf(ORG))?.customerEmail).toBe("billing@example.com");
    });
  });

  describe("unmapped, unhandled and conflicting events", () => {
    it("acknowledges event types it does not handle", async () => {
      const envelope = paddleEvent("subscription.created", { organizationId: ORG });
      envelope.event_type = "address.created";
      const result = await deliver(envelope);
      expect(result).toEqual({ status: 200, body: { received: true, duplicate: false, outcome: "ignored_unhandled" } });
      expect(await subscriptionOf(ORG)).toBeNull();
    });

    it("does not guess a workspace: events without a mapping are parked as unmapped", async () => {
      const envelope = paddleEvent("subscription.created", { organizationId: null });
      const result = await deliver(envelope);
      expect(result.body.outcome).toBe("ignored_unmapped");
      expect(await db.select().from(subscriptions)).toHaveLength(0);
      expect((await storedEvent(envelope.event_id))?.error).toMatch(/No workspace found/);
    });

    it("ignores custom_data pointing at a workspace that does not exist", async () => {
      const result = await deliver(paddleEvent("subscription.created", { organizationId: "org_does_not_exist" }));
      expect(result.body.outcome).toBe("ignored_unmapped");
      expect(await db.select().from(subscriptions)).toHaveLength(0);
    });

    it("keeps the existing live subscription when a second one shows up for the same workspace", async () => {
      await deliver(paddleEvent("subscription.created", { organizationId: ORG, priceId: "pri_test_pro_monthly" }));
      const result = await deliver(
        paddleEvent("subscription.created", {
          organizationId: ORG,
          priceId: "pri_test_business_monthly",
          mutate: (data) => void (data.id = "sub_second_live_subscription"),
        }),
      );
      expect(result.body.outcome).toBe("ignored_conflict");
      expect(await subscriptionOf(ORG)).toMatchObject({ paddleSubscriptionId: "sub_01hv8x29kz0t586xy6zn1a62ny", planKey: "pro" });
      // Surfaced for the operator: the customer may be paying twice.
      expect((await db.select().from(errorLog)).some((row) => row.message.includes("sub_second_live_subscription"))).toBe(true);
    });
  });

  describe("failures and retries", () => {
    it("records the error, answers 500, and reprocesses when Paddle retries", async () => {
      // Force a failure inside the handler: a temporary constraint rejects the row it writes.
      await db.execute(sql`alter table subscriptions add constraint test_block_pro check (plan_key <> 'pro') not valid`);
      const envelope = paddleEvent("subscription.created", { organizationId: ORG });
      const failed = await deliver(envelope).finally(() => db.execute(sql`alter table subscriptions drop constraint test_block_pro`));
      expect(failed.status).toBe(500);
      let stored = await storedEvent(envelope.event_id);
      expect(stored).toMatchObject({ processedAt: null, outcome: null, attempts: 1 });
      // The stored error names the constraint — and none of the bound Paddle values (F-02).
      expect(stored?.error).toContain("SQLSTATE 23514");
      expect(stored?.error).toContain("test_block_pro");
      expect(stored?.error).not.toContain("ctm_01hv6y1jedq4p1n0yqn5ba3ky4");
      expect(stored?.error).not.toContain("params");
      expect(await subscriptionOf(ORG)).toBeNull();
      expect((await db.select().from(errorLog)).some((row) => row.route === "webhook:paddle")).toBe(true);

      // Cause removed; Paddle redelivers the same event id.
      const retried = await deliver(envelope);
      expect(retried).toEqual({ status: 200, body: { received: true, duplicate: false, outcome: "processed" } });
      stored = await storedEvent(envelope.event_id);
      expect(stored).toMatchObject({ outcome: "processed", error: null, attempts: 2 });
      expect(stored?.processedAt).toBeInstanceOf(Date);
      expect((await subscriptionOf(ORG))?.status).toBe("active");
    });

    it("answers 500 for a handled event type with an unusable payload, and keeps it for inspection", async () => {
      const envelope = paddleEvent("subscription.created", { organizationId: ORG, mutate: (data) => void (data.items = []) });
      const result = await deliver(envelope);
      expect(result.status).toBe(500);
      expect((await storedEvent(envelope.event_id))?.processedAt).toBeNull();
    });

    it("can be replayed by the operator without side effects (idempotent)", async () => {
      const envelope = paddleEvent("subscription.created", { organizationId: ORG });
      await deliver(envelope);
      const before = await subscriptionOf(ORG);
      const replay = await processStoredEvent(envelope.event_id, { force: true });
      expect(replay).toEqual({ ok: true, duplicate: false, outcome: "processed" });
      const after = await subscriptionOf(ORG);
      expect(after).toMatchObject({ status: before?.status, planKey: before?.planKey, paddleSubscriptionId: before?.paddleSubscriptionId });
      expect(await db.select().from(subscriptions)).toHaveLength(1);
    });
  });

  it("handles every documented fixture without error", async () => {
    const names: FixtureName[] = [
      "customer.created",
      "customer.updated",
      "transaction.payment_failed",
      "subscription.created",
      "subscription.activated",
      "transaction.completed",
      "subscription.trialing",
      "subscription.updated",
      "subscription.paused",
      "subscription.resumed",
      "subscription.past_due",
      "subscription.canceled",
    ];
    let clock = Date.parse("2026-11-13T10:00:00Z");
    for (const name of names) {
      clock += 60_000;
      const result = await deliver(paddleEvent(name, { organizationId: ORG, occurredAt: new Date(clock).toISOString() }));
      expect(result.status, name).toBe(200);
      expect(result.body.outcome, name).toBe("processed");
    }
    expect((await subscriptionOf(ORG))?.status).toBe("canceled");
    expect(await db.select().from(errorLog)).toHaveLength(0);
  });
});
