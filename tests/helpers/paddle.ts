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
  | "customer.updated";

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
  if (!name.startsWith("customer.")) {
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
