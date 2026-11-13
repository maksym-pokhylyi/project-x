import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
  data: Record<string, unknown> & { items?: Array<{ price: { id: string } }> };
};

let sequence = 0;

/**
 * Loads one of Paddle's documented example payloads (tests/fixtures/paddle/*.json, copied
 * verbatim from developer.paddle.com/webhooks) and adapts it to the test:
 *  - a unique event id (unless given),
 *  - `custom_data.organization_id` as set by our checkout,
 *  - the first item's price swapped for one of the test catalogue's price ids.
 */
export function paddleEvent(
  name: FixtureName,
  options: {
    organizationId?: string | null;
    userId?: string;
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
      envelope.data.custom_data = { organization_id: options.organizationId, ...(options.userId ? { user_id: options.userId } : {}) };
    }
    const firstItem = envelope.data.items?.[0];
    if (firstItem) firstItem.price.id = options.priceId ?? "pri_test_pro_monthly";
  }
  options.mutate?.(envelope.data);
  return envelope;
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
