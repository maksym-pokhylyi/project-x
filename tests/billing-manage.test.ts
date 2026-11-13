import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

/** A stand-in for the Paddle SDK client: records every call, answers like Paddle, or fails on demand. */
const paddle = vi.hoisted(() => {
  type Call = { method: string; subscriptionId: string; body: unknown };
  const state = { calls: [] as Call[], fail: null as unknown, scheduledChange: null as { action: string; effectiveAt: string } | null };
  const answer = async (method: string, subscriptionId: string, body: unknown) => {
    state.calls.push({ method, subscriptionId, body });
    if (state.fail) throw state.fail;
    return { status: "active", scheduledChange: state.scheduledChange };
  };
  const client = {
    subscriptions: {
      pause: (id: string, body: unknown) => answer("pause", id, body),
      resume: (id: string, body: unknown) => answer("resume", id, body),
      cancel: (id: string, body: unknown) => answer("cancel", id, body),
      update: (id: string, body: unknown) => answer("update", id, body),
    },
  };
  return { state, client };
});
vi.mock("@/lib/billing/paddle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/paddle")>()),
  getPaddle: () => paddle.client,
}));

import { POST } from "@/app/api/webhooks/paddle/route";
import { db } from "@/db";
import { auditLog, errorLog, events, subscriptions, webhookEvents } from "@/db/schema";
import { verifyCheckoutData } from "@/lib/billing/checkout-signature";
import {
  BillingManageError,
  cancelSubscription,
  decideManageAction,
  pauseSubscription,
  resumeSubscription,
  undoScheduledChange,
  type ManageableSubscription,
} from "@/lib/billing/manage";
import { describePaddleFailure } from "@/lib/billing/paddle-errors";
import { reconcileSubscriptions } from "@/lib/billing/reconcile";
import { listReceipts } from "@/lib/billing/receipts";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { processStoredEvent } from "@/lib/billing/webhooks";
import {
  cancelSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  undoScheduledChangeAction,
} from "@/server/actions/billing-manage";
import { requireOrg } from "@/server/session";
import { actAs, addMember, createTestUser, type TestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";
import { createBillingOrg, paddleEvent, sandboxLifecycle, signedWebhookRequest } from "./helpers/paddle";

/**
 * Pause / resume / cancel / undo: the rules (decideManageAction), the Paddle calls they turn
 * into, the Server Actions around them, and what the webhook then records — replayed from
 * the events the Paddle sandbox really emitted (tests/fixtures/paddle/sandbox-*-lifecycle.json).
 */
const DAY = 86_400_000;
const ORG = "org_manage";
const SUB = "sub_01hv8x29kz0t586xy6zn1a62ny"; // id in Paddle's documented fixtures

const deliver = async (envelope: unknown) => ((await (await POST(signedWebhookRequest(envelope))).json()) as { outcome?: string }).outcome;
const rowOf = async (organizationId: string) => (await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)))[0]!;
const eventNames = async () => (await db.select({ name: events.name }).from(events)).map((row) => row.name);

beforeEach(() => {
  paddle.state.calls = [];
  paddle.state.fail = null;
  paddle.state.scheduledChange = null;
});

describe("decideManageAction: what each action does, and every refusal", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const periodEnd = new Date("2026-12-13T10:00:00Z");
  const subscription = (overrides: Partial<ManageableSubscription> = {}): ManageableSubscription => ({
    status: "active",
    paddleSubscriptionId: SUB,
    verifiedAt: new Date("2026-11-01T00:00:00Z"),
    cancelAt: null,
    pauseAt: null,
    currentPeriodEnd: periodEnd,
    trialEnd: null,
    ...overrides,
  });
  const decide = (action: Parameters<typeof decideManageAction>[0], overrides?: Partial<ManageableSubscription> | null) =>
    decideManageAction(action, overrides === null ? null : subscription(overrides), now);

  it("pauses and cancels at the end of the paid period", () => {
    expect(decide("pause")).toEqual({ ok: true, step: { kind: "pause_at_period_end" }, effectiveAt: periodEnd });
    expect(decide("cancel")).toEqual({ ok: true, step: { kind: "cancel_at_period_end" }, effectiveAt: periodEnd });
  });

  it("in a trial, pause and cancel take effect when the trial ends", () => {
    const trialEnd = new Date("2026-11-27T10:00:00Z");
    expect(decide("pause", { status: "trialing", trialEnd })).toEqual({ ok: true, step: { kind: "pause_at_period_end" }, effectiveAt: trialEnd });
    expect(decide("cancel", { status: "trialing", trialEnd })).toEqual({ ok: true, step: { kind: "cancel_at_period_end" }, effectiveAt: trialEnd });
  });

  it("a cancellation replaces a scheduled pause; a pause never replaces a scheduled cancellation", () => {
    expect(decide("cancel", { pauseAt: periodEnd })).toMatchObject({ ok: true, step: { kind: "cancel_at_period_end" } });
    const refused = decide("pause", { cancelAt: periodEnd });
    expect(refused).toMatchObject({ ok: false, reason: "cancel_scheduled" });
    expect(!refused.ok && refused.message).toContain("13 December 2026");
    expect(decide("pause", { pauseAt: periodEnd })).toMatchObject({ ok: false, reason: "pause_scheduled" });
    expect(decide("cancel", { cancelAt: periodEnd })).toMatchObject({ ok: false, reason: "cancel_scheduled" });
  });

  it("undo and resume remove a scheduled change", () => {
    expect(decide("undo", { cancelAt: periodEnd })).toEqual({ ok: true, step: { kind: "remove_scheduled_change", change: "cancel" }, effectiveAt: null });
    expect(decide("undo", { pauseAt: periodEnd })).toEqual({ ok: true, step: { kind: "remove_scheduled_change", change: "pause" }, effectiveAt: null });
    expect(decide("resume", { pauseAt: periodEnd })).toEqual({ ok: true, step: { kind: "remove_scheduled_change", change: "pause" }, effectiveAt: null });
    expect(decide("undo")).toMatchObject({ ok: false, reason: "nothing_scheduled" });
    expect(decide("undo", { status: "paused" })).toMatchObject({ ok: false, reason: "nothing_scheduled" });
    expect(decide("resume")).toMatchObject({ ok: false, reason: "nothing_to_resume" });
    expect(decide("resume", { cancelAt: periodEnd })).toMatchObject({ ok: false, reason: "nothing_to_resume" });
  });

  it("a paused subscription resumes at once — charged only when the paid period is over — and can only be cancelled at once", () => {
    expect(decide("resume", { status: "paused", currentPeriodEnd: new Date(now.getTime() - DAY) })).toEqual({ ok: true, step: { kind: "resume_now", billing: "new_period" }, effectiveAt: null });
    expect(decide("resume", { status: "paused", currentPeriodEnd: null })).toMatchObject({ step: { kind: "resume_now", billing: "new_period" } });
    expect(decide("resume", { status: "paused", currentPeriodEnd: new Date(now.getTime() + DAY) })).toMatchObject({ step: { kind: "resume_now", billing: "continue_period" } });
    expect(decide("cancel", { status: "paused" })).toEqual({ ok: true, step: { kind: "cancel_now" }, effectiveAt: null });
    expect(decide("pause", { status: "paused" })).toMatchObject({ ok: false, reason: "already_paused" });
  });

  it("past due: no pause (nothing paid to pause at the end of), cancel takes effect at once", () => {
    expect(decide("pause", { status: "past_due" })).toMatchObject({ ok: false, reason: "past_due" });
    expect(decide("cancel", { status: "past_due" })).toEqual({ ok: true, step: { kind: "cancel_now" }, effectiveAt: null });
    expect(decide("undo", { status: "past_due", cancelAt: periodEnd })).toMatchObject({ ok: true, step: { kind: "remove_scheduled_change", change: "cancel" } });
  });

  it("refuses everything without a subscription that Paddle knows and that was bound by a signed checkout", () => {
    for (const action of ["pause", "resume", "cancel", "undo"] as const) {
      expect(decide(action, null)).toMatchObject({ ok: false, reason: "no_subscription" });
      expect(decide(action, { paddleSubscriptionId: null })).toMatchObject({ ok: false, reason: "no_subscription" }); // a plan granted by hand
      expect(decide(action, { verifiedAt: null })).toMatchObject({ ok: false, reason: "not_manageable" });
      expect(decide(action, { status: "canceled" })).toMatchObject({ ok: false, reason: "ended" });
      expect(decide(action, { status: "something_new" })).toMatchObject({ ok: false, reason: "not_manageable" });
      const refusal = decide(action, { status: "canceled" });
      expect(!refusal.ok && refusal.message.length).toBeGreaterThan(20); // a sentence for the user, not a code
    }
  });
});

describe("pause / resume / cancel / undo against Paddle (fake client)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
    await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: new Date(Date.now() - 3_600_000).toISOString() }));
  });

  const scheduled = (action: "pause" | "cancel", occurredAt = new Date(Date.now() - 60_000).toISOString()) =>
    paddleEvent("subscription.updated", {
      organizationId: null,
      occurredAt,
      mutate: (data) => {
        data.id = SUB;
        data.scheduled_change = { items: null, action, resume_at: null, effective_at: "2026-12-13T10:00:00Z" };
      },
    });

  it("pause asks Paddle to pause at the end of the billing period — and does NOT write our database", async () => {
    paddle.state.scheduledChange = { action: "pause", effectiveAt: "2026-12-13T10:00:00Z" };
    const before = await rowOf(ORG);
    const result = await pauseSubscription(ORG);
    expect(paddle.state.calls).toEqual([{ method: "pause", subscriptionId: SUB, body: { effectiveFrom: "next_billing_period" } }]);
    expect(result).toEqual({ action: "pause", step: "pause_at_period_end", change: null, billing: null, subscriptionId: SUB, planKey: "pro", effectiveAt: "2026-12-13T10:00:00Z" });
    // The webhook is the single writer: nothing changed locally, nothing was audited by the library.
    expect(await rowOf(ORG)).toEqual(before);
    expect((await rowOf(ORG)).pauseAt).toBeNull();
  });

  it("cancel asks for the end of the billing period; undo and resume send `scheduledChange: null`", async () => {
    await cancelSubscription(ORG);
    expect(paddle.state.calls.at(-1)).toEqual({ method: "cancel", subscriptionId: SUB, body: { effectiveFrom: "next_billing_period" } });

    expect(await deliver(scheduled("pause"))).toBe("processed");
    expect((await resumeSubscription(ORG)).change).toBe("pause");
    expect(paddle.state.calls.at(-1)).toEqual({ method: "update", subscriptionId: SUB, body: { scheduledChange: null } });
    await undoScheduledChange(ORG);
    expect(paddle.state.calls.at(-1)).toEqual({ method: "update", subscriptionId: SUB, body: { scheduledChange: null } });
    // With a pause scheduled, cancel is ONE call: Paddle replaces the scheduled pause.
    await cancelSubscription(ORG);
    expect(paddle.state.calls.at(-1)).toEqual({ method: "cancel", subscriptionId: SUB, body: { effectiveFrom: "next_billing_period" } });
  });

  it("a paused subscription: resume charges for a new period only when the paid one is over; cancel is immediate", async () => {
    await db.update(subscriptions).set({ status: "paused", pausedAt: new Date(), currentPeriodEnd: new Date(Date.now() - DAY) }).where(eq(subscriptions.organizationId, ORG));
    expect(await resumeSubscription(ORG)).toMatchObject({ step: "resume_now", billing: "new_period" });
    expect(paddle.state.calls.at(-1)).toEqual({ method: "resume", subscriptionId: SUB, body: { effectiveFrom: "immediately", onResume: "start_new_billing_period" } });

    await db.update(subscriptions).set({ currentPeriodEnd: new Date(Date.now() + 10 * DAY) }).where(eq(subscriptions.organizationId, ORG));
    expect(await resumeSubscription(ORG)).toMatchObject({ billing: "continue_period" });
    expect(paddle.state.calls.at(-1)?.body).toEqual({ effectiveFrom: "immediately", onResume: "continue_existing_billing_period" });

    await cancelSubscription(ORG);
    expect(paddle.state.calls.at(-1)).toEqual({ method: "cancel", subscriptionId: SUB, body: { effectiveFrom: "immediately" } });
  });

  it("a past-due subscription is cancelled immediately and cannot be paused", async () => {
    await db.update(subscriptions).set({ status: "past_due", pastDueSince: new Date() }).where(eq(subscriptions.organizationId, ORG));
    await expect(pauseSubscription(ORG)).rejects.toMatchObject({ code: "CONFLICT", status: 409, reason: "past_due" });
    await cancelSubscription(ORG);
    expect(paddle.state.calls).toEqual([{ method: "cancel", subscriptionId: SUB, body: { effectiveFrom: "immediately" } }]);
  });

  it("every local refusal is a typed error with a readable message, and Paddle is not called", async () => {
    await deliver(scheduled("cancel"));
    const attempts: Array<[() => Promise<unknown>, string]> = [
      [() => pauseSubscription(ORG), "cancel_scheduled"],
      [() => cancelSubscription(ORG), "cancel_scheduled"],
      [() => resumeSubscription(ORG), "nothing_to_resume"],
      [() => pauseSubscription("org_without_subscription"), "no_subscription"],
    ];
    for (const [attempt, reason] of attempts) {
      const error = await attempt().then(
        () => null,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(BillingManageError);
      expect(error).toMatchObject({ code: "CONFLICT", status: 409, reason, details: { reason } });
      expect((error as Error).message).toMatch(/^[A-Z].+\.$/);
    }
    // Not bound by a signed checkout (e.g. attached by hand): no self-service.
    await db.update(subscriptions).set({ verifiedAt: null, cancelAt: null }).where(eq(subscriptions.organizationId, ORG));
    await expect(cancelSubscription(ORG)).rejects.toMatchObject({ reason: "not_manageable" });
    await db.update(subscriptions).set({ verifiedAt: new Date(), status: "canceled" }).where(eq(subscriptions.organizationId, ORG));
    await expect(undoScheduledChange(ORG)).rejects.toMatchObject({ reason: "ended" });
    expect(paddle.state.calls).toEqual([]);
  });

  it("Paddle refusing: its reason reaches the user, sanitised; nothing is reported as our error", async () => {
    // The shape the SDK throws (ApiError); this code and text are what the sandbox answered for a second scheduled change.
    // (The SDK's ApiError uses Paddle's `detail` as its message.)
    const detail = "Cannot update subscription, pending scheduled changes for billing@customer.example.";
    paddle.state.fail = Object.assign(new Error(detail), { type: "request_error", code: "subscription_locked_pending_changes", detail, status: 400 });
    const error = await pauseSubscription(ORG).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BillingManageError);
    expect(error).toMatchObject({ code: "CONFLICT", status: 409, reason: "paddle_refused", details: { reason: "paddle_refused", paddleCode: "subscription_locked_pending_changes" } });
    expect((error as Error).message).toContain("Paddle could not pause the subscription: Cannot update subscription, pending scheduled changes");
    expect((error as Error).message).not.toContain("customer.example"); // errorReason() scrubs addresses
    expect(await db.select().from(errorLog)).toHaveLength(0);
  });

  it("Paddle not knowing the subscription, or not answering, is reported to the operator and told apart for the user", async () => {
    // Verified against the sandbox: an unknown subscription id answers 404 `invalid_url`.
    paddle.state.fail = Object.assign(new Error("URL called is invalid."), { type: "request_error", code: "invalid_url", detail: "URL called is invalid.", status: 404 });
    await expect(cancelSubscription(ORG)).rejects.toMatchObject({ reason: "paddle_not_found", status: 409 });
    paddle.state.fail = new TypeError("fetch failed");
    const unavailable = await cancelSubscription(ORG).catch((caught: unknown) => caught);
    expect(unavailable).toMatchObject({ reason: "paddle_unavailable", status: 503 });
    expect((unavailable as Error).message).toContain("Check this page again");
    paddle.state.fail = Object.assign(new Error("Internal error"), { code: "internal_error", detail: "Internal error", status: 500 });
    await expect(cancelSubscription(ORG)).rejects.toMatchObject({ reason: "paddle_unavailable" });
    const reported = await db.select().from(errorLog);
    expect(reported).toHaveLength(3);
    expect(reported.every((row) => row.route === "billing:manage" && row.organizationId === ORG)).toBe(true);
  });

  it("describePaddleFailure classifies what the SDK throws", () => {
    const apiError = (status: number | null, code: string) => Object.assign(new Error("Something about jo@example.com"), { code, detail: "Something about jo@example.com", status });
    expect(describePaddleFailure(apiError(400, "subscription_not_active"))).toEqual({ kind: "refused", code: "subscription_not_active", status: 400, reason: "Something about [email]" });
    expect(describePaddleFailure(apiError(404, "invalid_url")).kind).toBe("not_found");
    expect(describePaddleFailure(apiError(404, "not_found")).kind).toBe("not_found");
    for (const status of [401, 403, 429, 500, 503, null]) expect(describePaddleFailure(apiError(status, "whatever")).kind).toBe("unavailable");
    expect(describePaddleFailure(new TypeError("fetch failed"))).toMatchObject({ kind: "unavailable", code: null, status: null });
  });
});

describe("billing management Server Actions", () => {
  let owner: TestUser;
  let admin: TestUser;
  let member: TestUser;

  beforeEach(async () => {
    await resetDatabase();
    owner = await createTestUser({ email: "owner@example.com" });
    admin = await createTestUser({ email: "admin@example.com" });
    member = await createTestUser({ email: "member@example.com" });
    await db.insert(subscriptions).values({
      organizationId: owner.organizationId,
      status: "active",
      planKey: "pro",
      priceId: "pri_test_pro_monthly",
      billingInterval: "month",
      paddleSubscriptionId: "sub_actions",
      paddleCustomerId: "ctm_actions",
      verifiedAt: new Date(),
      currentPeriodStart: new Date(Date.now() - DAY),
      currentPeriodEnd: new Date(Date.now() + 29 * DAY),
    });
    actAs(owner);
  });

  /** Makes `user` act inside the owner's workspace with a role. */
  async function joinAs(user: TestUser, role: "admin" | "member") {
    const { auth } = await import("@/lib/auth");
    await addMember(owner.organizationId, user, role);
    await auth.api.setActiveOrganization({ headers: new Headers({ cookie: user.cookie }), body: { organizationId: owner.organizationId } });
    actAs(user);
  }

  it("the owner pauses: Paddle is called, the request is audited and tracked, the row waits for the webhook", async () => {
    paddle.state.scheduledChange = { action: "pause", effectiveAt: "2026-12-13T10:00:00Z" };
    const result = await pauseSubscriptionAction();
    expect(result).toEqual({
      ok: true,
      data: { action: "pause", step: "pause_at_period_end", change: null, billing: null, subscriptionId: "sub_actions", planKey: "pro", effectiveAt: "2026-12-13T10:00:00Z" },
    });
    expect(paddle.state.calls).toEqual([{ method: "pause", subscriptionId: "sub_actions", body: { effectiveFrom: "next_billing_period" } }]);
    const [audit] = await db.select().from(auditLog).where(eq(auditLog.action, "billing.pause_requested"));
    expect(audit).toMatchObject({ organizationId: owner.organizationId, actorType: "user", actorId: owner.id, target: "subscription:sub_actions", metadata: { step: "pause_at_period_end", effectiveAt: "2026-12-13T10:00:00Z", plan: "pro" } });
    expect(await eventNames()).toContain("billing.pause_requested");
    expect((await rowOf(owner.organizationId)).pauseAt).toBeNull();
  });

  it("cancel, undo and resume are audited and tracked under their own names", async () => {
    expect(await cancelSubscriptionAction()).toMatchObject({ ok: true, data: { step: "cancel_at_period_end" } });
    await db.update(subscriptions).set({ cancelAt: new Date(Date.now() + 29 * DAY) }).where(eq(subscriptions.organizationId, owner.organizationId));
    expect(await undoScheduledChangeAction()).toMatchObject({ ok: true, data: { step: "remove_scheduled_change", change: "cancel" } });
    await db.update(subscriptions).set({ cancelAt: null, status: "paused", currentPeriodEnd: new Date(Date.now() - DAY) }).where(eq(subscriptions.organizationId, owner.organizationId));
    expect(await resumeSubscriptionAction()).toMatchObject({ ok: true, data: { step: "resume_now", billing: "new_period" } });

    expect((await db.select().from(auditLog)).map((row) => row.action)).toEqual(["billing.cancel_requested", "billing.scheduled_change_undo_requested", "billing.resume_requested"]);
    expect(await eventNames()).toEqual(expect.arrayContaining(["billing.cancel_requested", "billing.scheduled_change_undone", "billing.resume_requested"]));
    const tracked = await db.select().from(events).where(eq(events.name, "billing.cancel_requested"));
    expect(tracked[0]).toMatchObject({ organizationId: owner.organizationId, userId: owner.id, properties: { plan: "pro", effective: "period_end" } });
  });

  it("is for owners only", async () => {
    await joinAs(admin, "admin");
    for (const action of [pauseSubscriptionAction, resumeSubscriptionAction, cancelSubscriptionAction, undoScheduledChangeAction]) {
      expect(await action()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    await joinAs(member, "member");
    expect(await cancelSubscriptionAction()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    actAs(null);
    expect(await cancelSubscriptionAction()).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
    expect(paddle.state.calls).toEqual([]);
    expect(await db.select().from(auditLog)).toHaveLength(0);
  });

  it("acts on the session's workspace only: any input — such as another organization's id — is rejected", async () => {
    expect(await cancelSubscriptionAction({ organizationId: admin.organizationId })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await pauseSubscriptionAction("sub_actions")).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await pauseSubscriptionAction({})).toMatchObject({ ok: true });
    expect(paddle.state.calls).toHaveLength(1);
  });

  it("returns the typed refusal to the client and records nothing", async () => {
    await db.update(subscriptions).set({ status: "past_due", pastDueSince: new Date() }).where(eq(subscriptions.organizationId, owner.organizationId));
    const result = await pauseSubscriptionAction();
    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT", details: { reason: "past_due" } } });
    expect(!result.ok && result.error.message).toContain("Update your payment method");
    expect(await db.select().from(auditLog)).toHaveLength(0);
  });

  it("leaves a trace when Paddle did not confirm (the request may have gone through)", async () => {
    paddle.state.fail = new TypeError("fetch failed");
    expect(await cancelSubscriptionAction()).toMatchObject({ ok: false, error: { code: "CONFLICT", details: { reason: "paddle_unavailable" } } });
    const [audit] = await db.select().from(auditLog);
    expect(audit).toMatchObject({ action: "billing.cancel_requested", metadata: { outcome: "unconfirmed" } });
  });

  it("is rate limited per workspace", async () => {
    await db.update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.organizationId, owner.organizationId));
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(await cancelSubscriptionAction()).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    }
    expect(await cancelSubscriptionAction()).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
  });

  it("a workspace that is READ-ONLY because it is over its seat limit can still manage its billing", async () => {
    // Paused -> Free -> one seat; with a second member the workspace is over its limit.
    await db.update(subscriptions).set({ status: "paused", pausedAt: new Date(), currentPeriodEnd: new Date(Date.now() - DAY) }).where(eq(subscriptions.organizationId, owner.organizationId));
    await addMember(owner.organizationId, member, "member");
    actAs(owner);
    const ctx = await requireOrg();
    expect(ctx.seats).toMatchObject({ used: 2, limit: 1, overLimit: true });
    // Product writes are refused…
    await expect(requireOrg({ role: "owner", write: true })).rejects.toMatchObject({ code: "SEAT_LIMIT_REACHED", status: 402 });
    // …but resuming — the way out of it — and cancelling are not.
    expect(await resumeSubscriptionAction()).toMatchObject({ ok: true, data: { step: "resume_now" } });
    expect(await cancelSubscriptionAction()).toMatchObject({ ok: true, data: { step: "cancel_now" } });
    expect(await undoScheduledChangeAction()).toMatchObject({ ok: false, error: { code: "CONFLICT", details: { reason: "nothing_scheduled" } } }); // a billing answer, not SEAT_LIMIT_REACHED
    expect(paddle.state.calls.map((call) => call.method)).toEqual(["resume", "cancel"]);
  });
});

describe("startOneOffCheckoutAction (Bid Pass)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load(overrides: Record<string, string> = {}) {
    vi.stubEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", "test_client_token");
    for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
    vi.resetModules();
    const [actions, signature, auth] = await Promise.all([import("@/server/actions/billing-manage"), import("@/lib/billing/checkout-signature"), import("@/lib/auth")]);
    return { start: actions.startOneOffCheckoutAction, verify: signature.verifyCheckoutData, auth: auth.auth };
  }

  it("owners and admins get a checkout signed for the session's workspace and themselves; members do not", async () => {
    await resetDatabase();
    const owner = await createTestUser({ email: "owner@example.com" });
    const admin = await createTestUser({ email: "admin@example.com" });
    const member = await createTestUser({ email: "member@example.com" });
    const { start, verify, auth } = await load();
    await db.insert(subscriptions).values({ organizationId: owner.organizationId, status: "active", planKey: "pro" }); // three seats

    actAs(owner);
    const result = await start({ kind: "bid_pass" });
    expect(result).toMatchObject({
      ok: true,
      data: { kind: "bid_pass", label: "Bid Pass", priceId: "pri_test_bid_pass", quantity: 1, customerEmail: "owner@example.com", paddle: { environment: "sandbox", clientToken: "test_client_token" } },
    });
    if (!result.ok) return;
    expect(verify(result.data.customData)).toMatchObject({ ok: true, organizationId: owner.organizationId, userId: owner.id });
    expect(verifyCheckoutData(result.data.customData).ok).toBe(true); // same key outside the reloaded module graph
    expect((await db.select().from(events).where(eq(events.name, "billing.one_off_checkout_started")))[0]).toMatchObject({ organizationId: owner.organizationId, properties: { kind: "bid_pass" } });

    for (const [user, role] of [[admin, "admin"], [member, "member"]] as const) {
      await addMember(owner.organizationId, user, role);
      await auth.api.setActiveOrganization({ headers: new Headers({ cookie: user.cookie }), body: { organizationId: owner.organizationId } });
    }
    actAs(admin);
    const forAdmin = await start({ kind: "bid_pass" });
    expect(forAdmin.ok && verify(forAdmin.data.customData)).toMatchObject({ ok: true, organizationId: owner.organizationId, userId: admin.id }); // the signed data names the buyer
    actAs(member);
    expect(await start({ kind: "bid_pass" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    actAs(null);
    expect(await start({ kind: "bid_pass" })).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
  });

  it("validates its input, needs checkout and the price to be configured, and does not sell to a read-only workspace", async () => {
    await resetDatabase();
    const owner = await createTestUser({ email: "owner@example.com" });
    const extra = await createTestUser({ email: "extra@example.com" });
    actAs(owner);
    let { start } = await load();
    expect(await start({ kind: "business" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await start({ kind: "bid_pass", organizationId: extra.organizationId })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await start(undefined)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });

    // Free plan, one seat, two members: read-only. A pass could not be used, so it is not sold.
    await addMember(owner.organizationId, extra, "member");
    expect(await start({ kind: "bid_pass" })).toMatchObject({ ok: false, error: { code: "SEAT_LIMIT_REACHED" } });
    await db.insert(subscriptions).values({ organizationId: owner.organizationId, status: "active", planKey: "pro" });
    expect(await start({ kind: "bid_pass" })).toMatchObject({ ok: true });

    ({ start } = await load({ PADDLE_PRICE_BID_PASS: "" }));
    expect(await start({ kind: "bid_pass" })).toMatchObject({ ok: false, error: { code: "BILLING_NOT_CONFIGURED" } });
    ({ start } = await load({ NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "" }));
    expect(await start({ kind: "bid_pass" })).toMatchObject({ ok: false, error: { code: "BILLING_NOT_CONFIGURED" } });
  });
});

describe("webhook: scheduled pause and cancellation (events the Paddle sandbox really emitted)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
  });

  it("active subscription: pause_at / cancel_at follow the scheduled change; the plan stays until it is applied", async () => {
    const lifecycle = sandboxLifecycle("active", { organizationId: ORG });
    const types = lifecycle.map((event) => event.event_type);
    expect(types).toEqual([
      "subscription.activated", "subscription.created", "transaction.updated", "transaction.updated",
      "subscription.updated", "subscription.updated", "subscription.updated", "subscription.updated", "subscription.updated",
      "subscription.paused", "subscription.updated", "subscription.resumed", "subscription.updated",
      "subscription.canceled", "subscription.updated", "transaction.updated", "transaction.canceled",
    ]);
    const upTo = async (index: number, from: number) => {
      for (let position = from; position <= index; position += 1) {
        const outcome = await deliver(lifecycle[position]);
        expect(outcome, `${position}: ${types[position]}`).toBe(types[position]!.startsWith("subscription.") ? "processed" : "ignored_unhandled");
      }
      return rowOf(ORG);
    };

    // activated + created (same timestamp): attached once, plan granted.
    let row = await upTo(3, 0);
    expect(row).toMatchObject({ status: "active", planKey: "pro", pauseAt: null, cancelAt: null, paddleEnvironment: "sandbox" });
    expect(row.verifiedAt).toBeInstanceOf(Date);
    const periodEnd = row.currentPeriodEnd!;
    expect(periodEnd.getTime()).toBeGreaterThan(Date.now());

    // Scheduled pause: status stays active, pause_at = end of the paid period, the plan stays.
    row = await upTo(4, 4);
    expect(row).toMatchObject({ status: "active", cancelAt: null });
    expect(row.pauseAt?.getTime()).toBe(periodEnd.getTime());
    expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "pro", isPaid: true, source: "active" });

    // A cancellation replaced the scheduled pause: cancel_at is set, pause_at is cleared.
    row = await upTo(5, 5);
    expect(row.pauseAt).toBeNull();
    expect(row.cancelAt?.getTime()).toBe(periodEnd.getTime());
    expect((await getOrgEntitlements(ORG)).isPaid).toBe(true);

    // Undo: both cleared. Scheduled again, undone again.
    row = await upTo(6, 6);
    expect(row).toMatchObject({ status: "active", pauseAt: null, cancelAt: null });
    row = await upTo(7, 7);
    expect(row.cancelAt).toBeInstanceOf(Date);
    row = await upTo(8, 8);
    expect(row).toMatchObject({ pauseAt: null, cancelAt: null });

    // The pause takes effect: Free. (paused + updated arrive with the same timestamp.)
    row = await upTo(10, 9);
    expect(row).toMatchObject({ status: "paused", pauseAt: null, cancelAt: null });
    expect(row.pausedAt).toBeInstanceOf(Date);
    expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "free", isPaid: false, source: "paused", subscribedPlanKey: "pro" });

    row = await upTo(12, 11);
    expect(row).toMatchObject({ status: "active", pausedAt: null });
    expect((await getOrgEntitlements(ORG)).planKey).toBe("pro");

    row = await upTo(16, 13);
    expect(row).toMatchObject({ status: "canceled", pauseAt: null, cancelAt: null });
    expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "free", source: "canceled" });

    const names = await eventNames();
    expect(names.filter((name) => name === "billing.subscription_started")).toHaveLength(1);
    expect(names.filter((name) => name === "billing.subscription_change_scheduled")).toHaveLength(3); // pause, cancel (replacing it), cancel
    expect(names.filter((name) => name === "billing.subscription_change_unscheduled")).toHaveLength(2);
    expect(names).toEqual(expect.arrayContaining(["billing.subscription_paused", "billing.subscription_resumed", "billing.subscription_canceled"]));
    const scheduledEvents = await db.select().from(events).where(eq(events.name, "billing.subscription_change_scheduled"));
    expect(scheduledEvents.map((event) => (event.properties as { change: string }).change)).toEqual(["pause", "cancel", "cancel"]);
    expect(await db.select().from(errorLog)).toHaveLength(0);
  });

  it("trial: starts without a `subscription.created` event; pause and cancel are scheduled for the end of the trial", async () => {
    const lifecycle = sandboxLifecycle("trial", { organizationId: ORG });
    expect(lifecycle.map((event) => event.event_type)).toEqual([
      "subscription.trialing", "transaction.updated", "transaction.updated", "transaction.completed",
      "subscription.updated", "subscription.updated", "subscription.updated", "subscription.updated",
      "subscription.canceled", "subscription.updated",
    ]);
    expect(await deliver(lifecycle[0])).toBe("processed");
    let row = await rowOf(ORG);
    expect(row).toMatchObject({ status: "trialing", planKey: "pro", pauseAt: null, cancelAt: null });
    const trialEnd = row.trialEnd!;
    expect(Math.round((trialEnd.getTime() - Date.now()) / DAY)).toBe(14);
    expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "pro", source: "trialing" });

    // The trial's zero-value transaction is recorded, but it is not a receipt.
    for (const event of lifecycle.slice(1, 4)) await deliver(event);
    expect(await listReceipts(ORG)).toEqual([]);

    expect(await deliver(lifecycle[4])).toBe("processed"); // cancel scheduled for the end of the trial
    row = await rowOf(ORG);
    expect(row.status).toBe("trialing");
    expect(row.cancelAt?.getTime()).toBe(trialEnd.getTime());
    expect((await getOrgEntitlements(ORG)).planKey).toBe("pro");
    expect(decideManageAction("undo", row)).toMatchObject({ ok: true, step: { kind: "remove_scheduled_change", change: "cancel" } });

    await deliver(lifecycle[5]); // undone
    expect(await rowOf(ORG)).toMatchObject({ cancelAt: null, pauseAt: null });
    await deliver(lifecycle[6]); // pause scheduled for the end of the trial
    row = await rowOf(ORG);
    expect(row.pauseAt?.getTime()).toBe(trialEnd.getTime());
    expect(row.cancelAt).toBeNull();
    expect((await getOrgEntitlements(ORG)).isPaid).toBe(true);
    await deliver(lifecycle[7]);
    expect((await rowOf(ORG)).pauseAt).toBeNull();

    await deliver(lifecycle[8]);
    await deliver(lifecycle[9]);
    expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "free", source: "canceled" });
  });

  it("out of order, duplicated or replayed, an older event never brings a scheduled change back", async () => {
    const lifecycle = sandboxLifecycle("active", { organizationId: ORG });
    await deliver(lifecycle[1]); // created
    await deliver(lifecycle[4]); // pause scheduled
    expect((await rowOf(ORG)).pauseAt).toBeInstanceOf(Date);
    await deliver(lifecycle[6]); // undone — delivered BEFORE the cancellation that preceded it
    expect(await deliver(lifecycle[5])).toBe("ignored_stale"); // the late "cancel scheduled"
    expect(await rowOf(ORG)).toMatchObject({ pauseAt: null, cancelAt: null });

    // Duplicate delivery and a forced replay of the old "pause scheduled" event.
    expect(((await (await POST(signedWebhookRequest(lifecycle[4]))).json()) as { duplicate: boolean }).duplicate).toBe(true);
    expect(await processStoredEvent(lifecycle[4]!.event_id, { force: true })).toEqual({ ok: true, duplicate: false, outcome: "ignored_stale" });
    expect(await rowOf(ORG)).toMatchObject({ pauseAt: null, cancelAt: null, status: "active" });
    // Replaying the NEWEST event re-applies the same state and repeats no side effect.
    const audits = (await db.select().from(auditLog)).length;
    const tracked = (await db.select().from(events)).length;
    expect(await processStoredEvent(lifecycle[6]!.event_id, { force: true })).toEqual({ ok: true, duplicate: false, outcome: "processed" });
    expect((await db.select().from(auditLog)).length).toBe(audits);
    expect((await db.select().from(events)).length).toBe(tracked);
    expect(await db.select().from(webhookEvents)).toHaveLength(4);
  });

  it("a scheduled pause forged for another workspace changes nothing there", async () => {
    await createBillingOrg("org_manage_victim");
    const victim = sandboxLifecycle("active", { organizationId: "org_manage_victim" });
    await deliver(victim[1]);
    // The attacker signs checkout data for their OWN workspace and sends the victim's subscription with a scheduled pause.
    const forged = sandboxLifecycle("active", { organizationId: ORG })[4]!;
    forged.data.id = victim[1]!.data.id;
    expect(await deliver(forged)).toBe("ignored_conflict");
    expect(await rowOf("org_manage_victim")).toMatchObject({ pauseAt: null, status: "active" });
    expect(await db.select().from(subscriptions).where(eq(subscriptions.organizationId, ORG))).toHaveLength(0);
  });

  it("the daily reconciliation notices a scheduled pause that was set — or removed — while a webhook was lost", async () => {
    const lifecycle = sandboxLifecycle("active", { organizationId: ORG });
    await deliver(lifecycle[1]);
    const snapshot = (index: number) => ({ ...(lifecycle[index]!.data as Record<string, unknown>), updated_at: lifecycle[index]!.occurred_at });
    expect(await reconcileSubscriptions({ fetchSubscription: async () => snapshot(4) })).toMatchObject({ checked: 1, updated: 1 });
    expect((await rowOf(ORG)).pauseAt).toBeInstanceOf(Date);
    expect(await reconcileSubscriptions({ fetchSubscription: async () => snapshot(4) })).toMatchObject({ checked: 1, updated: 0, unchanged: 1 });
    expect(await reconcileSubscriptions({ fetchSubscription: async () => snapshot(8) })).toMatchObject({ checked: 1, updated: 1 });
    expect(await rowOf(ORG)).toMatchObject({ pauseAt: null, cancelAt: null });
  });
});
