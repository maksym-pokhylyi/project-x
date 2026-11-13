import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/paddle/route";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { changeSubscriptionPlan, planChangeBlocker } from "@/lib/billing/paddle";
import { resetDatabase } from "./helpers/db";
import { createBillingOrg, paddleEvent, signedWebhookRequest } from "./helpers/paddle";

/**
 * Changing plan or interval: not during a trial and not while a pause or cancellation is
 * scheduled. Both are Paddle's rules, seen in the sandbox (scripts/paddle-verify-sandbox.ts):
 * a plan change in trial answers `subscription_trialing_items_update_invalid_options`, an
 * update with a scheduled change pending `subscription_locked_pending_changes`. The app says
 * so in a sentence instead of passing Paddle's refusal on.
 */
const DAY = 86_400_000;
const ORG = "org_plan_change";
const SUB = "sub_01hv8x29kz0t586xy6zn1a62ny"; // id in Paddle's documented fixtures

type Call = { subscriptionId: string; body: unknown };
const calls: Call[] = [];
/** A stand-in for the part of the Paddle SDK that changeSubscriptionPlan() uses. */
const paddle = {
  subscriptions: {
    update: async (subscriptionId: string, body: unknown) => {
      calls.push({ subscriptionId, body });
      return {};
    },
  },
};

const subscription = (overrides: Partial<Parameters<typeof planChangeBlocker>[0] & object> = {}) => ({
  status: "active",
  paddleSubscriptionId: SUB,
  verifiedAt: new Date(),
  cancelAt: null,
  pauseAt: null,
  ...overrides,
});

describe("changing plan: not during a trial, not while a change is scheduled", () => {
  beforeEach(async () => {
    calls.length = 0;
    await resetDatabase();
    await createBillingOrg(ORG);
  });

  it("planChangeBlocker gives the reason as a sentence, or null", () => {
    expect(planChangeBlocker(subscription())).toBeNull();
    expect(planChangeBlocker(subscription({ status: "trialing" }))).toMatch(/once your trial has ended/);
    expect(planChangeBlocker(subscription({ cancelAt: new Date() }))).toMatch(/scheduled to cancel/);
    expect(planChangeBlocker(subscription({ pauseAt: new Date() }))).toMatch(/scheduled to pause/);
    expect(planChangeBlocker(subscription({ verifiedAt: null }))).toMatch(/contact support/);
    // An unverified subscription is never told more than "contact support", whatever else is true of it.
    expect(planChangeBlocker(subscription({ verifiedAt: null, status: "trialing", pauseAt: new Date() }))).toMatch(/contact support/);
    for (const status of ["paused", "past_due", "canceled", "something_new"]) expect(planChangeBlocker(subscription({ status })), status).toMatch(/no active subscription/);
    expect(planChangeBlocker(null)).toMatch(/no active subscription/);
    expect(planChangeBlocker(undefined)).toMatch(/no active subscription/);
    expect(planChangeBlocker(subscription({ paddleSubscriptionId: null }))).toMatch(/no active subscription/);
  });

  it("changeSubscriptionPlan refuses before asking Paddle, and otherwise sends the prorated change", async () => {
    await expect(changeSubscriptionPlan(ORG, "business", "month", paddle)).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("no active subscription") });

    const response = await POST(signedWebhookRequest(paddleEvent("subscription.created", { organizationId: ORG })));
    expect(await response.json()).toMatchObject({ outcome: "processed" });
    const set = (values: Partial<typeof subscriptions.$inferInsert>) => db.update(subscriptions).set(values).where(eq(subscriptions.organizationId, ORG));

    await set({ status: "trialing" });
    await expect(changeSubscriptionPlan(ORG, "business", "month", paddle)).rejects.toMatchObject({ code: "CONFLICT", status: 409, message: expect.stringContaining("once your trial has ended") });
    await set({ status: "active", pauseAt: new Date(Date.now() + DAY) });
    await expect(changeSubscriptionPlan(ORG, "business", "month", paddle)).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("scheduled to pause") });
    await set({ pauseAt: null, cancelAt: new Date(Date.now() + DAY) });
    await expect(changeSubscriptionPlan(ORG, "business", "month", paddle)).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("scheduled to cancel") });
    await set({ cancelAt: null });
    // The plan and interval the workspace is already on.
    await expect(changeSubscriptionPlan(ORG, "pro", "month", paddle)).rejects.toMatchObject({ code: "CONFLICT", message: "The workspace is already on this plan." });
    expect(calls).toEqual([]);

    await changeSubscriptionPlan(ORG, "business", "year", paddle);
    expect(calls).toEqual([{ subscriptionId: SUB, body: { items: [{ priceId: "pri_test_business_annual", quantity: 10 }], prorationBillingMode: "prorated_immediately" } }]);
    // Nothing is written here: the `subscription.updated` webhook is the single writer.
    expect(await db.select().from(subscriptions)).toMatchObject([{ planKey: "pro", priceId: "pri_test_pro_monthly" }]);
  });
});
