import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { db } from "@/db";
import { subscriptions } from "@/db/schema";
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
