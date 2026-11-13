import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { auditLog, organizations, subscriptions, users, webhookEvents } from "@/db/schema";
import { env } from "@/env";
import { track } from "@/lib/analytics";
import { errorReason } from "@/lib/describe-error";
import { log } from "@/lib/logger";
import { reportError } from "@/lib/report-error";
import {
  CUSTOMER_EVENT_TYPES,
  SUBSCRIPTION_EVENT_TYPES,
  TRANSACTION_EVENT_TYPES,
  paddleCustomerSchema,
  paddleEnvelopeSchema,
  paddleSubscriptionSchema,
  paddleTransactionSchema,
  readCheckoutCustomData,
  type PaddleEnvelope,
} from "./paddle-events";
import { planFromPriceId } from "./prices";
import { verifyPaddleSignature } from "./webhook-signature";

/**
 * Paddle webhook pipeline.
 *
 *   verify signature (raw body)  ->  store in webhook_events (unique event_id)
 *   ->  handle inside ONE transaction  ->  mark processed  ->  post-commit analytics
 *
 * Guarantees
 *  - Invalid signature: 401, nothing is stored or processed.
 *  - Duplicate delivery of a processed event: 200, no reprocessing.
 *  - Out-of-order delivery: an event older than `subscriptions.last_event_at` is ignored.
 *  - Unexpected failure: recorded on the event row + error_log, 500 so Paddle retries;
 *    the retry re-runs the handler because `processed_at` is still null.
 *  - The subscription row is the only thing that grants paid access; the browser is
 *    never trusted (the success page just polls until this pipeline has run).
 */

export type WebhookOutcome =
  | "processed"
  | "ignored_stale"
  | "ignored_unhandled"
  | "ignored_unmapped"
  | "ignored_conflict";

type PostCommitEffect = () => Promise<void>;
type HandlerResult = { outcome: WebhookOutcome; note?: string; effects?: PostCommitEffect[] };

export type ProcessResult =
  | { ok: true; duplicate: boolean; outcome: WebhookOutcome | null }
  | { ok: false; error: string };

const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

// ---------------------------------------------------------------------------
// HTTP entry point (called by /api/webhooks/paddle)
// ---------------------------------------------------------------------------

export async function receivePaddleWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!env.PADDLE_WEBHOOK_SECRET) {
    log.warn("paddle webhook received but PADDLE_WEBHOOK_SECRET is not set");
    return { status: 503, body: { error: "billing_not_configured" } };
  }

  const signature = verifyPaddleSignature({
    rawBody,
    header: signatureHeader,
    secret: env.PADDLE_WEBHOOK_SECRET,
    toleranceSeconds: env.PADDLE_WEBHOOK_TOLERANCE_SECONDS,
  });
  if (!signature.valid) {
    log.warn("paddle webhook rejected", { reason: signature.reason });
    return { status: 401, body: { error: "invalid_signature" } };
  }

  let envelope: PaddleEnvelope;
  try {
    envelope = paddleEnvelopeSchema.parse(JSON.parse(rawBody));
  } catch {
    // Signed by Paddle but not an event we can read: retrying will not help.
    log.warn("paddle webhook with unreadable payload");
    return { status: 400, body: { error: "invalid_payload" } };
  }

  const result = await ingestPaddleEvent(envelope);
  if (!result.ok) return { status: 500, body: { error: "processing_failed" } };
  return { status: 200, body: { received: true, duplicate: result.duplicate, outcome: result.outcome } };
}

// ---------------------------------------------------------------------------
// Ingestion + processing
// ---------------------------------------------------------------------------

/** Stores the event (idempotently) and processes it. Exposed for tests. */
export async function ingestPaddleEvent(envelope: PaddleEnvelope): Promise<ProcessResult> {
  await db
    .insert(webhookEvents)
    .values({
      provider: "paddle",
      eventId: envelope.event_id,
      eventType: envelope.event_type,
      occurredAt: new Date(envelope.occurred_at),
      payload: envelope,
    })
    .onConflictDoNothing({ target: webhookEvents.eventId });
  return processStoredEvent(envelope.event_id);
}

/**
 * Processes a stored event. Idempotent: a processed event is skipped unless `force`
 * is set (used by the admin "replay" action — safe because handlers are idempotent
 * and stale events are ignored).
 */
export async function processStoredEvent(eventId: string, options: { force?: boolean } = {}): Promise<ProcessResult> {
  try {
    const result = await db.transaction(async (tx) => {
      // Row lock: concurrent deliveries of the same event are handled one at a time.
      const [row] = await tx.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId)).for("update");
      if (!row) throw new Error(`webhook event ${eventId} not found`);
      if (row.processedAt && !options.force) {
        return { duplicate: true, outcome: row.outcome as WebhookOutcome | null, effects: [] as PostCommitEffect[] };
      }
      const envelope = paddleEnvelopeSchema.parse(row.payload);
      const handled = await handlePaddleEvent(tx, envelope);
      await tx
        .update(webhookEvents)
        .set({
          processedAt: new Date(),
          outcome: handled.outcome,
          error: handled.note ?? null,
          attempts: sql`${webhookEvents.attempts} + 1`,
        })
        .where(eq(webhookEvents.id, row.id));
      return { duplicate: false, outcome: handled.outcome, effects: handled.effects ?? [] };
    });

    // Analytics run after commit and are best-effort (track() never throws).
    for (const effect of result.effects) await effect();
    return { ok: true, duplicate: result.duplicate, outcome: result.outcome };
  } catch (error) {
    // Sanitised: Paddle payload values bound into a failed statement stay out of the row.
    const message = errorReason(error);
    await db
      .update(webhookEvents)
      .set({ error: message, attempts: sql`${webhookEvents.attempts} + 1` })
      .where(eq(webhookEvents.eventId, eventId))
      .catch(() => undefined);
    await reportError(error, { route: "webhook:paddle", extra: { eventId } });
    return { ok: false, error: message };
  }
}

async function handlePaddleEvent(tx: Tx, envelope: PaddleEnvelope): Promise<HandlerResult> {
  const type = envelope.event_type;
  if ((SUBSCRIPTION_EVENT_TYPES as readonly string[]).includes(type)) return handleSubscriptionEvent(tx, envelope);
  if ((TRANSACTION_EVENT_TYPES as readonly string[]).includes(type)) return handleTransactionEvent(tx, envelope);
  if ((CUSTOMER_EVENT_TYPES as readonly string[]).includes(type)) return handleCustomerEvent(tx, envelope);
  return { outcome: "ignored_unhandled" };
}

// ---------------------------------------------------------------------------
// subscription.*
// ---------------------------------------------------------------------------

async function organizationExists(tx: Tx, organizationId: string): Promise<boolean> {
  const [row] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId));
  return Boolean(row);
}

/**
 * The user who started the checkout, if `custom_data.user_id` still names an existing
 * user. Analytics rows reference users by foreign key, and the account may be gone by
 * the time a renewal or cancellation event arrives.
 */
async function resolveUserId(tx: Tx, customData: Record<string, unknown> | null | undefined): Promise<string | null> {
  const userId = readCheckoutCustomData(customData).userId;
  if (!userId) return null;
  const [row] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId));
  return row?.id ?? null;
}

/**
 * Which workspace does a Paddle object belong to?
 * 1. `custom_data.organization_id` set by our checkout (must be an existing organization)
 * 2. the subscription we already track under that Paddle subscription id
 * 3. the single workspace already linked to that Paddle customer
 * Never by e-mail address: billing identity and app identity are independent.
 */
async function resolveOrganizationId(
  tx: Tx,
  input: { customData?: Record<string, unknown> | null; subscriptionId?: string | null; customerId?: string | null },
): Promise<string | null> {
  const fromCheckout = readCheckoutCustomData(input.customData).organizationId;
  if (fromCheckout && (await organizationExists(tx, fromCheckout))) return fromCheckout;

  if (input.subscriptionId) {
    const [row] = await tx
      .select({ organizationId: subscriptions.organizationId })
      .from(subscriptions)
      .where(eq(subscriptions.paddleSubscriptionId, input.subscriptionId));
    if (row) return row.organizationId;
  }
  if (input.customerId) {
    const rows = await tx
      .select({ organizationId: subscriptions.organizationId })
      .from(subscriptions)
      .where(eq(subscriptions.paddleCustomerId, input.customerId))
      .limit(2);
    if (rows.length === 1 && rows[0]) return rows[0].organizationId;
  }
  return null;
}

/** Billing e-mail from the newest stored customer.* event, if we have seen one. */
async function lookupCustomerEmail(tx: Tx, customerId: string): Promise<string | null> {
  const [row] = await tx
    .select({ email: sql<string | null>`${webhookEvents.payload} -> 'data' ->> 'email'` })
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.provider, "paddle"),
        sql`${webhookEvents.eventType} in ('customer.created', 'customer.updated')`,
        sql`${webhookEvents.payload} -> 'data' ->> 'id' = ${customerId}`,
      ),
    )
    .orderBy(desc(webhookEvents.occurredAt))
    .limit(1);
  return row?.email ?? null;
}

async function handleSubscriptionEvent(tx: Tx, envelope: PaddleEnvelope): Promise<HandlerResult> {
  const data = paddleSubscriptionSchema.parse(envelope.data);
  const occurredAtIso = envelope.occurred_at;
  const occurredAt = new Date(occurredAtIso);

  const organizationId = await resolveOrganizationId(tx, {
    customData: data.custom_data,
    subscriptionId: data.id,
    customerId: data.customer_id,
  });
  if (!organizationId) {
    return { outcome: "ignored_unmapped", note: `No workspace found for subscription ${data.id} (missing custom_data.organization_id)` };
  }

  // Serialise all subscription changes of one workspace (works with PgBouncer: tx-scoped).
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subscription:${organizationId}`}))`);

  const [existing] = await tx
    .select({
      row: subscriptions,
      // Compared in SQL to keep Paddle's microsecond precision.
      isStale: sql<boolean>`coalesce(${subscriptions.lastEventAt} > ${occurredAtIso}::timestamptz, false)`,
    })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId));

  const previous = existing?.row ?? null;
  const sameSubscription = previous?.paddleSubscriptionId === data.id;

  if (previous && previous.paddleSubscriptionId && !sameSubscription) {
    // The workspace is linked to a different Paddle subscription.
    const previousIsLive = LIVE_STATUSES.has(previous.status);
    const incomingIsLive = LIVE_STATUSES.has(data.status);
    if (previousIsLive || !incomingIsLive) {
      const note = `Workspace ${organizationId} is linked to ${previous.paddleSubscriptionId} (${previous.status}); event for ${data.id} (${data.status}) ignored`;
      return {
        outcome: "ignored_conflict",
        note,
        // A second LIVE subscription means the customer may be paying twice: surface it.
        effects: incomingIsLive && previousIsLive ? [() => reportError(new Error(note), { route: "webhook:paddle", organizationId })] : [],
      };
    }
    // previous is dead, incoming is live: the workspace re-subscribed. Fall through and replace.
  } else if (previous && sameSubscription && existing?.isStale) {
    return { outcome: "ignored_stale", note: `Older than last applied event for ${data.id}` };
  }

  // Prefer the item whose price is in our catalogue (subscriptions may carry add-ons).
  const mappedItem = data.items.find((item) => planFromPriceId(item.price.id));
  const item = mappedItem ?? data.items[0]!;
  const mapping = planFromPriceId(item.price.id);
  const planKey = mapping?.planKey ?? "unknown";
  const cycleInterval = data.billing_cycle?.interval;
  const billingInterval = mapping?.interval ?? (cycleInterval === "month" || cycleInterval === "year" ? cycleInterval : null);

  const carriedPrevious = sameSubscription ? previous : null;
  const pastDueSince = data.status === "past_due" ? (carriedPrevious?.pastDueSince ?? occurredAt) : null;
  const customerEmail =
    (previous?.paddleCustomerId === data.customer_id ? previous.customerEmail : null) ??
    (await lookupCustomerEmail(tx, data.customer_id));

  const values = {
    organizationId,
    paddleCustomerId: data.customer_id,
    paddleSubscriptionId: data.id,
    status: data.status,
    planKey,
    priceId: item.price.id,
    billingInterval,
    quantity: item.quantity,
    currentPeriodStart: data.current_billing_period ? new Date(data.current_billing_period.starts_at) : null,
    currentPeriodEnd: data.current_billing_period ? new Date(data.current_billing_period.ends_at) : null,
    cancelAt: data.scheduled_change?.action === "cancel" ? new Date(data.scheduled_change.effective_at) : null,
    canceledAt: data.canceled_at ? new Date(data.canceled_at) : null,
    pausedAt: data.paused_at ? new Date(data.paused_at) : null,
    trialEnd: item.trial_dates?.ends_at ? new Date(item.trial_dates.ends_at) : null,
    pastDueSince,
    customerEmail,
    raw: data,
    updatedAt: new Date(),
  };
  const lastEventAt = sql`${occurredAtIso}::timestamptz`;

  if (previous) {
    await tx
      .update(subscriptions)
      .set({ ...values, lastEventAt })
      .where(eq(subscriptions.id, previous.id));
  } else {
    await tx.insert(subscriptions).values({ ...values, lastEventAt });
  }

  await tx.insert(auditLog).values({
    organizationId,
    actorType: "paddle",
    actorId: null,
    action: `billing.${envelope.event_type}`,
    target: `subscription:${data.id}`,
    metadata: { eventId: envelope.event_id, status: data.status, planKey, priceId: item.price.id },
  });

  if (planKey === "unknown") {
    log.warn("paddle price id is not in the plan catalogue; workspace falls back to free", {
      organizationId,
      priceId: item.price.id,
    });
  }

  const context = { organizationId, userId: await resolveUserId(tx, data.custom_data) };
  const effects: PostCommitEffect[] = [];
  const before = carriedPrevious;
  if (!before) {
    effects.push(() => track("billing.subscription_started", context, { plan: planKey, interval: billingInterval, status: data.status }));
  } else {
    if (before.planKey !== planKey) {
      effects.push(() => track("billing.subscription_changed", context, { from: before.planKey, to: planKey, status: data.status }));
    }
    if (before.status !== data.status) {
      if (data.status === "canceled") effects.push(() => track("billing.subscription_canceled", context, { plan: planKey }));
      if (data.status === "paused") effects.push(() => track("billing.subscription_paused", context, { plan: planKey }));
      if (data.status === "past_due") effects.push(() => track("billing.subscription_past_due", context, { plan: planKey }));
      if (before.status === "paused" && LIVE_STATUSES.has(data.status)) {
        effects.push(() => track("billing.subscription_resumed", context, { plan: planKey }));
      }
    }
  }

  return { outcome: "processed", note: planKey === "unknown" ? `Unknown price id ${item.price.id}` : undefined, effects };
}

// ---------------------------------------------------------------------------
// transaction.*
// ---------------------------------------------------------------------------

async function handleTransactionEvent(tx: Tx, envelope: PaddleEnvelope): Promise<HandlerResult> {
  const data = paddleTransactionSchema.parse(envelope.data);
  const organizationId = await resolveOrganizationId(tx, {
    customData: data.custom_data,
    subscriptionId: data.subscription_id,
    customerId: data.customer_id,
  });
  if (!organizationId) {
    return { outcome: "ignored_unmapped", note: `No workspace found for transaction ${data.id}` };
  }

  const succeeded = envelope.event_type === "transaction.completed";
  const amount = data.details?.totals?.grand_total ?? null;
  const currency = data.details?.totals?.currency_code ?? data.currency_code ?? null;
  const failureReason = data.payments?.find((payment) => payment.error_code)?.error_code ?? null;

  await tx.insert(auditLog).values({
    organizationId,
    actorType: "paddle",
    actorId: null,
    action: succeeded ? "billing.payment_succeeded" : "billing.payment_failed",
    target: `transaction:${data.id}`,
    metadata: {
      eventId: envelope.event_id,
      subscriptionId: data.subscription_id ?? null,
      ...(succeeded ? { amount, currency } : { reason: failureReason }),
    },
  });

  const context = { organizationId, userId: await resolveUserId(tx, data.custom_data) };
  return {
    outcome: "processed",
    effects: [
      succeeded
        ? () => track("billing.payment_succeeded", context, { amount, currency })
        : () => track("billing.payment_failed", context, { reason: failureReason }),
    ],
  };
}

// ---------------------------------------------------------------------------
// customer.*
// ---------------------------------------------------------------------------

async function handleCustomerEvent(tx: Tx, envelope: PaddleEnvelope): Promise<HandlerResult> {
  const data = paddleCustomerSchema.parse(envelope.data);
  // Keeps the billing contact shown on the Billing page in sync. If no subscription
  // references this customer yet, the stored event is picked up when one is created.
  if (data.email) {
    await tx
      .update(subscriptions)
      .set({ customerEmail: data.email, updatedAt: new Date() })
      .where(eq(subscriptions.paddleCustomerId, data.id));
  }
  return { outcome: "processed" };
}
