import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { auditLog, billingCheckoutNonces, members, organizations, subscriptions, users, webhookEvents } from "@/db/schema";
import { env, features } from "@/env";
import { track } from "@/lib/analytics";
import { errorReason } from "@/lib/describe-error";
import { log } from "@/lib/logger";
import { reportError } from "@/lib/report-error";
import { CHECKOUT_CLOCK_SKEW_SECONDS, CHECKOUT_MAX_AGE_SECONDS, verifyCheckoutData } from "./checkout-signature";
import {
  CUSTOMER_EVENT_TYPES,
  SUBSCRIPTION_EVENT_TYPES,
  TRANSACTION_EVENT_TYPES,
  paddleCustomerSchema,
  paddleEnvelopeSchema,
  paddleSubscriptionSchema,
  paddleTransactionSchema,
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
 *  - Out-of-order delivery: an event older than `subscriptions.last_event_at` is ignored,
 *    and a subscription is never attached from an event when a NEWER event for that same
 *    subscription has already been received.
 *  - Unexpected failure: recorded on the event row + error_log, 500 so Paddle retries;
 *    the retry re-runs the handler because `processed_at` is still null.
 *  - The subscription row is the only thing that grants paid access; the browser is
 *    never trusted (the success page just polls until this pipeline has run).
 *
 * WHICH WORKSPACE an event belongs to (the browser opens the checkout, so its custom data
 * is attacker-controlled until proven otherwise):
 *  1. A subscription we already track belongs to the workspace it is bound to. Custom data
 *     cannot move it, and its Paddle customer cannot be swapped.
 *  2. A subscription we have never seen is attached ONLY through checkout data signed by
 *     this server for that workspace (src/lib/billing/checkout-signature.ts): valid HMAC,
 *     signed recently, signed for a user who is still an owner, nonce not used for another
 *     subscription. Anything else is stored and ignored as `ignored_unverified` /
 *     `ignored_unmapped` and shown on /admin.
 *  3. A workspace's LIVE subscription is never replaced by a different one.
 */

export type WebhookOutcome =
  | "processed"
  | "ignored_stale"
  | "ignored_unhandled"
  | "ignored_unmapped"
  | "ignored_conflict"
  | "ignored_unverified";

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
  // `features.paddleWebhooks` is also false for sandbox credentials on real production
  // without ALLOW_SANDBOX_BILLING=1: test payments must not grant plans there.
  if (!env.PADDLE_WEBHOOK_SECRET || !features.paddleWebhooks) {
    log.warn("paddle webhook received but billing is not enabled", { blockedSandbox: features.billingBlockedSandbox });
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

/** Stores the event (idempotently) and processes it. Exposed for tests and reconciliation. */
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
 * is set (the admin "replay" action). A forced replay re-applies state but never repeats
 * side effects: the audit entry and analytics of an event are written once.
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
      if ((row.payload as { redacted?: unknown }).redacted === true) {
        throw new Error("The payload of this event was removed by data retention; replay it from the Paddle dashboard instead.");
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
// Shared helpers
// ---------------------------------------------------------------------------

async function organizationExists(tx: Tx, organizationId: string): Promise<boolean> {
  const [row] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId));
  return Boolean(row);
}

/** The user id only if it still names an existing user (analytics rows reference users by foreign key). */
async function existingUserId(tx: Tx, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const [row] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId));
  return row?.id ?? null;
}

async function isOwner(tx: Tx, organizationId: string, userId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.organizationId, organizationId), eq(members.userId, userId), eq(members.role, "owner")));
  return Boolean(row);
}

/** Has this event's audit entry already been written? (Makes replays free of repeated side effects.) */
async function alreadyAudited(tx: Tx, organizationId: string, eventId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(eq(auditLog.organizationId, organizationId), eq(auditLog.actorType, "paddle"), sql`${auditLog.metadata} ->> 'eventId' = ${eventId}`))
    .limit(1);
  return Boolean(row);
}

/** Billing e-mail from the newest stored customer.* event, if we have seen one. */
async function lookupCustomerEmail(tx: Tx, customerId: string): Promise<string | null> {
  const [row] = await tx
    .select({ email: sql<string | null>`${webhookEvents.payload} -> 'data' ->> 'email'` })
    .from(webhookEvents)
    .where(
      and(
        // Same expression as webhook_events_data_id_idx.
        sql`(${webhookEvents.payload} -> 'data' ->> 'id') = ${customerId}`,
        eq(webhookEvents.provider, "paddle"),
        sql`${webhookEvents.eventType} in ('customer.created', 'customer.updated')`,
      ),
    )
    .orderBy(desc(webhookEvents.occurredAt))
    .limit(1);
  return row?.email ?? null;
}

/**
 * True when we have already RECEIVED a newer subscription event for this Paddle
 * subscription than the one being handled — whatever became of it. Attaching a
 * subscription from the older event would resurrect a state Paddle has since left
 * (e.g. `created` retried after `canceled`).
 */
async function hasNewerStoredEvent(tx: Tx, subscriptionId: string, occurredAtIso: string, eventId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(
      and(
        sql`(${webhookEvents.payload} -> 'data' ->> 'id') = ${subscriptionId}`,
        sql`${webhookEvents.eventType} like 'subscription.%'`,
        sql`${webhookEvents.eventId} <> ${eventId}`,
        // Compared against the payload's own timestamp to keep Paddle's microsecond precision.
        sql`(${webhookEvents.payload} ->> 'occurred_at')::timestamptz > ${occurredAtIso}::timestamptz`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

// ---------------------------------------------------------------------------
// subscription.*
// ---------------------------------------------------------------------------

async function handleSubscriptionEvent(tx: Tx, envelope: PaddleEnvelope): Promise<HandlerResult> {
  const data = paddleSubscriptionSchema.parse(envelope.data);
  const occurredAtIso = envelope.occurred_at;
  const occurredAt = new Date(occurredAtIso);
  const checkout = verifyCheckoutData(data.custom_data);

  // 1. A subscription we already track stays with its workspace.
  const [bound] = await tx
    .select({ organizationId: subscriptions.organizationId })
    .from(subscriptions)
    .where(eq(subscriptions.paddleSubscriptionId, data.id));

  let organizationId: string;
  /** Set when this event is allowed to ATTACH the subscription to the workspace. */
  let attach: { userId: string; nonce: string } | null = null;

  if (bound) {
    organizationId = bound.organizationId;
    if (checkout.ok && checkout.organizationId !== organizationId) {
      const note = `Subscription ${data.id} is bound to another workspace than its signed checkout data names; nothing was changed`;
      return { outcome: "ignored_conflict", note, effects: [() => reportError(new Error(note), { route: "webhook:paddle", organizationId })] };
    }
  } else {
    // 2. Never seen before: only server-signed checkout data may say whose it is.
    if (!checkout.ok) {
      if (checkout.reason === "absent") {
        return { outcome: "ignored_unmapped", note: `No workspace found for subscription ${data.id} (no signed checkout data)` };
      }
      return { outcome: "ignored_unverified", note: `Subscription ${data.id}: checkout data rejected (${checkout.reason}); not attached to any workspace` };
    }
    if (!(await organizationExists(tx, checkout.organizationId))) {
      return { outcome: "ignored_unmapped", note: `No workspace found for subscription ${data.id} (workspace in checkout data does not exist)` };
    }
    organizationId = checkout.organizationId;
    attach = { userId: checkout.userId, nonce: checkout.nonce };
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

  if (sameSubscription && previous) {
    if (previous.paddleCustomerId && previous.paddleCustomerId !== data.customer_id) {
      const note = `Subscription ${data.id} arrived with a different Paddle customer than the one bound to workspace ${organizationId}; nothing was changed`;
      return { outcome: "ignored_conflict", note, effects: [() => reportError(new Error(note), { route: "webhook:paddle", organizationId })] };
    }
    if (existing?.isStale) return { outcome: "ignored_stale", note: `Older than last applied event for ${data.id}` };
  } else {
    // This event would attach a subscription the workspace does not have yet.
    if (!attach || !checkout.ok) {
      // `bound` to this workspace's row is the only way to get here without signed data, and then sameSubscription is true.
      return { outcome: "ignored_unverified", note: `Subscription ${data.id}: no signed checkout data; not attached` };
    }
    const ageSeconds = (occurredAt.getTime() - checkout.issuedAt.getTime()) / 1000;
    if (ageSeconds > CHECKOUT_MAX_AGE_SECONDS || ageSeconds < -CHECKOUT_CLOCK_SKEW_SECONDS) {
      return { outcome: "ignored_unverified", note: `Subscription ${data.id}: signed checkout data is outside its validity window; not attached` };
    }
    if (!(await isOwner(tx, organizationId, attach.userId))) {
      return { outcome: "ignored_unverified", note: `Subscription ${data.id}: the checkout was signed for a user who is not an owner of the workspace; not attached` };
    }
    const [usedNonce] = await tx
      .select({ paddleSubscriptionId: billingCheckoutNonces.paddleSubscriptionId })
      .from(billingCheckoutNonces)
      .where(eq(billingCheckoutNonces.nonce, attach.nonce));
    if (usedNonce && usedNonce.paddleSubscriptionId !== data.id) {
      return { outcome: "ignored_unverified", note: `Subscription ${data.id}: replayed checkout data (already used for ${usedNonce.paddleSubscriptionId}); not attached` };
    }

    if (previous?.paddleSubscriptionId) {
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
      // previous is dead, incoming is live: the workspace re-subscribed. Replace it — unless…
    }
    // …Paddle has already told us something newer about this very subscription.
    if (await hasNewerStoredEvent(tx, data.id, occurredAtIso, envelope.event_id)) {
      return { outcome: "ignored_stale", note: `A newer event for ${data.id} was already received; this one cannot attach it` };
    }
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
    // The binding (who signed, when it was verified) is written only when attaching.
    ...(attach ? { checkoutUserId: attach.userId, verifiedAt: new Date() } : {}),
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
  if (attach) {
    await tx
      .insert(billingCheckoutNonces)
      .values({ nonce: attach.nonce, organizationId, userId: attach.userId, paddleSubscriptionId: data.id })
      .onConflictDoNothing({ target: billingCheckoutNonces.nonce });
  }

  if (planKey === "unknown") {
    log.warn("paddle price id is not in the plan catalogue; workspace falls back to free", {
      organizationId,
      priceId: item.price.id,
    });
  }
  const note = planKey === "unknown" ? `Unknown price id ${item.price.id}` : undefined;

  // Audit entry and analytics are written once per event, however often it is replayed.
  if (await alreadyAudited(tx, organizationId, envelope.event_id)) return { outcome: "processed", note };
  await tx.insert(auditLog).values({
    organizationId,
    actorType: "paddle",
    actorId: null,
    action: `billing.${envelope.event_type}`,
    target: `subscription:${data.id}`,
    metadata: { eventId: envelope.event_id, status: data.status, planKey, priceId: item.price.id },
  });

  const signer = checkout.ok && checkout.organizationId === organizationId ? checkout.userId : (previous?.checkoutUserId ?? null);
  const context = { organizationId, userId: await existingUserId(tx, signer) };
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

  return { outcome: "processed", note, effects };
}

// ---------------------------------------------------------------------------
// transaction.*
// ---------------------------------------------------------------------------

async function handleTransactionEvent(tx: Tx, envelope: PaddleEnvelope): Promise<HandlerResult> {
  const data = paddleTransactionSchema.parse(envelope.data);
  const checkout = verifyCheckoutData(data.custom_data);

  // A payment is recorded for the workspace its subscription is bound to, or — before the
  // subscription exists — for the workspace its checkout was signed for. Never by customer
  // id or e-mail. (A payment alone grants nothing; this is audit and analytics only.)
  let organizationId: string | null = null;
  if (data.subscription_id) {
    const [bound] = await tx
      .select({ organizationId: subscriptions.organizationId })
      .from(subscriptions)
      .where(eq(subscriptions.paddleSubscriptionId, data.subscription_id));
    organizationId = bound?.organizationId ?? null;
  }
  if (!organizationId) {
    if (checkout.ok && (await organizationExists(tx, checkout.organizationId))) organizationId = checkout.organizationId;
    else if (!checkout.ok && checkout.reason !== "absent") {
      return { outcome: "ignored_unverified", note: `Transaction ${data.id}: checkout data rejected (${checkout.reason})` };
    }
  }
  if (!organizationId) {
    return { outcome: "ignored_unmapped", note: `No workspace found for transaction ${data.id}` };
  }

  if (await alreadyAudited(tx, organizationId, envelope.event_id)) return { outcome: "processed" };

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

  const context = { organizationId, userId: await existingUserId(tx, checkout.ok && checkout.organizationId === organizationId ? checkout.userId : null) };
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
