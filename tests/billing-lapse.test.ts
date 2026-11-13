import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { POST } from "@/app/api/webhooks/paddle/route";
import { db } from "@/db";
import { auditLog, errorLog, subscriptions, webhookEvents } from "@/db/schema";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import { reconcileSubscriptions } from "@/lib/billing/reconcile";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { enqueueJob } from "@/lib/jobs/queue";
import { runWorker } from "@/lib/jobs/worker";
import { getAdminConfigWarnings } from "@/server/admin";
import { actAs, createTestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";
import { createBillingOrg, paddleEvent, signedWebhookRequest } from "./helpers/paddle";

/**
 * F-09 — paid access must lapse without a webhook: a fail-safe on the paid period, a daily
 * reconciliation against Paddle, and refunds/chargebacks that are at least recorded.
 */
const ORG = "org_lapse";
const SUB = "sub_01hv8x29kz0t586xy6zn1a62ny";
const DAY = 86_400_000;

const deliver = async (envelope: unknown) => ((await (await POST(signedWebhookRequest(envelope))).json()) as { outcome?: string }).outcome;
const subscriptionOf = async () => (await db.select().from(subscriptions).where(eq(subscriptions.organizationId, ORG)))[0]!;

/** What `GET /subscriptions/{id}` returns for our subscription, in Paddle's wire format. */
function paddleSnapshot(overrides: Record<string, unknown>): Record<string, unknown> {
  const file = fileURLToPath(new URL("./fixtures/paddle/subscription.created.json", import.meta.url));
  const fixture = (JSON.parse(readFileSync(file, "utf8")) as { data: Record<string, unknown> & { items: Array<{ price: { id: string } }> } }).data;
  fixture.items[0]!.price.id = "pri_test_pro_monthly";
  return { ...fixture, updated_at: new Date().toISOString(), ...overrides };
}

describe("fail-safe on the paid period (F-09)", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const state = (status: string, currentPeriodEnd: Date | null) => ({ status, planKey: "pro", pastDueSince: null, currentPeriodEnd });

  it.each(["active", "trialing"])("%s: the plan is honoured through the period and a short tolerance, then lapses", (status) => {
    const options = { graceDays: 7, periodEndGraceDays: 3, now };
    expect(resolveEntitlements(state(status, new Date(now.getTime() + 10 * DAY)), options)).toMatchObject({ planKey: "pro", source: status });
    // Renewal webhooks can be a little late: 2 days past the end is still fine.
    expect(resolveEntitlements(state(status, new Date(now.getTime() - 2 * DAY)), options)).toMatchObject({ planKey: "pro", isPaid: true });
    // 4 days past the end and Paddle has said nothing: stop granting the plan.
    expect(resolveEntitlements(state(status, new Date(now.getTime() - 4 * DAY)), options)).toMatchObject({
      planKey: "free",
      isPaid: false,
      source: "period_lapsed",
      subscribedPlanKey: "pro",
    });
  });

  it("applies a default tolerance of 3 days, and leaves hand-granted plans (no period) alone", () => {
    expect(resolveEntitlements(state("active", new Date(now.getTime() - 4 * DAY)), { graceDays: 7, now }).source).toBe("period_lapsed");
    expect(resolveEntitlements(state("active", null), { graceDays: 7, now })).toMatchObject({ planKey: "pro", source: "active" });
    expect(resolveEntitlements({ status: "active", planKey: "pro", pastDueSince: null }, { graceDays: 7, now })).toMatchObject({ planKey: "pro" });
  });

  it("a workspace whose cancellation webhook was lost stops being paid on its own", async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
    await deliver(paddleEvent("subscription.created", { organizationId: ORG }));
    expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "pro", source: "active" });

    // Time passes; the subscription was cancelled in Paddle but no event ever reached us.
    await db.update(subscriptions).set({ currentPeriodEnd: new Date(Date.now() - 5 * DAY) }).where(eq(subscriptions.organizationId, ORG));
    expect((await subscriptionOf()).status).toBe("active");
    expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "free", isPaid: false, source: "period_lapsed" });
    // …and the operator is told on /admin.
    actAs(await createTestUser({ email: "founder@example.com" }));
    const flagged = (await getAdminConfigWarnings()).find((warning) => warning.code === "SUBSCRIPTIONS_LAPSED");
    expect(flagged).toMatchObject({ level: "error" });
    expect(flagged?.message).toContain("1 subscription(s)");

    // A renewal that does arrive restores it.
    await deliver(paddleEvent("subscription.updated", { organizationId: ORG, occurredAt: new Date().toISOString() }));
    expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "pro", source: "active" });
  });
});

describe("daily reconciliation with Paddle (F-09)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
    await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: "2026-11-01T10:00:00Z" }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("is a no-op when PADDLE_API_KEY is absent — also as a job", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await reconcileSubscriptions()).toEqual({ skipped: true, checked: 0, updated: 0, unchanged: 0, missing: 0, failed: 0 });
    await enqueueJob("billing.reconcile", {});
    expect(await runWorker()).toMatchObject({ claimed: 1, succeeded: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await subscriptionOf()).reconciledAt).toBeNull();
  });

  it("applies a cancellation whose webhook never arrived", async () => {
    const fetchSubscription = vi.fn(async () => paddleSnapshot({ status: "canceled", canceled_at: "2026-11-10T09:00:00Z", current_billing_period: null, scheduled_change: null, updated_at: "2026-11-10T09:00:00.123456Z" }));
    const summary = await reconcileSubscriptions({ fetchSubscription });
    expect(summary).toEqual({ skipped: false, checked: 1, updated: 1, unchanged: 0, missing: 0, failed: 0 });
    expect(fetchSubscription).toHaveBeenCalledWith(SUB);

    const row = await subscriptionOf();
    expect(row).toMatchObject({ status: "canceled", paddleSubscriptionId: SUB });
    expect(row.reconciledAt).toBeInstanceOf(Date);
    expect((await getOrgEntitlements(ORG)).planKey).toBe("free");
    // Applied through the webhook pipeline: stored, audited, idempotent.
    const [stored] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, `reconcile_${SUB}_2026-11-10T09:00:00.123456Z`));
    expect(stored).toMatchObject({ eventType: "subscription.updated", outcome: "processed" });
    expect((await db.select().from(auditLog)).map((entry) => entry.action)).toContain("billing.subscription.updated");

    // Canceled is terminal: nothing left to check tomorrow.
    expect(await reconcileSubscriptions({ fetchSubscription })).toMatchObject({ checked: 0 });
  });

  it("leaves a row that already matches Paddle untouched, apart from the check time", async () => {
    const row = await subscriptionOf();
    const auditsBefore = (await db.select().from(auditLog)).length;
    const fetchSubscription = async () =>
      paddleSnapshot({ current_billing_period: { starts_at: row.currentPeriodStart!.toISOString(), ends_at: row.currentPeriodEnd!.toISOString() } });
    expect(await reconcileSubscriptions({ fetchSubscription })).toMatchObject({ checked: 1, updated: 0, unchanged: 1 });
    expect((await db.select().from(auditLog)).length).toBe(auditsBefore);
    expect((await subscriptionOf()).reconciledAt).toBeInstanceOf(Date);
  });

  it("does not let an old snapshot overwrite a newer webhook", async () => {
    await deliver(paddleEvent("subscription.paused", { organizationId: ORG, occurredAt: "2026-11-12T10:00:00Z" }));
    const fetchSubscription = async () => paddleSnapshot({ status: "active", updated_at: "2026-11-05T00:00:00Z" });
    expect(await reconcileSubscriptions({ fetchSubscription })).toMatchObject({ checked: 1, updated: 0, unchanged: 1 });
    expect((await subscriptionOf()).status).toBe("paused");
  });

  it("reports a subscription Paddle does not know, and survives individual failures", async () => {
    await createBillingOrg("org_lapse_2");
    await deliver(paddleEvent("subscription.created", { organizationId: "org_lapse_2", mutate: (data) => void (data.id = "sub_second") }));
    const fetchSubscription = async (id: string) => {
      if (id === "sub_second") throw new Error("Paddle API answered 500 for a subscription lookup");
      return null;
    };
    expect(await reconcileSubscriptions({ fetchSubscription })).toMatchObject({ checked: 2, missing: 1, failed: 1, updated: 0 });
    expect((await db.select().from(errorLog)).some((row) => row.message.includes("Paddle does not know subscription"))).toBe(true);
    expect((await subscriptionOf()).status).toBe("active");
    // Nothing could be checked at all: the job fails so it is retried and visible.
    await expect(reconcileSubscriptions({ fetchSubscription: async () => Promise.reject(new Error("down")) })).rejects.toThrow(/could not check any/);
  });

  it("the default fetcher calls the Paddle API for the configured environment with the API key", async () => {
    vi.stubEnv("PADDLE_API_KEY", "pdl_sdbx_apikey_test");
    vi.resetModules();
    const calls: Array<{ url: string; authorization: string | null }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, authorization: new Headers(init.headers).get("authorization") });
      return Response.json({ data: paddleSnapshot({ status: "past_due", updated_at: "2026-11-12T08:00:00Z" }) });
    });
    const { reconcileSubscriptions: reconcile } = await import("@/lib/billing/reconcile");
    expect(await reconcile()).toMatchObject({ skipped: false, checked: 1, updated: 1 });
    expect(calls).toEqual([{ url: `https://sandbox-api.paddle.com/subscriptions/${SUB}`, authorization: "Bearer pdl_sdbx_apikey_test" }]);
    expect((await subscriptionOf()).status).toBe("past_due");
  });
});

describe("refunds and chargebacks are recorded and flagged (F-09)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
    await deliver(paddleEvent("subscription.created", { organizationId: ORG }));
  });

  // Shape per Paddle's adjustment entity (developer.paddle.com/api-reference/adjustments); trimmed to what we read.
  const adjustment = (action: string, status: string, eventType = "adjustment.created") => ({
    event_id: `evt_adj_${action}_${status}_${Math.random().toString(36).slice(2)}`,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    notification_id: "ntf_adj",
    data: { id: "adj_01hvgf2s84dr6reszzg29zbvcm", action, status, transaction_id: "txn_01hv8wptq8987qeep44cyrewp9", subscription_id: SUB, customer_id: "ctm_01hv6y1jedq4p1n0yqn5ba3ky4", reason: "error", currency_code: "USD", totals: { total: "7900", currency_code: "USD" } },
  });

  it("an approved refund is written to the audit log and surfaced to the operator; the status is left to a human", async () => {
    expect(await deliver(adjustment("refund", "pending_approval"))).toBe("processed");
    expect(await db.select().from(errorLog)).toHaveLength(0);
    expect(await deliver(adjustment("refund", "approved", "adjustment.updated"))).toBe("processed");

    const entries = await db.select().from(auditLog).where(eq(auditLog.action, "billing.adjustment_refund"));
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({ organizationId: ORG, target: "adjustment:adj_01hvgf2s84dr6reszzg29zbvcm", metadata: expect.objectContaining({ status: "approved", amount: "7900", currency: "USD" }) });
    const flagged = await db.select().from(errorLog);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]!.message).toContain("refund approved");
    expect(flagged[0]!.organizationId).toBe(ORG);
    expect((await subscriptionOf()).status).toBe("active");
  });

  it("a chargeback is flagged too; adjustments for unknown subscriptions are parked", async () => {
    expect(await deliver(adjustment("chargeback", "approved"))).toBe("processed");
    expect((await db.select().from(errorLog))[0]!.message).toContain("chargeback approved");
    const unknown = adjustment("refund", "approved");
    unknown.data.subscription_id = "sub_not_ours";
    expect(await deliver(unknown)).toBe("ignored_unmapped");
  });
});
