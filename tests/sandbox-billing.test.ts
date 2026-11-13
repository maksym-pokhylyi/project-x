import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { db } from "@/db";
import { subscriptions, webhookEvents } from "@/db/schema";
import { actAs, createTestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";
import { createBillingOrg, paddleEvent, signedWebhookRequest } from "./helpers/paddle";

/**
 * F-11 — Paddle SANDBOX on the real production deployment must not sell real plans for
 * test cards, unless explicitly allowed — and then every billing screen says "Test mode".
 */
const PRODUCTION = { NODE_ENV: "production", VERCEL_ENV: "production", NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_client_token", RESEND_API_KEY: "re_key", EMAIL_FROM: "no-reply@bidfolio.co.uk" };

async function loadApp(overrides: Record<string, string>) {
  vi.unstubAllEnvs();
  vi.resetModules();
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
  const [{ features }, webhook, actions, warnings, status, notice] = await Promise.all([
    import("@/env"),
    import("@/app/api/webhooks/paddle/route"),
    import("@/server/actions/billing"),
    import("@/lib/config-warnings"),
    import("@/app/api/billing/status/route"),
    import("@/components/billing/test-mode-notice"),
  ]);
  return { features, webhook, actions, warnings, status, notice };
}

describe("sandbox billing on production (F-11)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg("org_sandbox");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is OFF by default: no checkout, webhooks grant nothing, and the operator is told why", async () => {
    const app = await loadApp(PRODUCTION); // PADDLE_ENV defaults to "sandbox"
    expect(app.features).toMatchObject({ paddleCheckout: false, paddleWebhooks: false, paddleApi: false, billingTestMode: false, billingBlockedSandbox: true });

    // A correctly signed sandbox event (test card) must not create a subscription.
    const response = await app.webhook.POST(signedWebhookRequest(paddleEvent("subscription.created", { organizationId: "org_sandbox" })));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "billing_not_configured" });
    expect(await db.select().from(webhookEvents)).toHaveLength(0);
    expect(await db.select().from(subscriptions)).toHaveLength(0);

    const owner = await createTestUser({ email: "owner@example.com" });
    actAs(owner);
    expect(await app.actions.startCheckoutAction({ plan: "business", interval: "month" })).toMatchObject({ ok: false, error: { code: "BILLING_NOT_CONFIGURED" } });

    const warning = app.warnings.getConfigWarnings().find((entry) => entry.code === "SANDBOX_BILLING_BLOCKED");
    expect(warning).toMatchObject({ level: "error" });
    expect(app.notice.TestModeNotice()).toBeNull();
  });

  it("ALLOW_SANDBOX_BILLING=1 turns it on, flags it, and exposes the test-mode flag to the UI", async () => {
    const app = await loadApp({ ...PRODUCTION, ALLOW_SANDBOX_BILLING: "1" });
    expect(app.features).toMatchObject({ paddleCheckout: true, paddleWebhooks: true, billingTestMode: true, billingBlockedSandbox: false });

    const response = await app.webhook.POST(signedWebhookRequest(paddleEvent("subscription.created", { organizationId: "org_sandbox" })));
    expect(response.status).toBe(200);
    expect(await db.select().from(subscriptions)).toHaveLength(1);

    const warning = app.warnings.getConfigWarnings().find((entry) => entry.code === "SANDBOX_BILLING_ALLOWED");
    expect(warning).toMatchObject({ level: "error" });
    expect(warning?.message).toContain("test card");

    // The flag the UI reads: the server component renders the notice…
    const notice = app.notice.TestModeNotice();
    expect(notice).not.toBeNull();
    expect(JSON.stringify(notice)).toContain("Test mode.");
    expect(JSON.stringify(notice)).toContain("no card is charged");
    expect(JSON.stringify(notice)).toContain("billing-test-mode");
    // …and the status endpoint reports it to client code.
    const owner = await createTestUser({ email: "owner@example.com" });
    actAs(owner);
    const status = await app.status.GET(new Request("http://localhost:3000/api/billing/status"), undefined);
    expect(await status.json()).toMatchObject({ testMode: true, planKey: "free" });
  });

  it("live Paddle on production: enabled, no test-mode notice, no warning", async () => {
    const app = await loadApp({ ...PRODUCTION, PADDLE_ENV: "production" });
    expect(app.features).toMatchObject({ paddleCheckout: true, paddleWebhooks: true, billingTestMode: false, billingBlockedSandbox: false });
    expect(app.notice.TestModeNotice()).toBeNull();
    expect(app.warnings.getConfigWarnings().some((entry) => entry.code.startsWith("SANDBOX"))).toBe(false);
  });

  it("outside real production the sandbox works as before, and is labelled as test mode", async () => {
    const app = await loadApp({ NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_client_token" });
    expect(app.features).toMatchObject({ paddleCheckout: true, paddleWebhooks: true, billingTestMode: true, billingBlockedSandbox: false });
    expect(app.notice.TestModeNotice()).not.toBeNull();
    const preview = await loadApp({ ...PRODUCTION, VERCEL_ENV: "preview" });
    expect(preview.features).toMatchObject({ paddleCheckout: true, billingTestMode: true });
  });
});
