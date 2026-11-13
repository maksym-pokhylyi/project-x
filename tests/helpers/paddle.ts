import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { db } from "@/db";
import { members, organizations, users } from "@/db/schema";
import { signCheckoutData } from "@/lib/billing/checkout-signature";
import { signPaddlePayload } from "@/lib/billing/webhook-signature";

export const WEBHOOK_SECRET = "pdl_ntfset_test_0123456789abcdef";

export type FixtureName =
  | "subscription.created"
  | "subscription.activated"
  | "subscription.updated"
  | "subscription.canceled"
  | "subscription.paused"
  | "subscription.resumed"
  | "subscription.past_due"
  | "subscription.trialing"
  | "transaction.completed"
  | "transaction.payment_failed"
  | "customer.created"
  | "customer.updated"
  | "adjustment.created"
  | "adjustment.updated";

type Envelope = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  notification_id: string;
  data: Record<string, unknown> & { id: string; items?: Array<{ price: { id: string } }> };
};

let sequence = 0;

/** Id of the owner user that createBillingOrg() gives a workspace. */
export const ownerIdOf = (organizationId: string) => `owner_of_${organizationId}`;

/**
 * Loads one of Paddle's documented example payloads (tests/fixtures/paddle/*.json, copied
 * verbatim from developer.paddle.com/webhooks) and adapts it to the test:
 *  - a unique event id (unless given),
 *  - `custom_data` exactly as our checkout sets it: SIGNED for the workspace and one of its
 *    owners (default `ownerIdOf(organizationId)`, see createBillingOrg), issued a minute
 *    before the event, with a fresh single-use nonce,
 *  - the first item's price swapped for one of the test catalogue's price ids.
 */
export function paddleEvent(
  name: FixtureName,
  options: {
    organizationId?: string | null;
    userId?: string;
    /** Reuse a nonce (replay) instead of a fresh one. */
    nonce?: string;
    /** Keep the fixture's own (2024) billing period instead of a current one. */
    keepFixturePeriod?: boolean;
    priceId?: string;
    occurredAt?: string;
    eventId?: string;
    mutate?: (data: Envelope["data"]) => void;
  } = {},
): Envelope {
  const file = fileURLToPath(new URL(`../fixtures/paddle/${name}.json`, import.meta.url));
  const envelope = JSON.parse(readFileSync(file, "utf8")) as Envelope;
  sequence += 1;
  envelope.event_id = options.eventId ?? `evt_test_${Date.now()}_${sequence}`;
  if (options.occurredAt) envelope.occurred_at = options.occurredAt;
  if (!name.startsWith("customer.") && !name.startsWith("adjustment.")) {
    if (options.organizationId !== null && options.organizationId !== undefined) {
      envelope.data.custom_data = signCheckoutData({
        organizationId: options.organizationId,
        userId: options.userId ?? ownerIdOf(options.organizationId),
        issuedAt: new Date(Date.parse(envelope.occurred_at) - 60_000),
        nonce: options.nonce,
      });
    }
    // Paid access follows the paid period (F-09): by default the period contains "now".
    if (envelope.data.current_billing_period && !options.keepFixturePeriod) {
      envelope.data.current_billing_period = {
        starts_at: new Date(Date.now() - 86_400_000).toISOString(),
        ends_at: new Date(Date.now() + 29 * 86_400_000).toISOString(),
      };
    }
    const firstItem = envelope.data.items?.[0];
    if (firstItem) firstItem.price.id = options.priceId ?? "pri_test_pro_monthly";
  }
  options.mutate?.(envelope.data);
  return envelope;
}

/** A workspace with one owner (`ownerIdOf(id)`), which is what a signed checkout needs. */
export async function createBillingOrg(id: string): Promise<{ organizationId: string; ownerId: string }> {
  const ownerId = ownerIdOf(id);
  await db.insert(organizations).values({ id, name: id, slug: id, createdAt: new Date() });
  await db.insert(users).values({ id: ownerId, name: "Owner", email: `${ownerId}@example.com`.toLowerCase(), emailVerified: true });
  await db.insert(members).values({ id: `mem_${id}`, organizationId: id, userId: ownerId, role: "owner", createdAt: new Date() });
  return { organizationId: id, ownerId };
}

/** A webhook Request exactly as Paddle would send it (signed raw body). */
export function signedWebhookRequest(envelope: unknown, options: { secret?: string; signedAt?: Date; body?: string } = {}): Request {
  const body = options.body ?? JSON.stringify(envelope);
  const signature = signPaddlePayload(JSON.stringify(envelope), options.secret ?? WEBHOOK_SECRET, options.signedAt);
  return new Request("http://localhost:3000/api/webhooks/paddle", {
    method: "POST",
    headers: { "content-type": "application/json", "paddle-signature": signature },
    body,
  });
}

let purchaseSequence = 0;

/**
 * A `transaction.completed` for a ONE-OFF purchase, built from Paddle's documented example:
 * no subscription, one line item (the Bid Pass test price by default), totals in GBP, and
 * checkout data signed for `organizationId` and the buyer (default: the workspace's owner).
 */
export function oneOffPurchaseEvent(
  options: {
    organizationId?: string | null;
    userId?: string;
    priceId?: string;
    quantity?: number;
    transactionId?: string;
    occurredAt?: string;
    /** Unit price including tax, in pence. */
    unitTotal?: number;
    mutate?: (data: Envelope["data"]) => void;
  } = {},
): Envelope {
  purchaseSequence += 1;
  const quantity = options.quantity ?? 1;
  const unitTotal = options.unitTotal ?? 9900;
  const total = unitTotal * quantity;
  const tax = Math.round(total / 6);
  const priceId = options.priceId ?? "pri_test_bid_pass";
  const transactionId = options.transactionId ?? `txn_01testoneoff${String(purchaseSequence).padStart(12, "0")}`;
  const occurredAt = options.occurredAt ?? new Date(Date.now() - 30_000).toISOString();
  return paddleEvent("transaction.completed", {
    organizationId: options.organizationId,
    userId: options.userId,
    occurredAt,
    mutate: (data) => {
      const [template] = data.items as Array<Record<string, unknown> & { price: Record<string, unknown> }>;
      const [lineTemplate] = (data.details as { line_items: Array<Record<string, unknown>> }).line_items;
      data.id = transactionId;
      data.subscription_id = null;
      data.billing_period = null;
      // Paddle bills a checkout transaction a moment before it reports it completed.
      data.billed_at = new Date(Date.parse(occurredAt) - 2_000).toISOString();
      data.currency_code = "GBP";
      data.items = [
        { ...template!, quantity, price: { ...template!.price, id: priceId, billing_cycle: null, name: "Bid Pass", unit_price: { amount: String(unitTotal), currency_code: "GBP" } } },
      ] as unknown as Envelope["data"]["items"];
      const totals = { subtotal: String(total - tax), tax: String(tax), total: String(total), discount: "0" };
      data.details = {
        ...(data.details as Record<string, unknown>),
        totals: { ...totals, credit: "0", balance: "0", grand_total: String(total), grand_total_tax: String(tax), fee: "0", earnings: "0", currency_code: "GBP", credit_to_balance: "0" },
        line_items: [{ ...lineTemplate!, id: `txnitm_01testoneoff${String(purchaseSequence).padStart(9, "0")}`, price_id: priceId, quantity, totals }],
      };
      options.mutate?.(data);
    },
  });
}

/** A refund / chargeback event for a transaction, from Paddle's documented `adjustment.*` example. */
export function adjustmentEvent(options: {
  transactionId: string;
  action?: string;
  status?: string;
  /** full | partial */
  type?: string | null;
  /** Adjusted amount including tax, in minor units. */
  total?: number;
  subscriptionId?: string | null;
  adjustmentId?: string;
  eventType?: "adjustment.created" | "adjustment.updated";
  occurredAt?: string;
}): Envelope {
  return paddleEvent(options.eventType ?? "adjustment.created", {
    occurredAt: options.occurredAt ?? new Date().toISOString(),
    mutate: (data) => {
      const total = String(options.total ?? 9900);
      if (options.adjustmentId) data.id = options.adjustmentId;
      data.transaction_id = options.transactionId;
      data.subscription_id = options.subscriptionId ?? null;
      data.action = options.action ?? "refund";
      data.status = options.status ?? "approved";
      data.type = options.type === undefined ? "full" : options.type;
      data.currency_code = "GBP";
      data.totals = { ...(data.totals as Record<string, unknown>), total, currency_code: "GBP" };
    },
  });
}

const SANDBOX_FIXTURES = {
  active: "sandbox-active-lifecycle.json",
  trial: "sandbox-trial-lifecycle.json",
  "trial-created-pair": "sandbox-trial-created-pair.json",
} as const;

/**
 * The events Paddle really emitted for a subscription in the sandbox (recorded by
 * scripts/paddle-verify-sandbox.ts on 2026-11-13; ids replaced by fakes), in order:
 *
 *   active: activated + created → scheduled pause → cancel replaces it → undo → scheduled
 *           cancel → undo → paused (immediately) → resumed → canceled
 *   trial:  trialing — and NO `subscription.created` in this run → zero-value
 *           transaction.completed → scheduled cancel → undo → scheduled pause → undo → canceled
 *   trial-created-pair: how the trial of the NEXT run started: `subscription.created` AND
 *           `subscription.trialing`, same timestamp (the first two events of that run)
 *
 * Events of one change carry the same timestamp and the same payload (only
 * `subscription.created` has a `transaction_id` on top); their order differed between runs.
 *
 * Adapted to the test: checkout data signed for the workspace, the price mapped to the test
 * catalogue, and every timestamp shifted by one constant so that the first event happened
 * an hour ago (the paid period then contains "now"; microseconds and order are preserved).
 */
export function sandboxLifecycle(name: keyof typeof SANDBOX_FIXTURES, options: { organizationId: string; priceId?: string }): Envelope[] {
  const file = fileURLToPath(new URL(`../fixtures/paddle/${SANDBOX_FIXTURES[name]}`, import.meta.url));
  const raw = readFileSync(file, "utf8");
  const first = (JSON.parse(raw) as Envelope[])[0]!;
  const shiftMs = Date.now() - 3_600_000 - Date.parse(first.occurred_at);
  const shifted = raw.replace(/"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z"/g, (_match, seconds: string, fraction: string | undefined) => {
    const digits = (fraction ?? "").padEnd(3, "0");
    const moved = new Date(Date.parse(`${seconds}.${digits.slice(0, 3)}Z`) + shiftMs).toISOString().slice(0, -1);
    return `"${moved}${digits.slice(3)}Z"`;
  });
  const events = JSON.parse(shifted) as Envelope[];
  const signed = signCheckoutData({
    organizationId: options.organizationId,
    userId: ownerIdOf(options.organizationId),
    issuedAt: new Date(Date.parse(events[0]!.occurred_at) - 60_000),
  });
  sequence += 1;
  const run = `${Date.now()}_${sequence}`;
  for (const event of events) {
    // Unique per test, stable within it (a duplicate delivery must keep its id).
    event.event_id = `${event.event_id}_${run}`;
    event.data.custom_data = signed;
    const firstItem = event.data.items?.[0];
    if (firstItem) firstItem.price.id = options.priceId ?? "pri_test_pro_monthly";
  }
  return events;
}
