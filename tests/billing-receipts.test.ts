import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

/** Paddle's invoice endpoint: answers with a link, or fails on demand. Any other use of the client fails the test. */
const paddle = vi.hoisted(() => {
  const state = { invoiceCalls: [] as Array<{ transactionId: string; query: unknown }>, fail: null as unknown, url: "https://paddle-invoices.example/invoice_325-10566.pdf?signature=abc" };
  const client = {
    transactions: {
      getInvoicePDF: async (transactionId: string, query: unknown) => {
        state.invoiceCalls.push({ transactionId, query });
        if (state.fail) throw state.fail;
        return { url: state.url };
      },
    },
  };
  return { state, client };
});
vi.mock("@/lib/billing/paddle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/paddle")>()),
  getPaddle: () => paddle.client,
}));

import { GET as receiptRoute } from "@/app/api/billing/receipts/[transactionId]/route";
import { POST } from "@/app/api/webhooks/paddle/route";
import { db } from "@/db";
import { billingPayments, errorLog, subscriptions, webhookEvents } from "@/db/schema";
import { getBillingOverview, initialsOf } from "@/lib/billing/overview";
import { describePaymentMethod, normalizePaymentMethod, summarizePaymentMethod } from "@/lib/billing/payment-method";
import { describePayment, getReceiptInvoiceUrl, listReceipts } from "@/lib/billing/receipts";
import { processStoredEvent } from "@/lib/billing/webhooks";
import { requireOrg } from "@/server/session";
import { actAs, addMember, createTestUser, type TestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";
import { adjustmentEvent, createBillingOrg, oneOffPurchaseEvent, paddleEvent, signedWebhookRequest } from "./helpers/paddle";

/**
 * The payment-method summary ("Card ending 4242"), the receipts list, the invoice redirect
 * and the Billing overview — all read from our own records; only the PDF link is Paddle's.
 */
const DAY = 86_400_000;
const ORG = "org_receipts";
const SUB = "sub_01hv8x29kz0t586xy6zn1a62ny";

const deliver = async (envelope: unknown) => ((await (await POST(signedWebhookRequest(envelope))).json()) as { outcome?: string }).outcome;
const rowOf = async (organizationId: string) => (await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)))[0]!;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

type Payment = { amount?: string; status: string; created_at: string; captured_at: string | null; method_details: Record<string, unknown> | null };
const card = (overrides: Record<string, unknown> = {}) => ({
  type: "card",
  card: { type: "mastercard", last4: "4444", expiry_month: 12, expiry_year: 2029, cardholder_name: "Olivia Owner", ...overrides },
  paypal: null,
  underlying_details: null,
  south_korea_local_card: null,
});

/** A completed payment of the fixture subscription, with its own transaction id, billing time and payment attempts. */
function payment(options: { id: string; billedAt: string; payments?: Payment[]; organizationId?: string | null; priceId?: string; mutate?: (data: Record<string, unknown>) => void }) {
  return paddleEvent("transaction.completed", {
    organizationId: options.organizationId === undefined ? null : options.organizationId,
    priceId: options.priceId,
    occurredAt: new Date(Date.parse(options.billedAt) + 2_000).toISOString(),
    mutate: (data) => {
      data.id = options.id;
      data.billed_at = options.billedAt;
      if (options.payments) data.payments = options.payments;
      options.mutate?.(data);
    },
  });
}

beforeEach(() => {
  paddle.state.invoiceCalls = [];
  paddle.state.fail = null;
  paddle.state.url = "https://paddle-invoices.example/invoice_325-10566.pdf?signature=abc";
});

describe("payment-method summary: five harmless fields and nothing else", () => {
  it("keeps type, brand, last four digits and expiry of the payment that was captured — never the cardholder", () => {
    const summary = summarizePaymentMethod([
      { status: "error", created_at: "2026-11-13T10:00:00Z", captured_at: null, method_details: card({ last4: "0002" }) },
      { status: "captured", created_at: "2026-11-13T10:01:00Z", captured_at: "2026-11-13T10:01:05Z", method_details: card() },
    ]);
    expect(summary).toEqual({ type: "card", cardBrand: "mastercard", last4: "4444", expiryMonth: 12, expiryYear: 2029 });
    expect(Object.keys(summary!).sort()).toEqual(["cardBrand", "expiryMonth", "expiryYear", "last4", "type"]);
    expect(JSON.stringify(summary)).not.toContain("Olivia");
  });

  it("uses the newest captured attempt, and an authorised one for zero-value transactions", () => {
    expect(
      summarizePaymentMethod([
        { status: "captured", created_at: "2026-11-01T10:00:00Z", captured_at: "2026-11-01T10:00:05Z", method_details: card({ last4: "1111" }) },
        { status: "captured", created_at: "2026-11-13T10:00:00Z", captured_at: "2026-11-13T10:00:05Z", method_details: card({ last4: "2222" }) },
      ])?.last4,
    ).toBe("2222");
    expect(summarizePaymentMethod([{ status: "authorized", created_at: "2026-11-13T10:00:00Z", method_details: card({ last4: "3333" }) }])?.last4).toBe("3333");
  });

  it("PayPal and wallets: the type only — no e-mail address, no reference", () => {
    const summary = summarizePaymentMethod([
      { status: "captured", created_at: "2026-11-13T10:00:00Z", captured_at: "2026-11-13T10:00:05Z", method_details: { type: "paypal", card: null, paypal: { email: "payer@example.com", reference: "REF-1" } } },
    ]);
    expect(summary).toEqual({ type: "paypal", cardBrand: null, last4: null, expiryMonth: null, expiryYear: null });
    expect(describePaymentMethod(summary!)).toBe("PayPal");
  });

  it("anything unexpected in the payload becomes null instead of being copied", () => {
    const hostile = summarizePaymentMethod([
      {
        status: "captured",
        created_at: "2026-11-13T10:00:00Z",
        method_details: { type: "card<script>", card: { type: "Sam Miller's Visa", last4: "4242 4242 4242 4242", expiry_month: 13, expiry_year: "next year", cardholder_name: "Sam Miller" } },
      },
    ]);
    expect(hostile).toEqual({ type: "unknown", cardBrand: null, last4: null, expiryMonth: null, expiryYear: null });
    expect(summarizePaymentMethod(null)).toBeNull();
    expect(summarizePaymentMethod([])).toBeNull();
    expect(summarizePaymentMethod([{ status: "captured", method_details: null }])).toBeNull();
    expect(summarizePaymentMethod([{ status: "error", method_details: card() }])).toBeNull();
    expect(summarizePaymentMethod([{ status: "captured", method_details: "card" }])).toBeNull();
  });

  it("normalizePaymentMethod drops everything that is not one of the five fields", () => {
    expect(normalizePaymentMethod({ type: "card", cardBrand: "visa", last4: "4242", expiryMonth: 1, expiryYear: 2027, cardholderName: "Sam Miller", email: "sam@example.com" })).toEqual({
      type: "card",
      cardBrand: "visa",
      last4: "4242",
      expiryMonth: 1,
      expiryYear: 2027,
    });
    expect(normalizePaymentMethod({ cardBrand: "visa" })).toBeNull();
    expect(normalizePaymentMethod("visa 4242")).toBeNull();
    expect(describePaymentMethod({ type: "card", cardBrand: "visa", last4: "4242", expiryMonth: 1, expiryYear: 2027 })).toBe("Visa ending 4242");
    expect(describePaymentMethod({ type: "card", cardBrand: null, last4: "4242", expiryMonth: null, expiryYear: null })).toBe("Card ending 4242");
    expect(describePaymentMethod({ type: "apple_pay", cardBrand: "visa", last4: "4242", expiryMonth: null, expiryYear: null })).toBe("Apple Pay ending 4242");
  });
});

describe("webhook: the card on file follows the newest payment", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
  });

  it("stores the sanitised summary on the subscription and on the payment (Paddle's documented payload)", async () => {
    await deliver(paddleEvent("subscription.created", { organizationId: ORG }));
    const completed = paddleEvent("transaction.completed", { organizationId: ORG }); // Visa 3184 captured, an earlier attempt with 0002 declined, cardholder "Sam Miller"
    expect(await deliver(completed)).toBe("processed");
    const row = await rowOf(ORG);
    expect(row.paymentMethod).toEqual({ type: "card", cardBrand: "visa", last4: "3184", expiryMonth: 1, expiryYear: 2025 });
    expect(row.paymentMethodAt?.toISOString()).toBe("2024-04-12T10:18:48.294Z"); // billed_at of the transaction
    const [recorded] = await db.select().from(billingPayments);
    expect(recorded!.paymentMethod).toEqual(row.paymentMethod);
    // The cardholder's name is in Paddle's event (kept 90 days) and nowhere else.
    expect(JSON.stringify([row, recorded])).not.toContain("Sam Miller");
    expect(JSON.stringify((await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, completed.event_id)))[0]!.payload)).toContain("Sam Miller");
  });

  it("is kept fresh by a later payment, and never overwritten by an older one — late, duplicated or replayed", async () => {
    await deliver(paddleEvent("subscription.created", { organizationId: ORG }));
    const captured = (last4: string, at: string): Payment[] => [{ status: "captured", created_at: at, captured_at: at, method_details: card({ last4 }) }];
    const october = payment({ id: "txn_01testpaymentoctober000001", billedAt: iso(40 * DAY), payments: captured("1111", iso(40 * DAY)), mutate: (data) => void (data.subscription_id = SUB) });
    const cardUpdate = payment({ id: "txn_01testpaymentupdate0000001", billedAt: iso(5 * DAY), payments: captured("2222", iso(5 * DAY)), mutate: (data) => void (data.subscription_id = SUB) });
    const november = payment({ id: "txn_01testpaymentnovember00001", billedAt: iso(10 * DAY), payments: captured("1111", iso(10 * DAY)), mutate: (data) => void (data.subscription_id = SUB) });

    await deliver(october);
    expect((await rowOf(ORG)).paymentMethod).toMatchObject({ last4: "1111" });
    await deliver(cardUpdate); // the customer changed the card five days ago
    expect((await rowOf(ORG)).paymentMethod).toMatchObject({ last4: "2222" });
    // The renewal from ten days ago arrives late: it must not bring the old card back.
    expect(await deliver(november)).toBe("processed");
    expect((await rowOf(ORG)).paymentMethod).toMatchObject({ last4: "2222" });
    expect(await processStoredEvent(october.event_id, { force: true })).toMatchObject({ ok: true, outcome: "processed" });
    expect((await rowOf(ORG)).paymentMethod).toMatchObject({ last4: "2222" });
    // A payment without method details (an invoice paid by transfer) changes nothing.
    await deliver(payment({ id: "txn_01testpaymentinvoice000001", billedAt: iso(DAY), payments: [], mutate: (data) => void (data.subscription_id = SUB) }));
    expect((await rowOf(ORG)).paymentMethod).toMatchObject({ last4: "2222" });
    expect(await db.select().from(billingPayments)).toHaveLength(4);
  });

  it("a payment event that arrives BEFORE its subscription event is picked up when the subscription is attached", async () => {
    const completed = paddleEvent("transaction.completed", { organizationId: ORG }); // names SUB, which we do not know yet
    expect(await deliver(completed)).toBe("processed");
    expect(await db.select().from(subscriptions)).toHaveLength(0);
    await deliver(paddleEvent("subscription.created", { organizationId: ORG }));
    expect((await rowOf(ORG)).paymentMethod).toEqual({ type: "card", cardBrand: "visa", last4: "3184", expiryMonth: 1, expiryYear: 2025 });
  });

  it("a new subscription does not inherit the previous subscription's card", async () => {
    await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: iso(40 * DAY) }));
    await deliver(paddleEvent("transaction.completed", { organizationId: ORG }));
    expect((await rowOf(ORG)).paymentMethod).not.toBeNull();
    await deliver(paddleEvent("subscription.canceled", { organizationId: null, occurredAt: iso(20 * DAY) }));
    await deliver(paddleEvent("subscription.created", { organizationId: ORG, occurredAt: iso(DAY), mutate: (data) => void (data.id = "sub_resubscribed") }));
    expect(await rowOf(ORG)).toMatchObject({ paddleSubscriptionId: "sub_resubscribed", paymentMethod: null, paymentMethodAt: null });
  });
});

describe("receipts", () => {
  let owner: TestUser;
  let other: TestUser;

  beforeEach(async () => {
    await resetDatabase();
    owner = await createTestUser({ email: "owner@example.com", name: "Olivia Owner" });
    other = await createTestUser({ email: "other@example.com" });
    const signedFor = (user: TestUser) => ({ organizationId: user.organizationId, userId: user.id });
    await deliver(paddleEvent("subscription.created", { ...signedFor(owner), occurredAt: iso(40 * DAY) }));
    // Two subscription payments (monthly, then — after switching — annual), a trial-style zero payment, and two Bid Passes.
    await deliver(payment({ id: "txn_01testreceiptmonthly000001", billedAt: iso(35 * DAY), ...signedFor(owner) }));
    await deliver(payment({ id: "txn_01testreceiptannual0000001", billedAt: iso(5 * DAY), priceId: "pri_test_pro_annual", ...signedFor(owner) }));
    await deliver(
      payment({
        id: "txn_01testreceiptzero000000001",
        billedAt: iso(3 * DAY),
        ...signedFor(owner),
        mutate: (data) => {
          const totals = (data.details as { totals: Record<string, string> }).totals;
          Object.assign(totals, { subtotal: "0", tax: "0", total: "0", grand_total: "0", grand_total_tax: "0" });
        },
      }),
    );
    await deliver(oneOffPurchaseEvent({ ...signedFor(owner), quantity: 2, transactionId: "txn_01testreceiptbidpass000001", occurredAt: iso(2 * DAY) }));
    // Another workspace's payment.
    await deliver(paddleEvent("subscription.created", { ...signedFor(other), occurredAt: iso(DAY), mutate: (data) => void ((data.id = "sub_other_workspace"), (data.customer_id = "ctm_other_workspace")) }));
    await deliver(payment({ id: "txn_01testreceiptother00000001", billedAt: iso(DAY), ...signedFor(other), mutate: (data) => void (data.subscription_id = "sub_other_workspace") }));
    actAs(owner);
  });

  it("lists the workspace's completed payments, newest first, described in the catalogue's words", async () => {
    const receipts = await listReceipts(owner.organizationId);
    expect(receipts.map((receipt) => [receipt.transactionId, receipt.description, receipt.kind])).toEqual([
      ["txn_01testreceiptbidpass000001", "Bid Pass × 2", "one_off"],
      ["txn_01testreceiptannual0000001", "Bid Desk, annual", "subscription"],
      ["txn_01testreceiptmonthly000001", "Bid Desk, monthly", "subscription"],
    ]);
    // The zero-value payment is not a receipt; the other workspace's payment is not ours.
    expect(receipts.map((receipt) => receipt.transactionId)).not.toContain("txn_01testreceiptzero000000001");
    expect(receipts.map((receipt) => receipt.transactionId)).not.toContain("txn_01testreceiptother00000001");

    const [pass, annual] = receipts;
    expect(pass).toMatchObject({ amountExcludingTaxMinor: 16500, taxMinor: 3300, totalMinor: 19800, currency: "GBP", amountExcludingTax: "£165.00", total: "£198.00", status: "completed", invoicePath: "/api/billing/receipts/txn_01testreceiptbidpass000001" });
    // Paddle's documented example: grand_total 65215 including 5315 tax, in USD.
    expect(annual).toMatchObject({ amountExcludingTaxMinor: 59900, taxMinor: 5315, totalMinor: 65215, currency: "USD", amountExcludingTax: "US$599.00", total: "US$652.15", invoiceNumber: "325-10566" });
    expect(annual!.paidAt.getTime()).toBeGreaterThan(receipts[2]!.paidAt.getTime());

    expect(await listReceipts(owner.organizationId, 1)).toHaveLength(1);
    expect(await listReceipts(other.organizationId)).toMatchObject([{ transactionId: "txn_01testreceiptother00000001" }]);
    expect(describePayment({ kind: "subscription", planKey: "unknown", billingInterval: null, product: null, quantity: 1 })).toBe("Subscription payment");
  });

  it("a refunded payment stays on the list, marked", async () => {
    await deliver(adjustmentEvent({ transactionId: "txn_01testreceiptbidpass000001", total: 19800 }));
    expect((await listReceipts(owner.organizationId))[0]).toMatchObject({ transactionId: "txn_01testreceiptbidpass000001", status: "refunded" });
  });

  const request = (transactionId: string) =>
    receiptRoute(new Request(`http://localhost:3000/api/billing/receipts/${transactionId}`), { params: Promise.resolve({ transactionId }) });

  it("GET /api/billing/receipts/<id> redirects owners and admins to Paddle's PDF — for their own workspace's payments only", async () => {
    const response = await request("txn_01testreceiptmonthly000001");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(paddle.state.url);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(paddle.state.invoiceCalls).toEqual([{ transactionId: "txn_01testreceiptmonthly000001", query: { disposition: "attachment" } }]);

    // Another workspace's transaction, an unknown one and a malformed one: all 404 — and Paddle is not asked.
    for (const id of ["txn_01testreceiptother00000001", "txn_01doesnotexist000000000000", "../../subscriptions", "txn_UPPERCASE"]) {
      const refused = await request(id);
      expect(refused.status, id).toBe(404);
      expect(((await refused.json()) as { error: { code: string } }).error.code).toBe("NOT_FOUND");
    }
    expect(paddle.state.invoiceCalls).toHaveLength(1);

    const admin = await createTestUser({ email: "admin@example.com" });
    const member = await createTestUser({ email: "member@example.com" });
    const { auth } = await import("@/lib/auth");
    for (const [user, role] of [[admin, "admin"], [member, "member"]] as const) {
      await addMember(owner.organizationId, user, role);
      await auth.api.setActiveOrganization({ headers: new Headers({ cookie: user.cookie }), body: { organizationId: owner.organizationId } });
    }
    actAs(admin);
    expect((await request("txn_01testreceiptmonthly000001")).status).toBe(302);
    actAs(member);
    expect((await request("txn_01testreceiptmonthly000001")).status).toBe(403);
    actAs(other); // owner of ANOTHER workspace asking for this workspace's receipt
    expect((await request("txn_01testreceiptmonthly000001")).status).toBe(404);
    actAs(null);
    expect((await request("txn_01testreceiptmonthly000001")).status).toBe(401);
  });

  it("answers clearly when there is no invoice (yet), and reports a Paddle outage", async () => {
    // What the sandbox answers for a transaction without an invoice: 404 `not_found`.
    paddle.state.fail = Object.assign(new Error("invoice txn_01testreceiptmonthly000001 not found."), { code: "not_found", detail: "invoice txn_01testreceiptmonthly000001 not found.", status: 404 });
    const notReady = await request("txn_01testreceiptmonthly000001");
    expect(notReady.status).toBe(409);
    expect(await notReady.json()).toMatchObject({ error: { code: "CONFLICT", message: expect.stringContaining("has not issued the invoice for this payment yet"), details: { reason: "not_ready" } } });
    expect(await db.select().from(errorLog)).toHaveLength(0);

    // Nothing was charged: Paddle has no invoice for a zero-value transaction, so it is not even asked.
    paddle.state.invoiceCalls = [];
    const zero = await request("txn_01testreceiptzero000000001");
    expect(zero.status).toBe(409);
    expect(await zero.json()).toMatchObject({ error: { details: { reason: "no_invoice" } } });
    expect(paddle.state.invoiceCalls).toHaveLength(0);

    paddle.state.fail = new TypeError("fetch failed");
    const down = await request("txn_01testreceiptmonthly000001");
    expect(down.status).toBe(503);
    expect(await down.json()).toMatchObject({ error: { details: { reason: "paddle_unavailable" } } });
    expect((await db.select().from(errorLog))[0]).toMatchObject({ route: "billing:receipt", organizationId: owner.organizationId });

    // Never redirect to something that is not an https link.
    paddle.state.fail = null;
    paddle.state.url = "javascript:alert(1)";
    expect((await request("txn_01testreceiptmonthly000001")).status).toBe(503);
    await expect(getReceiptInvoiceUrl(owner.organizationId, "txn_01testreceiptmonthly000001", { transactions: { getInvoicePDF: async () => ({ url: "http://insecure.example/invoice.pdf" }) } })).rejects.toMatchObject({ status: 503 });
  });
});

describe("getBillingOverview", () => {
  let owner: TestUser;

  beforeEach(async () => {
    await resetDatabase();
    owner = await createTestUser({ email: "owner@example.com", name: "Olivia Owner" });
    actAs(owner);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const subscribe = (values: Partial<typeof subscriptions.$inferInsert> = {}) =>
    db.insert(subscriptions).values({
      organizationId: owner.organizationId,
      status: "active",
      planKey: "pro",
      priceId: "pri_test_pro_monthly",
      billingInterval: "month",
      paddleSubscriptionId: "sub_overview",
      paddleCustomerId: "ctm_overview",
      verifiedAt: new Date(),
      customerEmail: "accounts@supplier.example",
      currentPeriodStart: new Date(Date.now() - DAY),
      currentPeriodEnd: new Date(Date.now() + 29 * DAY),
      paymentMethod: { type: "card", cardBrand: "visa", last4: "4242", expiryMonth: 1, expiryYear: 2027 },
      ...values,
    });

  it("a workspace on Free: nothing to manage, the Bid Pass priced, a trial still available", async () => {
    const overview = await getBillingOverview(await requireOrg());
    expect(overview).toMatchObject({
      plan: { key: "free", name: "Free" },
      subscribedPlan: null,
      interval: null,
      price: null,
      status: "none",
      entitlementSource: "no_subscription",
      nextPaymentAt: null,
      cancelAt: null,
      pauseAt: null,
      pausedAt: null,
      trialEndsAt: null,
      trial: null,
      pastDue: null,
      seats: { used: 1, limit: 1, overLimit: false, members: [{ name: "Olivia Owner", initials: "OO", role: "owner" }] },
      paymentMethod: null,
      receipts: [],
      testMode: true,
      canManage: true,
      managementLinks: { available: false },
      oneOff: { bidPass: { available: false, canBuy: false, price: { amountMinor: 9900, currency: "GBP", formatted: "£99" } } },
      trialEligible: true,
    });
    expect(overview.manage.cancel).toMatchObject({ allowed: false, reason: "no_subscription" });
    expect(initialsOf("olivia")).toBe("O");
    expect(initialsOf("  ")).toBe("?");
    expect(initialsOf("Jean-Luc van der Berg")).toBe("JB");
  });

  it("an active subscription: plan, price, next payment, card, billing e-mail — and no call to Paddle", async () => {
    await subscribe();
    const ctx = await requireOrg();
    const overview = await getBillingOverview(ctx);
    expect(overview).toMatchObject({
      plan: { key: "pro", name: "Bid Desk" },
      subscribedPlan: { key: "pro", name: "Bid Desk" },
      interval: "month",
      price: { amountMinor: 14900, currency: "GBP", formatted: "£149" },
      status: "active",
      cancelAt: null,
      pauseAt: null,
      paymentMethod: { type: "card", cardBrand: "visa", last4: "4242", expiryMonth: 1, expiryYear: 2027, label: "Visa ending 4242" },
      billingEmail: "accounts@supplier.example",
      trialEligible: false,
    });
    expect(overview.nextPaymentAt?.getTime()).toBe(ctx.subscription!.currentPeriodEnd!.getTime());
    // PADDLE_API_KEY is not set in tests: the rules allow the actions, the configuration does not.
    expect(overview.manage.pause).toMatchObject({ allowed: false, step: "pause_at_period_end", reason: "not_configured" });
    expect(overview.managementLinks).toEqual({ available: false, unavailableReason: "not_configured" });
    expect(paddle.state.invoiceCalls).toHaveLength(0);
  });

  it("scheduled pause or cancellation: no next payment, the date it takes effect, and what can be done about it", async () => {
    vi.stubEnv("PADDLE_API_KEY", "pdl_sdbx_apikey_test");
    vi.resetModules();
    const { getBillingOverview: overviewOf } = await import("@/lib/billing/overview");
    const { requireOrg: org } = await import("@/server/session");
    const pauseAt = new Date(Date.now() + 29 * DAY);
    await subscribe({ pauseAt, billingInterval: "year", priceId: "pri_test_pro_annual" });

    let overview = await overviewOf(await org());
    expect(overview).toMatchObject({ status: "active", interval: "year", price: { amountMinor: 149000, formatted: "£1,490" }, nextPaymentAt: null, cancelAt: null });
    expect(overview.pauseAt?.getTime()).toBe(pauseAt.getTime());
    expect(overview.plan.key).toBe("pro"); // the plan stays until the pause takes effect
    expect(overview.manage).toMatchObject({
      pause: { allowed: false, reason: "pause_scheduled" },
      resume: { allowed: true, step: "remove_scheduled_change" },
      undo: { allowed: true, step: "remove_scheduled_change" },
      cancel: { allowed: true, step: "cancel_at_period_end" }, // replaces the scheduled pause
    });
    expect(overview.managementLinks).toEqual({ available: true, unavailableReason: null });

    await db.update(subscriptions).set({ pauseAt: null, status: "paused", pausedAt: new Date(), currentPeriodEnd: new Date(Date.now() - DAY) }).where(eq(subscriptions.organizationId, owner.organizationId));
    vi.resetModules();
    const reloaded = await import("@/lib/billing/overview");
    overview = await reloaded.getBillingOverview(await (await import("@/server/session")).requireOrg());
    expect(overview).toMatchObject({ status: "paused", plan: { key: "free" }, subscribedPlan: { key: "pro" }, entitlementSource: "paused", nextPaymentAt: null });
    expect(overview.pausedAt).toBeInstanceOf(Date);
    expect(overview.manage.resume).toMatchObject({ allowed: true, step: "resume_now", billing: "new_period", effectiveAt: null });
    expect(overview.manage.cancel).toMatchObject({ allowed: true, step: "cancel_now" });
  });

  it("the trial strip: days left and the first payment — unless the trial will not convert", async () => {
    const trialEnd = new Date(Date.now() + 8.5 * DAY);
    await subscribe({ status: "trialing", trialEnd, currentPeriodEnd: trialEnd });
    let overview = await getBillingOverview(await requireOrg());
    expect(overview).toMatchObject({ status: "trialing", plan: { key: "pro" }, entitlementSource: "trialing" });
    expect(overview.trialEndsAt?.getTime()).toBe(trialEnd.getTime());
    expect(overview.nextPaymentAt?.getTime()).toBe(trialEnd.getTime());
    expect(overview.trial).toMatchObject({ daysLeft: 9, firstPayment: { amountMinor: 14900, currency: "GBP", formatted: "£149" } });
    expect(overview.trial!.firstPayment!.at.getTime()).toBe(trialEnd.getTime());

    await db.update(subscriptions).set({ cancelAt: trialEnd }).where(eq(subscriptions.organizationId, owner.organizationId));
    vi.resetModules();
    overview = await (await import("@/lib/billing/overview")).getBillingOverview(await (await import("@/server/session")).requireOrg());
    expect(overview.trial).toMatchObject({ daysLeft: 9, firstPayment: null });
    expect(overview.nextPaymentAt).toBeNull();
  });

  it("past due: when the paid features end, and when they have ended", async () => {
    await subscribe({ status: "past_due", pastDueSince: new Date(Date.now() - 2 * DAY) });
    let overview = await getBillingOverview(await requireOrg());
    expect(overview).toMatchObject({ status: "past_due", plan: { key: "pro" }, nextPaymentAt: null, pastDue: { accessLost: false } });
    expect(Math.round((overview.pastDue!.graceEndsAt!.getTime() - Date.now()) / DAY)).toBe(5);
    await db.update(subscriptions).set({ pastDueSince: new Date(Date.now() - 9 * DAY) }).where(eq(subscriptions.organizationId, owner.organizationId));
    vi.resetModules();
    overview = await (await import("@/lib/billing/overview")).getBillingOverview(await (await import("@/server/session")).requireOrg());
    expect(overview).toMatchObject({ plan: { key: "free" }, pastDue: { accessLost: true, graceEndsAt: null } });
  });

  it("receipts, the card and the billing e-mail are for owners and admins; managing is for owners", async () => {
    await subscribe();
    await db.insert(billingPayments).values({
      organizationId: owner.organizationId,
      paddleTransactionId: "txn_01testoverview000000000001",
      paddleSubscriptionId: "sub_overview",
      kind: "subscription",
      planKey: "pro",
      billingInterval: "month",
      subtotalMinor: 12417,
      taxMinor: 2483,
      totalMinor: 14900,
      currency: "GBP",
      paidAt: new Date(),
      paddleEnvironment: "sandbox",
    });
    const admin = await createTestUser({ email: "admin@example.com", name: "Adam Admin" });
    const member = await createTestUser({ email: "member@example.com", name: "Mia" });
    const { auth } = await import("@/lib/auth");
    for (const [user, role] of [[admin, "admin"], [member, "member"]] as const) {
      await addMember(owner.organizationId, user, role);
      await auth.api.setActiveOrganization({ headers: new Headers({ cookie: user.cookie }), body: { organizationId: owner.organizationId } });
    }
    const forOwner = await getBillingOverview(await requireOrg());
    expect(forOwner.receipts).toMatchObject([{ description: "Bid Desk, monthly", amountExcludingTax: "£124.17", total: "£149.00" }]);
    expect(forOwner.seats).toMatchObject({ used: 3, limit: 3, overLimit: false });
    expect(forOwner.seats.members).toEqual([
      { name: "Olivia Owner", initials: "OO", role: "owner" },
      { name: "Adam Admin", initials: "AA", role: "admin" },
      { name: "Mia", initials: "M", role: "member" },
    ]);
    expect(JSON.stringify(forOwner.seats)).not.toContain("@"); // names and roles only

    actAs(admin);
    vi.resetModules();
    const forAdmin = await (await import("@/lib/billing/overview")).getBillingOverview(await (await import("@/server/session")).requireOrg());
    expect(forAdmin).toMatchObject({ canManage: false, paymentMethod: { last4: "4242" }, billingEmail: "accounts@supplier.example", managementLinks: { available: false, unavailableReason: "forbidden" } });
    expect(forAdmin.receipts).toHaveLength(1);
    expect(forAdmin.manage.cancel).toMatchObject({ allowed: false, reason: "forbidden" });

    actAs(member);
    vi.resetModules();
    const forMember = await (await import("@/lib/billing/overview")).getBillingOverview(await (await import("@/server/session")).requireOrg());
    expect(forMember).toMatchObject({ canManage: false, paymentMethod: null, billingEmail: null, receipts: [], plan: { key: "pro" } });
  });

  it("the Bid Pass is on sale once checkout and its price are configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", "test_client_token");
    vi.resetModules();
    const overview = await (await import("@/lib/billing/overview")).getBillingOverview(await (await import("@/server/session")).requireOrg());
    expect(overview.oneOff.bidPass).toEqual({ available: true, canBuy: true, price: { amountMinor: 9900, currency: "GBP", formatted: "£99" } });
  });
});
