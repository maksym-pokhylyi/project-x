import "server-only";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  auditLog,
  billingCheckoutNonces,
  billingPayments,
  billingPurchases,
  members,
  organizations,
  subscriptions,
  users,
  webhookEvents,
  type PaymentMethodSummary,
} from "@/db/schema";
import { env, features } from "@/env";
import { track } from "@/lib/analytics";
import { errorReason } from "@/lib/describe-error";
import { log } from "@/lib/logger";
import { reportError } from "@/lib/report-error";
import { CHECKOUT_CLOCK_SKEW_SECONDS, CHECKOUT_MAX_AGE_SECONDS, verifyCheckoutData, type CheckoutVerification } from "./checkout-signature";
import { fulfilPurchase, revokePurchase, type PurchaseRow, type RevocationResult } from "./fulfilment";
import { formatMinorUnits } from "./money";
import { ONE_OFF_PRODUCTS, isOneOffKind, oneOffFromPriceId, type OneOffKind } from "./one-off";
import {
  ADJUSTMENT_EVENT_TYPES,
  CUSTOMER_EVENT_TYPES,
  SUBSCRIPTION_EVENT_TYPES,
  TRANSACTION_EVENT_TYPES,
  paddleAdjustmentSchema,
  paddleCustomerSchema,
  paddleEnvelopeSchema,
  paddleSubscriptionSchema,
  paddleTransactionSchema,
  type PaddleAdjustment,
  type PaddleEnvelope,
  type PaddleTransaction,
} from "./paddle-events";
import { summarizePaymentMethod } from "./payment-method";
import { planFromCheckoutPriceId } from "./trial";
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
 *  - A scheduled pause or cancellation (`scheduled_change`) is mirrored in `pause_at` /
 *    `cancel_at`, and both are cleared as soon as the change is removed or applied. A
 *    scheduled change never alters access by itself: the status does, when Paddle applies it.
 *  - A one-off purchase is recorded and fulfilled exactly once: `billing_purchases` is unique
 *    on the Paddle transaction id and the fulfilment hook runs in the same transaction as
 *    the insert, so a duplicate delivery, a forced replay or a second event for the same
 *    transaction never grants twice.
 *  - A purchase is never fulfilled once its full refund or chargeback has been RECEIVED,
 *    whichever of the two events is processed first (per-transaction lock + a look at the
 *    stored adjustment events). A full refund or chargeback takes back what is still unused;
 *    a partial one never revokes.
 *  - Money never disappears silently: a completed one-off transaction that cannot be
 *    recorded (no or invalid signed checkout data, a price outside the catalogue) is parked
 *    AND reported to the operator, as is every refund, chargeback and dispute warning.
 *  - Every completed payment is recorded once per transaction in `billing_payments` (the
 *    receipts list). What is kept about the payment method is five non-sensitive fields
 *    (./payment-method.ts) — never the cardholder name — and an older transaction never
 *    overwrites the method of a newer one.
 *  - Test mode never mixes with live data: every stored event, subscription, payment and
 *    purchase carries the Paddle environment it came from (PADDLE_ENV at that moment), and
 *    an event is only processed or replayed while the deployment runs that environment.
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
 *  4. A one-off purchase (a completed transaction that belongs to no subscription) is
 *     recorded ONLY through checkout data signed by this server for that workspace: valid
 *     HMAC, signed recently (same window as above, measured against the event's own
 *     timestamp), signed for a user who is still a member of it. Once recorded, the purchase
 *     stays with that workspace.
 *  5. A refund or chargeback follows its transaction: to the purchase or payment recorded
 *     for it, or to the workspace its subscription is bound to. Never by customer id.
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
      environment: env.PADDLE_ENV,
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
      // Test mode never mixes with live data: an event is processed only while the deployment
      // runs the Paddle environment it was received from (rows older than the column are sandbox).
      const receivedFrom = row.environment ?? "sandbox";
      if (receivedFrom !== env.PADDLE_ENV) {
        throw new Error(`This event was received from the Paddle ${receivedFrom} environment, but this deployment now runs ${env.PADDLE_ENV} billing: it cannot be processed here.`);
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
  if ((ADJUSTMENT_EVENT_TYPES as readonly string[]).includes(type)) return handleAdjustmentEvent(tx, envelope);
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

async function isMember(tx: Tx, organizationId: string, userId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.organizationId, organizationId), eq(members.userId, userId)));
  return Boolean(row);
}

/** Serialises all subscription changes of one workspace (works with PgBouncer: tx-scoped). */
async function lockWorkspaceSubscription(tx: Tx, organizationId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subscription:${organizationId}`}))`);
}

/**
 * Serialises everything that concerns ONE Paddle transaction: its payment event and its
 * refunds/chargebacks. Whichever is processed first has committed before the other one
 * reads, so "refund first, payment second" cannot slip through.
 * Lock order (no cycles): transaction lock, then workspace lock — never the reverse.
 */
async function lockPaddleTransaction(tx: Tx, transactionId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`billing-transaction:${transactionId}`}))`);
}

/** Paddle amounts are strings of digits in the currency's minor units ("14900"). */
function minorUnits(value: string | null | undefined): number | null {
  return typeof value === "string" && /^\d{1,15}$/.test(value) ? Number(value) : null;
}

/** Is the signed checkout data still inside its validity window, measured against the event's own timestamp? */
function checkoutIsFresh(issuedAt: Date, occurredAt: Date): boolean {
  const ageSeconds = (occurredAt.getTime() - issuedAt.getTime()) / 1000;
  return ageSeconds <= CHECKOUT_MAX_AGE_SECONDS && ageSeconds >= -CHECKOUT_CLOCK_SKEW_SECONDS;
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

  await lockWorkspaceSubscription(tx, organizationId);

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
    if (!checkoutIsFresh(checkout.issuedAt, occurredAt)) {
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

  // Prefer the item whose price is in our catalogue (subscriptions may carry add-ons). The
  // catalogue includes the no-trial twins of the plan prices (./trial.ts).
  const mappedItem = data.items.find((item) => planFromCheckoutPriceId(item.price.id));
  const item = mappedItem ?? data.items[0]!;
  const mapping = planFromCheckoutPriceId(item.price.id);
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
    // Paddle carries at most ONE scheduled change. Both columns follow the payload on every
    // event, so they are cleared as soon as the change is removed (undo) or applied.
    cancelAt: data.scheduled_change?.action === "cancel" ? new Date(data.scheduled_change.effective_at) : null,
    pauseAt: data.scheduled_change?.action === "pause" ? new Date(data.scheduled_change.effective_at) : null,
    canceledAt: data.canceled_at ? new Date(data.canceled_at) : null,
    pausedAt: data.paused_at ? new Date(data.paused_at) : null,
    trialEnd: item.trial_dates?.ends_at ? new Date(item.trial_dates.ends_at) : null,
    pastDueSince,
    customerEmail,
    raw: data,
    updatedAt: new Date(),
    // The binding (who signed, when it was verified) is written only when attaching.
    ...(attach ? { checkoutUserId: attach.userId, verifiedAt: new Date() } : {}),
    // Which Paddle environment this subscription lives in (kept once known; an older row is labelled by its next event).
    paddleEnvironment: (sameSubscription ? previous?.paddleEnvironment : null) ?? env.PADDLE_ENV,
    // The card on file belongs to a subscription, not to the workspace: a subscription that
    // is being attached starts from the payments already recorded for IT (its payment event
    // may have arrived first) and never inherits the previous subscription's card.
    ...(sameSubscription ? {} : await paymentMethodOnFile(tx, organizationId, data.id)),
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
    // A pause or cancellation was scheduled for the end of the paid period — or taken back.
    // (When the change is APPLIED the status leaves the live ones; that is tracked above.)
    const scheduled = values.cancelAt ? "cancel" : values.pauseAt ? "pause" : null;
    const scheduledBefore = before.cancelAt ? "cancel" : before.pauseAt ? "pause" : null;
    if (scheduled !== scheduledBefore && LIVE_STATUSES.has(data.status)) {
      if (scheduled) effects.push(() => track("billing.subscription_change_scheduled", context, { plan: planKey, change: scheduled }));
      else if (scheduledBefore) effects.push(() => track("billing.subscription_change_unscheduled", context, { plan: planKey, change: scheduledBefore }));
    }
  }

  return { outcome: "processed", note, effects };
}

/**
 * The payment method of the newest payment recorded for a subscription in this workspace
 * (see recordPayment), or nulls. Used when a subscription is attached to a workspace.
 */
async function paymentMethodOnFile(
  tx: Tx,
  organizationId: string,
  subscriptionId: string,
): Promise<{ paymentMethod: PaymentMethodSummary | null; paymentMethodAt: Date | null }> {
  const [row] = await tx
    .select({ paymentMethod: billingPayments.paymentMethod, paidAt: billingPayments.paidAt })
    .from(billingPayments)
    .where(
      and(
        eq(billingPayments.organizationId, organizationId),
        eq(billingPayments.paddleSubscriptionId, subscriptionId),
        isNotNull(billingPayments.paymentMethod),
      ),
    )
    .orderBy(desc(billingPayments.paidAt))
    .limit(1);
  return { paymentMethod: row?.paymentMethod ?? null, paymentMethodAt: row?.paidAt ?? null };
}

// ---------------------------------------------------------------------------
// transaction.*
// ---------------------------------------------------------------------------

type PurchasedItem = { priceId: string; quantity: number };

function transactionItems(data: PaddleTransaction): PurchasedItem[] {
  return (data.items ?? []).flatMap((item) => {
    const priceId = item.price?.id ?? item.price_id;
    return priceId ? [{ priceId, quantity: item.quantity ?? 1 }] : [];
  });
}

/** When Paddle billed the transaction (the receipt's date); the event's own time if the payload has none we can read. */
function paidAtOf(data: PaddleTransaction, envelope: PaddleEnvelope): Date {
  const billedAt = data.billed_at ? Date.parse(data.billed_at) : Number.NaN;
  return new Date(Number.isNaN(billedAt) ? envelope.occurred_at : billedAt);
}

/**
 * What the customer was charged. `grand_total` is the amount due after credits — the money
 * that actually moved — and `grand_total_tax` the tax in it.
 */
function paymentTotals(data: PaddleTransaction): { subtotal: number; tax: number; total: number; currency: string } {
  const totals = data.details?.totals;
  const total = minorUnits(totals?.grand_total) ?? minorUnits(totals?.total) ?? 0;
  const tax = Math.min(total, minorUnits(totals?.grand_total_tax) ?? minorUnits(totals?.tax) ?? 0);
  const currency = (totals?.currency_code ?? data.currency_code ?? "").toUpperCase();
  return { subtotal: total - tax, tax, total, currency: /^[A-Z]{3}$/.test(currency) ? currency : "XXX" };
}

async function handleTransactionEvent(tx: Tx, envelope: PaddleEnvelope): Promise<HandlerResult> {
  const data = paddleTransactionSchema.parse(envelope.data);
  const checkout = verifyCheckoutData(data.custom_data);
  const succeeded = envelope.event_type === "transaction.completed";
  const items = transactionItems(data);

  // A completed transaction that belongs to no subscription — and does not sell a plan — is a
  // one-off purchase: it is the only event that will ever tell us about that money.
  if (succeeded && !data.subscription_id && !items.some((item) => planFromCheckoutPriceId(item.priceId))) {
    return handleOneOffPurchase(tx, envelope, data, checkout, items);
  }

  // A payment is recorded for the workspace its subscription is bound to, or — before the
  // subscription exists — for the workspace its checkout was signed for. Never by customer
  // id or e-mail. (A payment alone grants nothing; this is audit, receipts and analytics only.)
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

  // State first (idempotent, so a replay re-applies it): the receipt, and the card on file.
  if (succeeded) {
    await lockPaddleTransaction(tx, data.id);
    await recordPayment(tx, { organizationId, envelope, data, items });
    if (data.subscription_id) {
      await refreshPaymentMethod(tx, organizationId, data.subscription_id, summarizePaymentMethod(data.payments), paidAtOf(data, envelope));
    }
  }

  if (await alreadyAudited(tx, organizationId, envelope.event_id)) return { outcome: "processed" };

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
  const effects: PostCommitEffect[] = [
    succeeded
      ? () => track("billing.payment_succeeded", context, { amount, currency })
      : () => track("billing.payment_failed", context, { reason: failureReason }),
  ];

  // One-off products are fulfilled only when bought on their own (the checkout this server
  // prepares). Inside a subscription's transaction somebody paid for one and got nothing.
  const strayOneOff = succeeded ? items.map((item) => oneOffFromPriceId(item.priceId)).find((kind) => kind !== null) : undefined;
  if (strayOneOff) {
    const note = `Transaction ${data.id} of workspace ${organizationId} belongs to a subscription but also contains the one-off product ${ONE_OFF_PRODUCTS[strayOneOff].label}: it was NOT fulfilled — grant it by hand or refund it in Paddle`;
    effects.push(() => reportError(new Error(note), { route: "webhook:paddle", organizationId }));
    return { outcome: "processed", note, effects };
  }
  return { outcome: "processed", effects };
}

/**
 * The receipt of a completed transaction: one row per Paddle transaction, written once.
 * Its initial status takes into account refunds/chargebacks that were received earlier.
 */
async function recordPayment(
  tx: Tx,
  input: {
    organizationId: string;
    envelope: PaddleEnvelope;
    data: PaddleTransaction;
    items: PurchasedItem[];
    /** Set for a one-off purchase. */
    oneOff?: { kind: OneOffKind; priceId: string; quantity: number };
    /** Status already derived from the adjustments received so far; worked out here when omitted. */
    status?: string;
  },
): Promise<void> {
  const { data, items, oneOff } = input;
  const totals = paymentTotals(data);
  const planItem = oneOff ? undefined : items.find((item) => planFromCheckoutPriceId(item.priceId));
  const plan = planItem ? planFromCheckoutPriceId(planItem.priceId) : null;
  const quantity = oneOff?.quantity ?? planItem?.quantity ?? 1;
  const status = input.status ?? foldAdjustments(await receivedAdjustments(tx, data.id), totals.total);

  await tx
    .insert(billingPayments)
    .values({
      organizationId: input.organizationId,
      paddleTransactionId: data.id,
      paddleSubscriptionId: data.subscription_id ?? null,
      kind: oneOff ? "one_off" : "subscription",
      planKey: plan?.planKey ?? null,
      billingInterval: plan?.interval ?? null,
      product: oneOff?.kind ?? null,
      priceId: oneOff?.priceId ?? planItem?.priceId ?? items[0]?.priceId ?? null,
      quantity: Number.isInteger(quantity) && quantity > 0 && quantity < 2 ** 31 ? quantity : 1,
      subtotalMinor: totals.subtotal,
      taxMinor: totals.tax,
      totalMinor: totals.total,
      currency: totals.currency,
      invoiceNumber: data.invoice_number ? data.invoice_number.slice(0, 64) : null,
      status,
      paymentMethod: summarizePaymentMethod(data.payments),
      paidAt: paidAtOf(data, input.envelope),
      paddleEnvironment: env.PADDLE_ENV,
    })
    .onConflictDoNothing({ target: billingPayments.paddleTransactionId });
}

/**
 * Keeps "the card on file" of a subscription in step with its newest payment. A payment
 * that is OLDER than the one the stored summary came from (a late or replayed event)
 * changes nothing.
 */
async function refreshPaymentMethod(tx: Tx, organizationId: string, subscriptionId: string, method: PaymentMethodSummary | null, paidAt: Date): Promise<void> {
  if (!method) return;
  // Same lock as subscription events: an attach running right now either sees this payment's row, or its new row is seen here.
  await lockWorkspaceSubscription(tx, organizationId);
  await tx
    .update(subscriptions)
    .set({ paymentMethod: method, paymentMethodAt: paidAt, updatedAt: new Date() })
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.paddleSubscriptionId, subscriptionId),
        sql`(${subscriptions.paymentMethodAt} is null or ${subscriptions.paymentMethodAt} <= ${paidAt.toISOString()}::timestamptz)`,
      ),
    );
}

// ---------------------------------------------------------------------------
// One-off purchases (transaction.completed without a subscription)
// ---------------------------------------------------------------------------

/** More units than this in one purchase is not something the checkout sells: a person looks at it. */
const MAX_ONE_OFF_QUANTITY = 100;

/** Money was taken and nothing can be handed over automatically: park the event AND tell the operator. */
function parkedPurchase(outcome: WebhookOutcome, note: string, organizationId?: string): HandlerResult {
  return { outcome, note, effects: [() => reportError(new Error(note), { route: "webhook:paddle", organizationId })] };
}

/** What was paid for the purchased items (tax included): their own line totals when the payload has them. */
function purchaseAmount(data: PaddleTransaction, priceIds: ReadonlySet<string>): number | null {
  const lines = (data.details?.line_items ?? []).filter((line) => line.price_id && priceIds.has(line.price_id));
  if (lines.length === 0) return null;
  let sum = 0;
  for (const line of lines) {
    const total = minorUnits(line.totals?.total);
    if (total === null) return null;
    sum += total;
  }
  return sum;
}

/** The transaction as received, minus what must not be kept: payment attempts (card, PayPal) and the checkout link. */
function sanitizedTransaction(data: PaddleTransaction): Record<string, unknown> {
  const { payments: _payments, checkout: _checkout, ...rest } = data as Record<string, unknown>;
  return rest;
}

async function handleOneOffPurchase(
  tx: Tx,
  envelope: PaddleEnvelope,
  data: PaddleTransaction,
  checkout: CheckoutVerification,
  items: PurchasedItem[],
): Promise<HandlerResult> {
  await lockPaddleTransaction(tx, data.id);

  // 0. A purchase we already recorded stays with its workspace. A duplicate delivery, a replay
  //    or a second event for the same transaction re-applies state — fulfilPurchase() does
  //    nothing for a purchase that is fulfilled, revoked or refunded — and repeats no side effect.
  const [recorded] = await tx.select().from(billingPurchases).where(eq(billingPurchases.paddleTransactionId, data.id)).for("update");
  if (recorded) {
    if (checkout.ok && checkout.organizationId !== recorded.organizationId) {
      const note = `Transaction ${data.id} is recorded as a purchase of another workspace than its signed checkout data names; nothing was changed`;
      return { outcome: "ignored_conflict", note, effects: [() => reportError(new Error(note), { route: "webhook:paddle", organizationId: recorded.organizationId })] };
    }
    await fulfilPurchase(tx, recorded);
    return { outcome: "processed" };
  }

  // 1. Which workspace? Only checkout data signed by this server may say.
  const charged = "the customer was charged and nothing was granted";
  if (!checkout.ok) {
    return checkout.reason === "absent"
      ? parkedPurchase("ignored_unmapped", `One-off transaction ${data.id}: no signed checkout data, so no workspace; ${charged}`)
      : parkedPurchase("ignored_unverified", `One-off transaction ${data.id}: checkout data rejected (${checkout.reason}); ${charged}`);
  }
  if (!(await organizationExists(tx, checkout.organizationId))) {
    return parkedPurchase("ignored_unmapped", `One-off transaction ${data.id}: the workspace in its checkout data does not exist; ${charged}`);
  }
  const organizationId = checkout.organizationId;

  // 2. What was bought? Only prices of the one-off catalogue can be handed over.
  const oneOffItems = items.flatMap((item) => {
    const kind = oneOffFromPriceId(item.priceId);
    return kind ? [{ ...item, kind }] : [];
  });
  const first = oneOffItems[0];
  if (!first) {
    const prices = items.map((item) => item.priceId).join(", ") || "no items";
    return parkedPurchase("ignored_unmapped", `One-off transaction ${data.id} of workspace ${organizationId}: not a price of the one-off catalogue (${prices}); ${charged}`, organizationId);
  }

  // 3. Signed recently, by someone who still belongs to the workspace.
  if (!checkoutIsFresh(checkout.issuedAt, new Date(envelope.occurred_at))) {
    return parkedPurchase("ignored_unverified", `One-off transaction ${data.id} of workspace ${organizationId}: signed checkout data is outside its validity window; ${charged}`, organizationId);
  }
  if (!(await isMember(tx, organizationId, checkout.userId))) {
    return parkedPurchase("ignored_unverified", `One-off transaction ${data.id} of workspace ${organizationId}: the checkout was signed for a user who is not a member of the workspace; ${charged}`, organizationId);
  }

  // One purchase per transaction: the checkout this server prepares sells one product at a time.
  const kind = first.kind;
  const label = ONE_OFF_PRODUCTS[kind].label;
  const bought = oneOffItems.filter((item) => item.kind === kind);
  const quantity = bought.reduce((sum, item) => sum + item.quantity, 0);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ONE_OFF_QUANTITY) {
    return parkedPurchase("ignored_unmapped", `One-off transaction ${data.id} of workspace ${organizationId}: unusable quantity (${quantity}) of ${label}; ${charged}`, organizationId);
  }
  const totals = paymentTotals(data);
  const amountMinor = purchaseAmount(data, new Set(bought.map((item) => item.priceId))) ?? totals.total;

  // 4. Never hand over something whose refund or chargeback has already been received.
  const status = foldAdjustments(await receivedAdjustments(tx, data.id), amountMinor);
  const stillPaidFor = status === "completed" || status === "partially_refunded";

  const [purchase] = await tx
    .insert(billingPurchases)
    .values({
      organizationId,
      userId: checkout.userId,
      kind,
      paddleTransactionId: data.id,
      priceId: first.priceId,
      quantity,
      amountMinor,
      currency: totals.currency,
      status,
      revokedAt: stillPaidFor ? null : new Date(),
      paddleEnvironment: env.PADDLE_ENV,
      raw: sanitizedTransaction(data),
    })
    .onConflictDoNothing({ target: billingPurchases.paddleTransactionId })
    .returning();
  if (!purchase) throw new Error(`purchase for transaction ${data.id} could not be recorded`);
  await recordPayment(tx, { organizationId, envelope, data, items, oneOff: { kind, priceId: first.priceId, quantity }, status });

  // 5. Hand it over — in this same transaction: the purchase and its fulfilment commit together.
  const fulfilment = await fulfilPurchase(tx, purchase);

  if (await alreadyAudited(tx, organizationId, envelope.event_id)) return { outcome: "processed" };
  await tx.insert(auditLog).values({
    organizationId,
    actorType: "paddle",
    actorId: null,
    action: "billing.purchase_completed",
    target: `transaction:${data.id}`,
    metadata: {
      eventId: envelope.event_id,
      kind,
      quantity,
      amount: amountMinor,
      currency: totals.currency,
      userId: checkout.userId,
      status,
      fulfilled: fulfilment.fulfilled,
    },
  });

  const context = { organizationId, userId: await existingUserId(tx, checkout.userId) };
  const effects: PostCommitEffect[] = [
    () => track("billing.payment_succeeded", context, { amount: data.details?.totals?.grand_total ?? null, currency: totals.currency }),
    () => track("billing.purchase_completed", context, { kind, quantity, amount: amountMinor, currency: totals.currency }),
  ];
  const notes: string[] = [];
  if (!stillPaidFor) {
    notes.push(`${label} purchase ${data.id} of workspace ${organizationId} was refunded or disputed before its payment event was processed: nothing was granted`);
  }
  const leftovers = items.length - bought.length;
  if (leftovers > 0) {
    notes.push(`Transaction ${data.id} of workspace ${organizationId} contains ${leftovers} more item(s) besides ${label} × ${quantity}; they were not fulfilled — check it in Paddle`);
  }
  for (const note of notes) effects.push(() => reportError(new Error(note), { route: "webhook:paddle", organizationId }));
  return { outcome: "processed", note: notes.length > 0 ? notes.join(" · ") : undefined, effects };
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

// ---------------------------------------------------------------------------
// adjustment.* (refunds, credits, chargebacks)
// ---------------------------------------------------------------------------

/**
 * What an adjustment means for the payment it adjusts. Only an APPROVED adjustment moves
 * money (a refund starts as `pending_approval`); `reversed` is what Paddle sets on a
 * chargeback it has contested successfully.
 */
type AdjustmentEffect = "none" | "partial_refund" | "full_refund" | "partial_chargeback" | "full_chargeback" | "chargeback_reversed" | "chargeback_warning";

const adjustmentAction = (data: PaddleAdjustment): string => data.action.replace(/[^a-z_]/gi, "").toLowerCase().slice(0, 40) || "unknown";

/**
 * `paidMinor` is what was paid for the thing being adjusted. An adjustment is FULL when
 * Paddle says so (`type: full`) or when it covers at least that amount.
 */
function adjustmentEffect(data: PaddleAdjustment, paidMinor: number | null): AdjustmentEffect {
  const action = adjustmentAction(data);
  if (data.status === "reversed") return action === "chargeback" ? "chargeback_reversed" : "none";
  if (data.status !== "approved") return "none";
  const adjusted = minorUnits(data.totals?.total);
  const full = data.type === "full" || (paidMinor !== null && paidMinor > 0 && adjusted !== null && adjusted >= paidMinor);
  switch (action) {
    case "refund":
      return full ? "full_refund" : "partial_refund";
    case "chargeback":
      return full ? "full_chargeback" : "partial_chargeback";
    case "chargeback_reverse":
      return "chargeback_reversed";
    case "chargeback_warning":
      return "chargeback_warning";
    default:
      // credit, credit_reverse, chargeback_warning_reverse: no money left the payment.
      return "none";
  }
}

/** completed | refunded | partially_refunded | disputed — the status of a payment or purchase after an adjustment. */
function statusAfter(current: string, effect: AdjustmentEffect): string {
  switch (effect) {
    case "full_refund":
      return "refunded";
    case "partial_refund":
      return current === "completed" ? "partially_refunded" : current;
    case "full_chargeback":
    case "partial_chargeback":
      return "disputed";
    case "chargeback_reversed":
      return current === "disputed" ? "completed" : current;
    default:
      return current;
  }
}

/**
 * Refunds and chargebacks of a transaction that have already been RECEIVED (stored in
 * webhook_events, whatever became of them), newest state of each adjustment, oldest first.
 * Served by webhook_events_adjustment_transaction_idx.
 */
async function receivedAdjustments(tx: Tx, transactionId: string): Promise<PaddleAdjustment[]> {
  const rows = await tx
    .select({ payload: webhookEvents.payload })
    .from(webhookEvents)
    .where(
      and(
        // Same expressions as the partial index.
        sql`${webhookEvents.eventType} like 'adjustment.%'`,
        sql`(${webhookEvents.payload} -> 'data' ->> 'transaction_id') = ${transactionId}`,
      ),
    )
    .orderBy(asc(webhookEvents.occurredAt), asc(webhookEvents.receivedAt));
  const newest = new Map<string, PaddleAdjustment>();
  for (const row of rows) {
    const parsed = paddleAdjustmentSchema.safeParse((row.payload as { data?: unknown }).data);
    if (parsed.success) newest.set(parsed.data.id, parsed.data);
  }
  return [...newest.values()];
}

/** The status a payment starts with, given the adjustments that were received before it was recorded. */
function foldAdjustments(adjustments: PaddleAdjustment[], paidMinor: number | null): string {
  return adjustments.reduce((status, adjustment) => statusAfter(status, adjustmentEffect(adjustment, paidMinor)), "completed");
}

/**
 * A refund or chargeback follows its transaction.
 *
 * - For a ONE-OFF PURCHASE the purchase's status changes, and a full refund or chargeback
 *   takes back what is still unused (revokePurchase). A partial one never revokes.
 * - For a SUBSCRIPTION PAYMENT Paddle leaves the subscription's status unchanged, so the
 *   workspace would silently keep a plan nobody is paying for. We cannot decide that case
 *   automatically (a partial refund is not a cancellation): the receipt is marked, the
 *   event is written to the workspace's audit log and surfaced to the operator, who cancels
 *   in Paddle if needed.
 */
async function handleAdjustmentEvent(tx: Tx, envelope: PaddleEnvelope): Promise<HandlerResult> {
  const data = paddleAdjustmentSchema.parse(envelope.data);
  const action = adjustmentAction(data);
  if (data.transaction_id) await lockPaddleTransaction(tx, data.transaction_id);

  const [purchase] = data.transaction_id
    ? await tx.select().from(billingPurchases).where(eq(billingPurchases.paddleTransactionId, data.transaction_id)).for("update")
    : [];
  if (purchase) return handlePurchaseAdjustment(tx, envelope, data, action, purchase);

  // Not a purchase: the workspace is the one the subscription is bound to, or the one the
  // payment was recorded for. Never the customer id.
  let organizationId: string | null = null;
  if (data.subscription_id) {
    const [bound] = await tx
      .select({ organizationId: subscriptions.organizationId })
      .from(subscriptions)
      .where(eq(subscriptions.paddleSubscriptionId, data.subscription_id));
    organizationId = bound?.organizationId ?? null;
  }
  const [payment] = data.transaction_id
    ? await tx.select().from(billingPayments).where(eq(billingPayments.paddleTransactionId, data.transaction_id)).for("update")
    : [];
  organizationId ??= payment?.organizationId ?? null;
  if (!organizationId) {
    return {
      outcome: "ignored_unmapped",
      note: data.subscription_id ? `No workspace found for adjustment ${data.id}` : `Adjustment ${data.id} is not linked to a subscription or a recorded purchase`,
    };
  }

  // The receipt follows the money (idempotent, so a replay re-applies it).
  if (payment && payment.organizationId === organizationId) {
    const status = statusAfter(payment.status, adjustmentEffect(data, payment.totalMinor));
    if (status !== payment.status) await tx.update(billingPayments).set({ status }).where(eq(billingPayments.id, payment.id));
  }

  // adjustment.updated carries a new status for the same adjustment: one entry per (event) is enough.
  if (await alreadyAudited(tx, organizationId, envelope.event_id)) return { outcome: "processed" };
  await tx.insert(auditLog).values({
    organizationId,
    actorType: "paddle",
    actorId: null,
    action: `billing.adjustment_${action}`,
    target: `adjustment:${data.id}`,
    metadata: {
      eventId: envelope.event_id,
      status: data.status,
      subscriptionId: data.subscription_id ?? null,
      transactionId: data.transaction_id ?? null,
      amount: data.totals?.total ?? null,
      currency: data.totals?.currency_code ?? data.currency_code ?? null,
    },
  });

  const needsAttention = data.status === "approved" && (action === "refund" || action.startsWith("chargeback"));
  if (!needsAttention) return { outcome: "processed" };
  const note = data.subscription_id
    ? `Paddle ${action} approved for workspace ${organizationId} (${data.subscription_id}): the subscription keeps its status — cancel it in Paddle if access should end`
    : `Paddle ${action} approved for workspace ${organizationId} (${data.transaction_id ?? data.id}): check it in Paddle`;
  return { outcome: "processed", note, effects: [() => reportError(new Error(note), { route: "webhook:paddle", organizationId })] };
}

async function handlePurchaseAdjustment(
  tx: Tx,
  envelope: PaddleEnvelope,
  data: PaddleAdjustment,
  action: string,
  purchase: PurchaseRow,
): Promise<HandlerResult> {
  const organizationId = purchase.organizationId;
  const effect = adjustmentEffect(data, purchase.amountMinor);
  const status = statusAfter(purchase.status, effect);

  // State first (idempotent, so a replay re-applies it): status of the purchase and of its receipt…
  if (status !== purchase.status) {
    await tx.update(billingPurchases).set({ status }).where(eq(billingPurchases.id, purchase.id));
    await tx
      .update(billingPayments)
      .set({ status })
      .where(and(eq(billingPayments.paddleTransactionId, purchase.paddleTransactionId), eq(billingPayments.organizationId, organizationId)));
  }
  // …and a FULL refund or chargeback takes back what is still unused. Anything partial is a
  // person's decision. revokePurchase() does nothing for a purchase that is already revoked.
  let revocation: RevocationResult | null = null;
  if (effect === "full_refund" || effect === "full_chargeback") revocation = await revokePurchase(tx, purchase);

  if (await alreadyAudited(tx, organizationId, envelope.event_id)) return { outcome: "processed" };
  const amount = data.totals?.total ?? null;
  const currency = data.totals?.currency_code ?? data.currency_code ?? null;
  await tx.insert(auditLog).values({
    organizationId,
    actorType: "paddle",
    actorId: null,
    action: `billing.adjustment_${action}`,
    target: `adjustment:${data.id}`,
    metadata: {
      eventId: envelope.event_id,
      status: data.status,
      subscriptionId: null,
      transactionId: purchase.paddleTransactionId,
      amount,
      currency,
      purchase: purchase.kind,
      purchaseStatus: status,
      ...(revocation ? { revoked: revocation.revoked.length, kept: revocation.kept.length } : {}),
    },
  });
  if (effect === "none") return { outcome: "processed" };

  const label = isOneOffKind(purchase.kind) ? ONE_OFF_PRODUCTS[purchase.kind].label : purchase.kind;
  const subject = `${label} purchase ${purchase.paddleTransactionId} of workspace ${organizationId}`;
  const adjusted = minorUnits(amount);
  const money = adjusted !== null && currency ? ` (${formatMinorUnits(adjusted, currency)})` : "";
  let note: string;
  switch (effect) {
    case "full_refund":
    case "full_chargeback": {
      const what = effect === "full_refund" ? "refunded in full" : "charged back";
      const kept = revocation?.kept.length ?? 0;
      const revoked = revocation?.revoked.length ?? 0;
      if (kept > 0) note = `${subject} was ${what}${money}, but ${kept} of ${purchase.quantity} had already been used and stay with the customer (${revoked} taken back) — decide in Paddle whether that stands`;
      else if (!purchase.fulfilledAt) note = `${subject} was ${what}${money}; nothing had been handed over`;
      else if (purchase.revokedAt) note = `${subject} was ${what}${money}; it had already been revoked`;
      else note = `${subject} was ${what}${money}; ${revoked} unused unit(s) were taken back`;
      break;
    }
    case "partial_refund":
      note = `${subject}: partial refund approved${money}; nothing was revoked — check whether the purchase should stand`;
      break;
    case "partial_chargeback":
      note = `${subject}: partial chargeback${money}; nothing was revoked — check it in Paddle`;
      break;
    case "chargeback_reversed":
      note = `${subject}: the chargeback was reversed, the payment stands again${purchase.revokedAt ? " — it was revoked earlier: restore it by hand" : ""}`;
      break;
    default:
      note = `${subject}: chargeback warning received — a dispute may follow; nothing was changed`;
  }

  const context = { organizationId, userId: await existingUserId(tx, purchase.userId) };
  const effects: PostCommitEffect[] = [() => reportError(new Error(note), { route: "webhook:paddle", organizationId })];
  if (effect !== "chargeback_warning") {
    effects.push(() =>
      track("billing.purchase_adjusted", context, { kind: purchase.kind, effect, revoked: revocation?.revoked.length ?? 0, kept: revocation?.kept.length ?? 0 }),
    );
  }
  return { outcome: "processed", note, effects };
}
