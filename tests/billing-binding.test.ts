import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { POST } from "@/app/api/webhooks/paddle/route";
import { db } from "@/db";
import { auditLog, billingCheckoutNonces, events, jobs, members, subscriptions, webhookEvents } from "@/db/schema";
import { signCheckoutData, verifyCheckoutData } from "@/lib/billing/checkout-signature";
import { createBillingLinks, type PaddlePortalClient } from "@/lib/billing/paddle";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { processStoredEvent } from "@/lib/billing/webhooks";
import { enqueueJob } from "@/lib/jobs/queue";
import { replayWebhookAction, retryJobAction } from "@/server/actions/admin";
import { getAdminActivity } from "@/server/admin";
import { actAs, addMember, createTestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";
import { createBillingOrg, ownerIdOf, paddleEvent, signedWebhookRequest } from "./helpers/paddle";

/**
 * F-06 — billing identity must come from the server, not from the browser that opens the
 * checkout. F-10 — out-of-order events. F-25 — replays without repeated side effects.
 */
const ORG = "org_bind_a";
const VICTIM = "org_bind_victim";
const SUB = "sub_01hv8x29kz0t586xy6zn1a62ny"; // id in the Paddle fixtures
const CUSTOMER = "ctm_01hv6y1jedq4p1n0yqn5ba3ky4";

async function deliver(envelope: unknown) {
  const response = await POST(signedWebhookRequest(envelope));
  return { status: response.status, body: (await response.json()) as { outcome?: string } };
}
const subscriptionOf = async (organizationId: string) =>
  (await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)))[0] ?? null;
const storedEvent = async (eventId: string) => (await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId)))[0]!;

describe("checkout signature", () => {
  it("round-trips and binds every field", () => {
    const signed = signCheckoutData({ organizationId: "org_1", userId: "user_1" });
    expect(verifyCheckoutData(signed)).toMatchObject({ ok: true, organizationId: "org_1", userId: "user_1", nonce: signed.nonce });
    expect(verifyCheckoutData({ ...signed, organization_id: "org_2" })).toEqual({ ok: false, reason: "bad_signature" });
    expect(verifyCheckoutData({ ...signed, user_id: "user_2" })).toEqual({ ok: false, reason: "bad_signature" });
    expect(verifyCheckoutData({ ...signed, issued_at: String(Number(signed.issued_at) + 1) })).toEqual({ ok: false, reason: "bad_signature" });
    expect(verifyCheckoutData({ ...signed, nonce: "0".repeat(32) })).toEqual({ ok: false, reason: "bad_signature" });
    expect(verifyCheckoutData({ organization_id: "org_1", user_id: "user_1" })).toEqual({ ok: false, reason: "unsigned" });
    expect(verifyCheckoutData({ ...signed, sig: 42 })).toEqual({ ok: false, reason: "malformed" });
    expect(verifyCheckoutData({ ...signed, organization_id: "org_1\norg_2" })).toEqual({ ok: false, reason: "malformed" });
    expect(verifyCheckoutData(null)).toEqual({ ok: false, reason: "absent" });
    expect(verifyCheckoutData({ user_id: "user_1" })).toEqual({ ok: false, reason: "absent" });
  });
});

describe("webhook: which workspace does a payment belong to (F-06)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
    await createBillingOrg(VICTIM);
  });

  it("forged: unsigned custom data naming a workspace attaches nothing, and is recorded", async () => {
    // What the browser console can produce: Paddle.Checkout.open({ customData: { organization_id: <any> } })
    const envelope = paddleEvent("subscription.created", { organizationId: null, mutate: (data) => void (data.custom_data = { organization_id: VICTIM, user_id: ownerIdOf(VICTIM) }) });
    const result = await deliver(envelope);
    expect(result).toMatchObject({ status: 200, body: { outcome: "ignored_unverified" } });
    expect(await subscriptionOf(VICTIM)).toBeNull();
    expect((await getOrgEntitlements(VICTIM)).planKey).toBe("free");
    const stored = await storedEvent(envelope.event_id);
    expect(stored).toMatchObject({ outcome: "ignored_unverified" });
    expect(stored.error).toMatch(/checkout data rejected \(unsigned\)/);
    expect(await db.select().from(auditLog)).toHaveLength(0);
  });

  it("forged: a made-up signature, or one made with another key, is rejected", async () => {
    for (const sig of ["A".repeat(43), signCheckoutData({ organizationId: "org_other_deploy", userId: ownerIdOf(VICTIM) }).sig]) {
      const result = await deliver(
        paddleEvent("subscription.created", { organizationId: VICTIM, mutate: (data) => void ((data.custom_data as Record<string, unknown>).sig = sig) }),
      );
      expect(result.body.outcome).toBe("ignored_unverified");
    }
    expect(await db.select().from(subscriptions)).toHaveLength(0);
  });

  it("cross-organisation: data signed for the attacker's own workspace cannot be pointed at another one", async () => {
    const envelope = paddleEvent("subscription.created", {
      organizationId: ORG, // the attacker owns ORG and gets a genuine signature for it…
      mutate: (data) => void ((data.custom_data as Record<string, unknown>).organization_id = VICTIM), // …then swaps the workspace
    });
    expect((await deliver(envelope)).body.outcome).toBe("ignored_unverified");
    expect(await subscriptionOf(VICTIM)).toBeNull();
    expect(await subscriptionOf(ORG)).toBeNull();
  });

  it("replayed: signed checkout data binds ONE subscription; reusing it for another is refused", async () => {
    const first = paddleEvent("subscription.created", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00Z" });
    const signed = first.data.custom_data as Record<string, string>;
    expect((await deliver(first)).body.outcome).toBe("processed");
    expect(await db.select().from(billingCheckoutNonces)).toMatchObject([{ nonce: signed.nonce, organizationId: ORG, paddleSubscriptionId: SUB }]);
    await deliver(paddleEvent("subscription.canceled", { organizationId: null, occurredAt: "2026-11-13T11:00:00Z" }));
    expect((await subscriptionOf(ORG))?.status).toBe("canceled");

    // Someone who kept the signed blob (say, a since-demoted owner) attaches a subscription they control.
    const replay = paddleEvent("subscription.created", {
      organizationId: null,
      occurredAt: "2026-11-13T10:30:00Z",
      mutate: (data) => {
        data.id = "sub_attacker_controlled";
        data.custom_data = signed;
      },
    });
    const result = await deliver(replay);
    expect(result.body.outcome).toBe("ignored_unverified");
    expect((await storedEvent(replay.event_id)).error).toMatch(/replayed checkout data/);
    expect(await subscriptionOf(ORG)).toMatchObject({ paddleSubscriptionId: SUB, status: "canceled" });
    // Redelivery of the ORIGINAL subscription's events is still fine.
    expect((await processStoredEvent(first.event_id, { force: true })).ok).toBe(true);
  });

  it("expired: old signed data cannot attach a new subscription", async () => {
    const envelope = paddleEvent("subscription.created", {
      organizationId: ORG,
      occurredAt: "2026-11-13T10:00:00Z",
      mutate: (data) => void (data.custom_data = signCheckoutData({ organizationId: ORG, userId: ownerIdOf(ORG), issuedAt: new Date("2026-11-11T09:00:00Z") })),
    });
    expect((await deliver(envelope)).body.outcome).toBe("ignored_unverified");
    expect((await storedEvent(envelope.event_id)).error).toMatch(/validity window/);
    expect(await subscriptionOf(ORG)).toBeNull();
  });

  it("the signer must still be an owner of the workspace", async () => {
    const member = await createTestUser({ email: "member@example.com" });
    await addMember(ORG, member, "admin");
    // Signed data for a non-owner cannot exist through startCheckoutAction; even if it did:
    expect((await deliver(paddleEvent("subscription.created", { organizationId: ORG, userId: member.id }))).body.outcome).toBe("ignored_unverified");
    // An owner who was removed after starting the checkout:
    const envelope = paddleEvent("subscription.created", { organizationId: ORG });
    await db.delete(members).where(eq(members.userId, ownerIdOf(ORG)));
    expect((await deliver(envelope)).body.outcome).toBe("ignored_unverified");
    expect(await subscriptionOf(ORG)).toBeNull();
  });

  it("a valid checkout records who signed it and marks the binding verified", async () => {
    await deliver(paddleEvent("subscription.created", { organizationId: ORG }));
    const subscription = await subscriptionOf(ORG);
    expect(subscription).toMatchObject({ paddleSubscriptionId: SUB, paddleCustomerId: CUSTOMER, checkoutUserId: ownerIdOf(ORG) });
    expect(subscription?.verifiedAt).toBeInstanceOf(Date);
  });

  it("a live subscription is never replaced by another customer's subscription", async () => {
    await deliver(paddleEvent("subscription.created", { organizationId: ORG }));
    const result = await deliver(
      paddleEvent("subscription.created", {
        organizationId: ORG, // even with a perfectly valid, fresh signature
        mutate: (data) => {
          data.id = "sub_other_customer";
          data.customer_id = "ctm_someone_else";
        },
      }),
    );
    expect(result.body.outcome).toBe("ignored_conflict");
    expect(await subscriptionOf(ORG)).toMatchObject({ paddleSubscriptionId: SUB, paddleCustomerId: CUSTOMER, status: "active" });
  });

  it("the customer bound to a subscription cannot be swapped by a later event", async () => {
    await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00Z" }));
    const result = await deliver(
      paddleEvent("subscription.updated", { organizationId: ORG, occurredAt: "2026-11-13T11:00:00Z", mutate: (data) => void (data.customer_id = "ctm_victims_customer") }),
    );
    expect(result.body.outcome).toBe("ignored_conflict");
    expect((await subscriptionOf(ORG))?.paddleCustomerId).toBe(CUSTOMER);
  });

  it("a tracked subscription cannot be moved to another workspace through custom data", async () => {
    await deliver(paddleEvent("subscription.created", { organizationId: VICTIM, occurredAt: "2026-11-13T10:00:00Z" }));
    // Unsigned or forged data is simply not authoritative: the event applies to the bound workspace.
    const unsigned = await deliver(
      paddleEvent("subscription.updated", { organizationId: null, occurredAt: "2026-11-13T11:00:00Z", priceId: "pri_test_business_monthly", mutate: (data) => void (data.custom_data = { organization_id: ORG }) }),
    );
    expect(unsigned.body.outcome).toBe("processed");
    expect((await subscriptionOf(VICTIM))?.planKey).toBe("business");
    expect(await subscriptionOf(ORG)).toBeNull();
    // Validly signed for a DIFFERENT workspace: an inconsistency — nothing changes anywhere.
    const signedElsewhere = await deliver(paddleEvent("subscription.canceled", { organizationId: ORG, occurredAt: "2026-11-13T12:00:00Z" }));
    expect(signedElsewhere.body.outcome).toBe("ignored_conflict");
    expect((await subscriptionOf(VICTIM))?.status).toBe("active");
    expect(await subscriptionOf(ORG)).toBeNull();
  });

  it("no fallback by customer id: a new subscription of a known customer needs its own signed checkout", async () => {
    await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: "2026-11-13T10:00:00Z" }));
    await deliver(paddleEvent("subscription.canceled", { organizationId: null, occurredAt: "2026-11-13T11:00:00Z" }));
    const result = await deliver(paddleEvent("subscription.created", { organizationId: null, occurredAt: "2026-11-13T12:00:00Z", mutate: (data) => void (data.id = "sub_created_in_dashboard") }));
    expect(result.body.outcome).toBe("ignored_unmapped");
    expect(await subscriptionOf(ORG)).toMatchObject({ paddleSubscriptionId: SUB, status: "canceled" });
  });

  it("transactions: forged workspace data writes nothing into the victim's audit log", async () => {
    const forged = await deliver(paddleEvent("transaction.completed", { organizationId: null, mutate: (data) => void (data.custom_data = { organization_id: VICTIM }) }));
    expect(forged.body.outcome).toBe("ignored_unverified");
    const byCustomer = await deliver(paddleEvent("transaction.completed", { organizationId: null }));
    expect(byCustomer.body.outcome).toBe("ignored_unmapped");
    expect(await db.select().from(auditLog)).toHaveLength(0);
  });

  it("ignored_unverified events are listed for the operator", async () => {
    const envelope = paddleEvent("subscription.created", { organizationId: null, mutate: (data) => void (data.custom_data = { organization_id: VICTIM }) });
    await deliver(envelope);
    const founder = await createTestUser({ email: "founder@example.com" });
    actAs(founder);
    const { webhookProblems } = await getAdminActivity();
    expect(webhookProblems.map((problem) => problem.eventId)).toContain(envelope.event_id);
  });
});

describe("webhook: out-of-order events for a re-subscriber (F-10)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
    // An old subscription that ended some time ago.
    await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: "2026-10-01T10:00:00Z" }));
    await deliver(paddleEvent("subscription.canceled", { organizationId: null, occurredAt: "2026-10-20T10:00:00Z" }));
  });

  const newSubscription = (name: "subscription.created" | "subscription.canceled", occurredAt: string) =>
    paddleEvent(name, { organizationId: ORG, occurredAt, mutate: (data) => void (data.id = "sub_new") });

  it("a `created` retried after `canceled` does not resurrect the cancelled subscription", async () => {
    // The new subscription is refunded shortly after purchase; `created` failed once and is retried late.
    const canceled = await deliver(newSubscription("subscription.canceled", "2026-11-13T10:05:00.000000Z"));
    expect(canceled.body.outcome).toBe("ignored_conflict"); // nothing live to cancel on this workspace
    const created = await deliver(newSubscription("subscription.created", "2026-11-13T10:00:00.000000Z"));
    expect(created.body.outcome).toBe("ignored_stale");
    expect(await subscriptionOf(ORG)).toMatchObject({ paddleSubscriptionId: SUB, status: "canceled" });
    expect((await getOrgEntitlements(ORG)).planKey).toBe("free");
  });

  it("the normal order still works: created, then canceled", async () => {
    expect((await deliver(newSubscription("subscription.created", "2026-11-13T10:00:00Z"))).body.outcome).toBe("processed");
    expect((await getOrgEntitlements(ORG)).isPaid).toBe(true);
    expect((await deliver(newSubscription("subscription.canceled", "2026-11-13T10:05:00Z"))).body.outcome).toBe("processed");
    expect(await subscriptionOf(ORG)).toMatchObject({ paddleSubscriptionId: "sub_new", status: "canceled" });
  });

  it("uses the index on the event's entity id (F-20)", async () => {
    const plan = await db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      return tx.execute(sql`explain select 1 from webhook_events where (payload -> 'data' ->> 'id') = 'sub_new'`);
    });
    expect(JSON.stringify(plan)).toContain("webhook_events_data_id_idx");
  });
});

describe("admin replay and retry are idempotent (F-25)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
    actAs(await createTestUser({ email: "founder@example.com" }));
  });

  it("replaying a processed payment event does not repeat its audit entry or analytics", async () => {
    await deliver(paddleEvent("subscription.created", { organizationId: ORG }));
    const payment = paddleEvent("transaction.completed", { organizationId: ORG });
    await deliver(payment);
    const audits = (await db.select().from(auditLog)).length;
    const tracked = (await db.select().from(events).where(eq(events.name, "billing.payment_succeeded"))).length;
    expect(tracked).toBe(1);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(await replayWebhookAction(payment.event_id)).toEqual({ ok: true, data: { outcome: "processed" } });
    }
    expect((await db.select().from(auditLog)).length).toBe(audits);
    expect((await db.select().from(events).where(eq(events.name, "billing.payment_succeeded"))).length).toBe(1);
  });

  it("replaying a subscription event keeps one audit entry and one 'started' event", async () => {
    const created = paddleEvent("subscription.created", { organizationId: ORG });
    await deliver(created);
    await replayWebhookAction(created.event_id);
    await replayWebhookAction(created.event_id);
    expect(await db.select().from(auditLog).where(eq(auditLog.action, "billing.subscription.created"))).toHaveLength(1);
    expect(await db.select().from(events).where(eq(events.name, "billing.subscription_started"))).toHaveLength(1);
    expect((await subscriptionOf(ORG))?.status).toBe("active");
  });

  it("does not reset a job that is running right now", async () => {
    const id = await enqueueJob("maintenance.cleanup", {});
    await db.update(jobs).set({ status: "running", lockedAt: new Date(), attempts: 1 }).where(eq(jobs.id, id!));
    expect(await retryJobAction(id)).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect((await db.select().from(jobs).where(eq(jobs.id, id!)))[0]).toMatchObject({ status: "running", attempts: 1 });
    expect(await retryJobAction("00000000-0000-4000-8000-000000000000")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

describe("Manage billing: portal sessions (F-06)", () => {
  const OWNER_EMAIL = "owner@supplier.example";

  function fakePaddle(options: { customerEmail: string; remoteCustomerId?: string }) {
    const calls = { portal: [] as Array<{ customerId: string; subscriptionIds: string[] }>, customers: [] as string[], subscriptions: [] as string[] };
    const client: PaddlePortalClient = {
      subscriptions: {
        get: async (subscriptionId) => {
          calls.subscriptions.push(subscriptionId);
          return { customerId: options.remoteCustomerId ?? CUSTOMER, managementUrls: { updatePaymentMethod: "https://paddle.example/sub/update", cancel: "https://paddle.example/sub/cancel" } };
        },
      },
      customers: {
        get: async (customerId) => {
          calls.customers.push(customerId);
          return { email: options.customerEmail };
        },
      },
      customerPortalSessions: {
        create: async (customerId, subscriptionIds) => {
          calls.portal.push({ customerId, subscriptionIds });
          return { urls: { general: { overview: "https://portal.paddle.example/overview" }, subscriptions: [{ id: SUB, cancelSubscription: "https://portal.paddle.example/cancel", updateSubscriptionPaymentMethod: "https://portal.paddle.example/update" }] } };
        },
      },
    };
    return { client, calls };
  }

  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
    await deliver(paddleEvent("subscription.created", { organizationId: ORG }));
  });

  it("opens the customer portal for the bound customer when its email is the caller's own verified address", async () => {
    const { client, calls } = fakePaddle({ customerEmail: "Owner@Supplier.example" });
    const links = await createBillingLinks(ORG, { email: OWNER_EMAIL, emailVerified: true }, client);
    expect(links).toEqual({ portalUrl: "https://portal.paddle.example/overview", updatePaymentMethodUrl: "https://portal.paddle.example/update", cancelUrl: "https://portal.paddle.example/cancel" });
    expect(calls.portal).toEqual([{ customerId: CUSTOMER, subscriptionIds: [SUB] }]);
  });

  it("never opens a portal session for a customer whose email is not the caller's (someone else's Paddle customer)", async () => {
    // The checkout was opened with customer.email = billing@victim.example and Paddle reused the victim's customer.
    const { client, calls } = fakePaddle({ customerEmail: "billing@victim.example" });
    const links = await createBillingLinks(ORG, { email: OWNER_EMAIL, emailVerified: true }, client);
    expect(calls.portal).toHaveLength(0);
    // Only this workspace's own subscription links: nothing about the customer.
    expect(links).toEqual({ portalUrl: null, updatePaymentMethodUrl: "https://paddle.example/sub/update", cancelUrl: "https://paddle.example/sub/cancel" });
  });

  it("requires the caller's email to be verified", async () => {
    const { client, calls } = fakePaddle({ customerEmail: OWNER_EMAIL });
    expect((await createBillingLinks(ORG, { email: OWNER_EMAIL, emailVerified: false }, client)).portalUrl).toBeNull();
    expect((await createBillingLinks(ORG, undefined, client)).portalUrl).toBeNull();
    expect(calls.portal).toHaveLength(0);
  });

  it("refuses a subscription that was not bound through a verified event", async () => {
    await db.update(subscriptions).set({ verifiedAt: null }).where(eq(subscriptions.organizationId, ORG)); // e.g. attached before signatures existed
    const { client, calls } = fakePaddle({ customerEmail: OWNER_EMAIL });
    await expect(createBillingLinks(ORG, { email: OWNER_EMAIL, emailVerified: true }, client)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(calls).toEqual({ portal: [], customers: [], subscriptions: [] });
  });

  it("refuses when Paddle says the subscription belongs to another customer", async () => {
    const { client, calls } = fakePaddle({ customerEmail: OWNER_EMAIL, remoteCustomerId: "ctm_not_the_bound_one" });
    await expect(createBillingLinks(ORG, { email: OWNER_EMAIL, emailVerified: true }, client)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(calls.portal).toHaveLength(0);
  });

  it("a workspace without a subscription has nothing to manage", async () => {
    await createBillingOrg("org_bind_empty");
    await expect(createBillingLinks("org_bind_empty", { email: OWNER_EMAIL, emailVerified: true }, fakePaddle({ customerEmail: OWNER_EMAIL }).client)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("startCheckoutAction signs the checkout for the session's workspace (F-06)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns custom data that verifies for exactly this workspace and user, and refuses a paused workspace", async () => {
    await resetDatabase();
    const owner = await createTestUser({ email: "owner@example.com" });
    vi.stubEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", "test_client_token");
    vi.resetModules();
    const { startCheckoutAction } = await import("@/server/actions/billing");
    const { verifyCheckoutData: verify } = await import("@/lib/billing/checkout-signature");
    actAs(owner);

    const result = await startCheckoutAction({ plan: "pro", interval: "month" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.priceId).toBe("pri_test_pro_monthly");
    expect(verify(result.data.customData)).toMatchObject({ ok: true, organizationId: owner.organizationId, userId: owner.id });
    const again = await startCheckoutAction({ plan: "pro", interval: "month" });
    expect(again.ok && again.data.customData.nonce).not.toBe(result.data.customData.nonce);

    await db.insert(subscriptions).values({ organizationId: owner.organizationId, status: "paused", planKey: "pro", paddleSubscriptionId: "sub_paused" });
    expect(await startCheckoutAction({ plan: "pro", interval: "month" })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});
