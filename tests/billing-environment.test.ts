import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { POST } from "@/app/api/webhooks/paddle/route";
import { db } from "@/db";
import { billingCheckoutNonces, billingPayments, billingPurchases, subscriptions, webhookEvents } from "@/db/schema";
import { countBillingRows, countForeignBillingRows, purgeSandboxBilling } from "@/lib/billing/environment";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { actAs, createTestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";
import { createBillingOrg, oneOffPurchaseEvent, paddleEvent, signedWebhookRequest } from "./helpers/paddle";

/**
 * Test mode must never mix with live data. While ALLOW_SANDBOX_BILLING=1 lets sandbox
 * payments run on the production deployment, every billing row records the Paddle
 * environment it came from, so that it can be recognised, kept out of live receipts,
 * never replayed into live state, and removed before going live.
 */
const SANDBOX_ORG = "org_env_sandbox";
const LIVE_ORG = "org_env_live";

const deliver = async (envelope: unknown, post: (request: Request) => Promise<Response> = POST) => ((await (await post(signedWebhookRequest(envelope))).json()) as { outcome?: string }).outcome;

/** The app as it runs after PADDLE_ENV was switched to production (same database). */
async function goLive() {
  vi.stubEnv("PADDLE_ENV", "production");
  vi.resetModules();
  const [route, webhooks, receipts, environment, admin, subscription, trial] = await Promise.all([
    import("@/app/api/webhooks/paddle/route"),
    import("@/lib/billing/webhooks"),
    import("@/lib/billing/receipts"),
    import("@/lib/billing/environment"),
    import("@/server/admin"),
    import("@/lib/billing/subscription"),
    import("@/lib/billing/trial"),
  ]);
  return { POST: route.POST, ...webhooks, ...receipts, ...environment, ...admin, ...subscription, ...trial };
}

describe("billing rows record their Paddle environment", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(SANDBOX_ORG);
    await createBillingOrg(LIVE_ORG);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /** A subscription, its payment and a Bid Pass — bought with test cards. */
  async function sandboxEra() {
    const created = paddleEvent("subscription.created", { organizationId: SANDBOX_ORG });
    const payment = paddleEvent("transaction.completed", { organizationId: SANDBOX_ORG });
    const pass = oneOffPurchaseEvent({ organizationId: SANDBOX_ORG });
    for (const envelope of [created, payment, pass]) expect(await deliver(envelope)).toBe("processed");
    return { created, payment, pass };
  }

  it("events, subscriptions, payments and purchases are labelled with the environment they came from", async () => {
    await sandboxEra();
    expect((await db.select().from(webhookEvents)).map((row) => row.environment)).toEqual(["sandbox", "sandbox", "sandbox"]);
    expect((await db.select().from(subscriptions))[0]).toMatchObject({ organizationId: SANDBOX_ORG, paddleEnvironment: "sandbox" });
    expect((await db.select().from(billingPayments)).map((row) => row.paddleEnvironment)).toEqual(["sandbox", "sandbox"]);
    expect((await db.select().from(billingPurchases))[0]).toMatchObject({ paddleEnvironment: "sandbox" });
    expect(await countBillingRows("sandbox")).toEqual({ subscriptions: 1, purchases: 1, payments: 2, events: 3 });
    expect(await countBillingRows("production")).toEqual({ subscriptions: 0, purchases: 0, payments: 0, events: 0 });
    // In test mode there is nothing "foreign": no warning.
    expect(await countForeignBillingRows()).toEqual({ environment: "production", subscriptions: 0, purchases: 0, payments: 0, events: 0 });
  });

  it("a subscription row from before the column existed is labelled by its next event, and counts as sandbox until then", async () => {
    const { created } = await sandboxEra();
    await db.update(subscriptions).set({ paddleEnvironment: null });
    await db.update(webhookEvents).set({ environment: null });
    expect(await countBillingRows("sandbox")).toMatchObject({ subscriptions: 1, events: 3 });
    expect(await deliver(paddleEvent("subscription.updated", { organizationId: null, occurredAt: new Date().toISOString(), mutate: (data) => void (data.id = created.data.id) }))).toBe("processed");
    expect((await db.select().from(subscriptions))[0]!.paddleEnvironment).toBe("sandbox");
    // A plan granted by hand has no Paddle id: it belongs to no environment.
    await db.insert(subscriptions).values({ organizationId: LIVE_ORG, status: "active", planKey: "pro" });
    expect((await countBillingRows("sandbox")).subscriptions).toBe(1);
    expect((await countBillingRows("production")).subscriptions).toBe(0);
  });

  it("after going live: sandbox events cannot be replayed into live state, sandbox receipts are hidden, and the operator is warned", async () => {
    const { created, pass } = await sandboxEra();
    const live = await goLive();

    // Replaying a stored sandbox event — a purchase, a subscription — is refused and changes nothing.
    const purchasesBefore = await db.select().from(billingPurchases);
    for (const eventId of [pass.event_id, created.event_id]) {
      const replay = await live.processStoredEvent(eventId, { force: true });
      expect(replay).toMatchObject({ ok: false });
      expect(!replay.ok && replay.error).toMatch(/received from the Paddle sandbox environment, but this deployment now runs production billing/);
    }
    expect(await db.select().from(billingPurchases)).toEqual(purchasesBefore);
    // An event that is still unlabelled (stored before the column existed) is sandbox too.
    await db.update(webhookEvents).set({ environment: null }).where(eq(webhookEvents.eventId, pass.event_id));
    expect(await live.processStoredEvent(pass.event_id, { force: true })).toMatchObject({ ok: false });
    // A redelivery of an already processed event is still acknowledged as a duplicate.
    expect(await (await live.POST(signedWebhookRequest(created))).json()).toMatchObject({ duplicate: true });

    // Live events are processed and labelled as such.
    const liveSubscription = paddleEvent("subscription.created", { organizationId: LIVE_ORG, mutate: (data) => void ((data.id = "sub_live_subscription"), (data.customer_id = "ctm_live_customer")) });
    const livePayment = paddleEvent("transaction.completed", { organizationId: LIVE_ORG, mutate: (data) => void ((data.id = "txn_01livepayment00000000000001"), (data.subscription_id = "sub_live_subscription")) });
    expect(await deliver(liveSubscription, live.POST)).toBe("processed");
    expect(await deliver(livePayment, live.POST)).toBe("processed");
    expect((await db.select().from(subscriptions).where(eq(subscriptions.organizationId, LIVE_ORG)))[0]).toMatchObject({ paddleEnvironment: "production" });

    // Receipts never mix: the sandbox workspace's test payments are not listed, and their PDFs do not exist here.
    expect(await live.listReceipts(SANDBOX_ORG)).toEqual([]);
    expect((await live.listReceipts(LIVE_ORG)).map((receipt) => receipt.transactionId)).toEqual(["txn_01livepayment00000000000001"]);
    const [sandboxPayment] = await db.select().from(billingPayments).where(eq(billingPayments.organizationId, SANDBOX_ORG));
    await expect(live.getReceiptInvoiceUrl(SANDBOX_ORG, sandboxPayment!.paddleTransactionId)).rejects.toMatchObject({ code: "NOT_FOUND" });

    // The leftovers are counted and shown on /admin.
    expect(await live.countForeignBillingRows()).toMatchObject({ environment: "sandbox", subscriptions: 1, purchases: 1, payments: 2 });
    actAs(await createTestUser({ email: "founder@example.com" }));
    const warning = (await live.getAdminConfigWarnings()).find((entry) => entry.code === "BILLING_ENVIRONMENT_MIX");
    expect(warning).toMatchObject({ level: "error" });
    expect(warning!.message).toContain("1 subscription(s), 1 purchase(s) and 2 payment(s) were recorded in the Paddle sandbox environment");
    expect(warning!.message).toContain("pnpm billing:purge-sandbox");
  });

  it("purgeSandboxBilling removes everything from the sandbox — and nothing from live", async () => {
    await sandboxEra();
    const live = await goLive();
    await deliver(paddleEvent("subscription.created", { organizationId: LIVE_ORG, mutate: (data) => void ((data.id = "sub_live_subscription"), (data.customer_id = "ctm_live_customer")) }), live.POST);
    await deliver(oneOffPurchaseEvent({ organizationId: LIVE_ORG }), live.POST);
    expect(await live.isTrialEligible(SANDBOX_ORG)).toBe(false);

    // Dry run (the default): counts only.
    expect(await live.purgeSandboxBilling()).toEqual({ dryRun: true, unitsRevoked: 0, unitsAlreadyUsed: 0, subscriptions: 1, purchases: 1, payments: 2, events: 3 });
    expect(await db.select().from(subscriptions)).toHaveLength(2);

    expect(await live.purgeSandboxBilling({ dryRun: false })).toEqual({ dryRun: false, unitsRevoked: 1, unitsAlreadyUsed: 0, subscriptions: 1, purchases: 1, payments: 2, events: 3 });
    expect(await db.select().from(subscriptions)).toMatchObject([{ organizationId: LIVE_ORG, paddleEnvironment: "production" }]);
    expect(await db.select().from(billingPurchases)).toMatchObject([{ organizationId: LIVE_ORG, paddleEnvironment: "production" }]);
    expect((await db.select().from(billingPayments)).every((row) => row.paddleEnvironment === "production")).toBe(true);
    expect((await db.select().from(webhookEvents)).every((row) => row.environment === "production")).toBe(true);
    expect((await db.select().from(billingCheckoutNonces)).map((row) => row.organizationId)).toEqual([LIVE_ORG]);
    // The test workspace is back on Free and may start a trial again; the live one is untouched.
    expect((await live.getOrgEntitlements(SANDBOX_ORG)).planKey).toBe("free");
    expect(await live.isTrialEligible(SANDBOX_ORG)).toBe(true);
    expect((await live.getOrgEntitlements(LIVE_ORG)).planKey).toBe("pro");
    expect(await live.countForeignBillingRows()).toMatchObject({ subscriptions: 0, purchases: 0, payments: 0, events: 0 });
    expect((await live.getAdminConfigWarnings().catch(() => [])).some((entry) => entry.code === "BILLING_ENVIRONMENT_MIX")).toBe(false);
    // Idempotent.
    expect(await live.purgeSandboxBilling({ dryRun: false })).toMatchObject({ subscriptions: 0, purchases: 0, payments: 0, events: 0 });
  });

  it("can also be run before the switch, while the deployment is still in test mode", async () => {
    await sandboxEra();
    await db.insert(subscriptions).values({ organizationId: LIVE_ORG, status: "active", planKey: "pro" }); // granted by hand: not a sandbox row
    expect(await purgeSandboxBilling({ dryRun: false })).toMatchObject({ subscriptions: 1, purchases: 1, payments: 2, events: 3, unitsRevoked: 1 });
    expect(await db.select().from(subscriptions)).toMatchObject([{ organizationId: LIVE_ORG, paddleSubscriptionId: null }]);
    expect((await getOrgEntitlements(LIVE_ORG)).planKey).toBe("pro");
  });
});
