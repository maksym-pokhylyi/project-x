import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { db } from "@/db";
import { errorLog, subscriptions } from "@/db/schema";
import { getNoTrialPriceId, isTrialEligible, noTrialPriceEnvVar, planFromCheckoutPriceId, selectCheckoutPrice } from "@/lib/billing/trial";
import { resetDatabase } from "./helpers/db";
import { createBillingOrg, paddleEvent, signedWebhookRequest } from "./helpers/paddle";

/**
 * Trials are offered once per workspace: a returning workspace is sent to the no-trial twin
 * of the plan price (when one is configured), and the webhook knows both prices of a pair.
 */
const ORG = "org_trial";

describe("trial eligibility", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
  });

  it("is true only while the workspace has never had a subscription row — whatever its status", async () => {
    expect(await isTrialEligible(ORG)).toBe(true);
    for (const status of ["trialing", "active", "past_due", "paused", "canceled"]) {
      await db.delete(subscriptions);
      await db.insert(subscriptions).values({ organizationId: ORG, status, planKey: "pro", paddleSubscriptionId: `sub_${status}` });
      expect(await isTrialEligible(ORG), status).toBe(false);
    }
    // A plan granted by hand counts too; another workspace's subscription does not.
    await db.delete(subscriptions);
    await db.insert(subscriptions).values({ organizationId: ORG, status: "active", planKey: "starter" });
    expect(await isTrialEligible(ORG)).toBe(false);
    await createBillingOrg("org_trial_other");
    expect(await isTrialEligible("org_trial_other")).toBe(true);
  });

  it("a cancelled subscription created through the webhook has used the trial", async () => {
    const { POST } = await import("@/app/api/webhooks/paddle/route");
    const trialing = paddleEvent("subscription.trialing", { organizationId: ORG, occurredAt: "2026-11-01T10:00:00Z" });
    await POST(signedWebhookRequest(trialing));
    await POST(signedWebhookRequest(paddleEvent("subscription.canceled", { organizationId: null, occurredAt: "2026-11-05T10:00:00Z", mutate: (data) => void (data.id = trialing.data.id) })));
    expect(await db.select().from(subscriptions)).toMatchObject([{ status: "canceled" }]);
    expect(await isTrialEligible(ORG)).toBe(false);
  });
});

describe("selectCheckoutPrice", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("without no-trial prices configured, everybody gets the normal price", () => {
    expect(noTrialPriceEnvVar("pro", "month")).toBe("PADDLE_PRICE_PRO_MONTHLY_NOTRIAL");
    expect(noTrialPriceEnvVar("pro", "year")).toBe("PADDLE_PRICE_PRO_ANNUAL_NOTRIAL");
    expect(getNoTrialPriceId("pro", "month")).toBeNull();
    expect(selectCheckoutPrice("pro", "month", { trialEligible: true })).toBe("pri_test_pro_monthly");
    expect(selectCheckoutPrice("pro", "month", { trialEligible: false })).toBe("pri_test_pro_monthly");
    expect(selectCheckoutPrice("business", "year", { trialEligible: false })).toBe("pri_test_business_annual");
  });

  it("with them, a returning workspace gets the twin without a trial; a new one keeps the trial", async () => {
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY_NOTRIAL", "pri_test_pro_monthly_notrial");
    vi.stubEnv("PADDLE_PRICE_PRO_ANNUAL_NOTRIAL", "pri_test_pro_annual_notrial");
    vi.resetModules();
    const trial = await import("@/lib/billing/trial");
    expect(trial.selectCheckoutPrice("pro", "month", { trialEligible: true })).toBe("pri_test_pro_monthly");
    expect(trial.selectCheckoutPrice("pro", "month", { trialEligible: false })).toBe("pri_test_pro_monthly_notrial");
    expect(trial.selectCheckoutPrice("pro", "year", { trialEligible: false })).toBe("pri_test_pro_annual_notrial");
    // Plans without a twin fall back to their normal price.
    expect(trial.selectCheckoutPrice("starter", "month", { trialEligible: false })).toBe("pri_test_starter_monthly");
    // Both prices of a pair are the same plan.
    expect(trial.planFromCheckoutPriceId("pri_test_pro_monthly_notrial")).toEqual({ planKey: "pro", interval: "month" });
    expect(trial.planFromCheckoutPriceId("pri_test_pro_annual_notrial")).toEqual({ planKey: "pro", interval: "year" });
    expect(trial.planFromCheckoutPriceId("pri_test_pro_annual")).toEqual({ planKey: "pro", interval: "year" });
    expect(trial.planFromCheckoutPriceId("pri_unknown")).toBeNull();
    expect(trial.planFromCheckoutPriceId(null)).toBeNull();
  });

  it("returns null when the plan price itself is not configured", async () => {
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY", "");
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY_NOTRIAL", "pri_test_pro_monthly_notrial");
    vi.resetModules();
    const trial = await import("@/lib/billing/trial");
    expect(trial.selectCheckoutPrice("pro", "month", { trialEligible: true })).toBeNull();
    expect(trial.selectCheckoutPrice("pro", "month", { trialEligible: false })).toBeNull();
  });

  it("webhook: a subscription bought on the no-trial price is the same plan — not an unknown price that falls back to Free", async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
    // Without the twin configured the price is unknown: the workspace would be on Free.
    expect(planFromCheckoutPriceId("pri_test_pro_monthly_notrial")).toBeNull();

    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY_NOTRIAL", "pri_test_pro_monthly_notrial");
    vi.resetModules();
    const { POST } = await import("@/app/api/webhooks/paddle/route");
    const { getOrgEntitlements } = await import("@/lib/billing/subscription");
    const response = await POST(signedWebhookRequest(paddleEvent("subscription.created", { organizationId: ORG, priceId: "pri_test_pro_monthly_notrial" })));
    expect(await response.json()).toMatchObject({ outcome: "processed" });
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, ORG));
    expect(row).toMatchObject({ planKey: "pro", billingInterval: "month", priceId: "pri_test_pro_monthly_notrial", status: "active" });
    expect(await getOrgEntitlements(ORG)).toMatchObject({ planKey: "pro", isPaid: true });
  });
});

describe("webhook: a second trial is reported to the operator", () => {
  // The browser opens the checkout, so it can ask Paddle for the price WITH the trial even
  // when the server offered the twin without one. The server cannot take the trial back.
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const load = async (twinConfigured: boolean) => {
    if (twinConfigured) vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY_NOTRIAL", "pri_test_pro_monthly_notrial");
    vi.resetModules();
    const { POST } = await import("@/app/api/webhooks/paddle/route");
    const { processStoredEvent } = await import("@/lib/billing/webhooks");
    const deliver = async (envelope: unknown) => ((await (await POST(signedWebhookRequest(envelope))).json()) as { outcome?: string }).outcome;
    return { deliver, processStoredEvent };
  };
  const reported = async () => (await db.select({ message: errorLog.message, organizationId: errorLog.organizationId }).from(errorLog)).filter((row) => row.message.includes("another trial"));
  /** A first subscription that was cancelled a month ago. */
  const hadASubscription = async (deliver: (envelope: unknown) => Promise<string | undefined>) => {
    const first = paddleEvent("subscription.created", { organizationId: ORG, occurredAt: "2026-10-01T10:00:00Z" });
    expect(await deliver(first)).toBe("processed");
    expect(await deliver(paddleEvent("subscription.canceled", { organizationId: null, occurredAt: "2026-10-10T10:00:00Z", mutate: (data) => void (data.id = first.data.id) }))).toBe("processed");
  };
  const newTrial = (priceId = "pri_test_pro_monthly") =>
    paddleEvent("subscription.trialing", { organizationId: ORG, priceId, occurredAt: "2026-11-12T10:00:00Z", mutate: (data) => void (data.id = "sub_second_time_around") });

  it("a returning workspace that starts a trial although the no-trial price is configured: attached, and reported once", async () => {
    const { deliver, processStoredEvent } = await load(true);
    await hadASubscription(deliver);
    expect(await reported()).toHaveLength(0);

    const trial = newTrial();
    expect(await deliver(trial)).toBe("processed");
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, ORG));
    expect(row).toMatchObject({ paddleSubscriptionId: "sub_second_time_around", status: "trialing", planKey: "pro" }); // the customer has it in Paddle: it is honoured
    const notices = await reported();
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ organizationId: ORG });
    expect(notices[0]!.message).toContain("sub_second_time_around");
    expect(notices[0]!.message).toContain("pri_test_pro_monthly");

    // Its twin event, a later update and a forced replay do not report it again.
    expect(await deliver(paddleEvent("subscription.created", { organizationId: null, occurredAt: trial.occurred_at, mutate: (data) => void ((data.id = "sub_second_time_around"), (data.status = "trialing")) }))).toBe("processed");
    expect(await processStoredEvent(trial.event_id, { force: true })).toMatchObject({ ok: true, outcome: "processed" });
    expect(await reported()).toHaveLength(1);
  });

  it("not reported: a first trial, a returning workspace on the no-trial price, or no twin configured", async () => {
    let { deliver } = await load(true);
    expect(await deliver(newTrial())).toBe("processed"); // the workspace's first subscription
    expect(await reported()).toHaveLength(0);

    await resetDatabase();
    await createBillingOrg(ORG);
    await hadASubscription(deliver);
    // What the server offers a returning workspace: the twin, which starts paid (`active`).
    expect(await deliver(paddleEvent("subscription.created", { organizationId: ORG, priceId: "pri_test_pro_monthly_notrial", occurredAt: "2026-11-12T10:00:00Z", mutate: (data) => void (data.id = "sub_second_time_around") }))).toBe("processed");
    expect(await db.select().from(subscriptions)).toMatchObject([{ paddleSubscriptionId: "sub_second_time_around", status: "active", planKey: "pro" }]);
    expect(await reported()).toHaveLength(0);

    // Without a twin everybody is offered the normal price, trial included: nothing to report.
    vi.unstubAllEnvs();
    ({ deliver } = await load(false));
    await resetDatabase();
    await createBillingOrg(ORG);
    await hadASubscription(deliver);
    expect(await deliver(newTrial())).toBe("processed");
    expect(await db.select().from(subscriptions)).toMatchObject([{ paddleSubscriptionId: "sub_second_time_around", status: "trialing" }]);
    expect(await reported()).toHaveLength(0);
  });
});
