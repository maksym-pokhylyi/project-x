import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";

/**
 * Conventions
 * - Every tenant-owned table carries `organization_id` (FK -> organizations.id).
 * - Timestamps are timestamptz, stored in UTC.
 * - Append-only log tables keep rows even if the user/org is deleted (FK set null).
 */

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const tz = (name: string) => timestamp(name, { withTimezone: true });

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

/** One row per organization: the local cache of its Paddle subscription. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    paddleCustomerId: text("paddle_customer_id"),
    paddleSubscriptionId: text("paddle_subscription_id"),
    /** Paddle status: active | trialing | past_due | paused | canceled */
    status: text("status").notNull(),
    /** Key from src/config/plans.ts resolved from price_id ("unknown" if unmapped). */
    planKey: text("plan_key").notNull(),
    priceId: text("price_id"),
    /** month | year */
    billingInterval: text("billing_interval"),
    quantity: integer("quantity").notNull().default(1),
    currentPeriodStart: tz("current_period_start"),
    currentPeriodEnd: tz("current_period_end"),
    /** When a scheduled cancellation takes effect (scheduled_change.action = cancel). */
    cancelAt: tz("cancel_at"),
    canceledAt: tz("canceled_at"),
    pausedAt: tz("paused_at"),
    trialEnd: tz("trial_end"),
    /** When the subscription entered past_due; drives the grace period. */
    pastDueSince: tz("past_due_since"),
    /** Billing contact as known to Paddle (from customer.* events). */
    customerEmail: text("customer_email"),
    /** occurred_at of the newest event applied; older events are ignored. */
    lastEventAt: tz("last_event_at"),
    /**
     * users.id of the owner whose server-signed checkout created this subscription
     * (see src/lib/billing/checkout-signature.ts). Null for manual/legacy rows.
     */
    checkoutUserId: text("checkout_user_id"),
    /**
     * Set when paddle_subscription_id and paddle_customer_id were bound to this workspace by
     * an event carrying a valid checkout signature. Self-service billing links are only
     * created for rows where this is set.
     */
    verifiedAt: tz("verified_at"),
    /** Last time the daily reconciliation job compared this row with the Paddle API. */
    reconciledAt: tz("reconciled_at"),
    /** Last subscription entity received from Paddle, for debugging/audit. */
    raw: jsonb("raw"),
    createdAt: createdAt(),
    updatedAt: tz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriptions_organization_id_key").on(t.organizationId),
    uniqueIndex("subscriptions_paddle_subscription_id_key").on(t.paddleSubscriptionId),
    index("subscriptions_paddle_customer_id_idx").on(t.paddleCustomerId),
    index("subscriptions_status_idx").on(t.status),
  ],
);

/** Every webhook delivery we accepted, for idempotency, audit and replay. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    occurredAt: tz("occurred_at").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: tz("received_at").notNull().defaultNow(),
    /** Set once handling finished successfully (including deliberate ignores). */
    processedAt: tz("processed_at"),
    /** processed | ignored_stale | ignored_unhandled | ignored_unmapped | ignored_conflict | ignored_unverified */
    outcome: text("outcome"),
    /** Last processing error; cleared on success. */
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
  },
  (t) => [
    uniqueIndex("webhook_events_event_id_key").on(t.eventId),
    index("webhook_events_received_at_idx").on(t.receivedAt),
    index("webhook_events_unprocessed_idx").on(t.receivedAt).where(sql`${t.processedAt} is null`),
    // Lookups by the Paddle entity an event is about (customer e-mail, newer events of a subscription).
    index("webhook_events_data_id_idx").on(sql`((${t.payload} -> 'data' ->> 'id'))`, t.occurredAt),
  ],
);

/**
 * Checkout nonces that have attached a subscription to a workspace. A nonce comes from
 * server-signed checkout data and may bind exactly ONE Paddle subscription: replaying the
 * same signed data with another subscription is refused (see resolveVerifiedCheckout).
 */
export const billingCheckoutNonces = pgTable(
  "billing_checkout_nonces",
  {
    nonce: text("nonce").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    paddleSubscriptionId: text("paddle_subscription_id").notNull(),
    consumedAt: tz("consumed_at").notNull().defaultNow(),
  },
  (t) => [index("billing_checkout_nonces_organization_id_idx").on(t.organizationId)],
);

/** Metered usage per organization, metric and period (see consumeQuota). */
export const usageCounters = pgTable(
  "usage_counters",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(),
    /** First instant of the period (UTC month start, or epoch for lifetime metrics). */
    periodStart: tz("period_start").notNull(),
    quantity: bigint("quantity", { mode: "number" }).notNull().default(0),
    updatedAt: tz("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.metric, t.periodStart] })],
);

// ---------------------------------------------------------------------------
// Analytics, audit, errors
// ---------------------------------------------------------------------------

/** Internal product analytics; written only through track() in src/lib/analytics. */
export const events = pgTable(
  "events",
  {
    id: id(),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    properties: jsonb("properties").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("events_name_created_at_idx").on(t.name, t.createdAt),
    index("events_organization_id_created_at_idx").on(t.organizationId, t.createdAt),
    index("events_created_at_idx").on(t.createdAt),
  ],
);

/** Security/business-relevant actions inside a workspace. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** user | system | paddle */
    actorType: text("actor_type").notNull(),
    /** users.id when actor_type = user (kept even if the user is later deleted). */
    actorId: text("actor_id"),
    action: text("action").notNull(),
    /** e.g. "member:abc123", "subscription:sub_01...", "organization:xyz" */
    target: text("target"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_organization_id_created_at_idx").on(t.organizationId, t.createdAt)],
);

/** Unexpected server errors (see reportError in src/lib/errors). */
export const errorLog = pgTable(
  "error_log",
  {
    id: id(),
    requestId: text("request_id"),
    organizationId: text("organization_id"),
    userId: text("user_id"),
    /** Route or logical source, e.g. "/api/webhooks/paddle" or "job:email.send". */
    route: text("route"),
    method: text("method"),
    message: text("message").notNull(),
    stack: text("stack"),
    digest: text("digest"),
    context: jsonb("context").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("error_log_created_at_idx").on(t.createdAt)],
);

// ---------------------------------------------------------------------------
// Email, jobs, rate limits
// ---------------------------------------------------------------------------

/**
 * Every transactional e-mail. Without RESEND_API_KEY the row IS the delivery
 * (status = "outbox", readable at /dev/outbox); with it, the row tracks sending.
 */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: id(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    template: text("template").notNull(),
    /** Rendered bodies. Cleared after a successful provider send (they contain one-time links). */
    html: text("html"),
    text: text("text"),
    /** Extra message headers (e.g. List-Unsubscribe), passed to the provider as they are. Cleared with the bodies. */
    headers: jsonb("headers").$type<Record<string, string>>(),
    /** outbox | queued | sent | failed */
    status: text("status").notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdAt: createdAt(),
    sentAt: tz("sent_at"),
  },
  (t) => [index("email_outbox_created_at_idx").on(t.createdAt), index("email_outbox_to_email_idx").on(t.toEmail)],
);

/** Durable background jobs (see src/lib/jobs). */
export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    /** pending | running | succeeded | failed (= gave up after max_attempts) */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAfter: tz("run_after").notNull().defaultNow(),
    lockedAt: tz("locked_at"),
    lastError: text("last_error"),
    /** Optional idempotency key: a second enqueue with the same key is a no-op. */
    dedupeKey: text("dedupe_key"),
    createdAt: createdAt(),
    updatedAt: tz("updated_at").notNull().defaultNow(),
    completedAt: tz("completed_at"),
  },
  (t) => [
    index("jobs_claim_idx").on(t.status, t.runAfter),
    uniqueIndex("jobs_dedupe_key_key").on(t.dedupeKey),
  ],
);

/** Fixed-window rate limiter state (see src/lib/rate-limit.ts). */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: tz("window_start").notNull(),
    count: integer("count").notNull().default(0),
    expiresAt: tz("expires_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_expires_at_idx").on(t.expiresAt)],
);

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

/** One row per model call made through src/lib/ai.ts. */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    feature: text("feature").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    /**
     * Estimate from src/config/ai.ts price table, not an invoice. While status = "reserved"
     * this is the worst-case cost held against the budgets; it is replaced by the real
     * cost when the call settles.
     */
    costUsd: numeric("cost_usd", { precision: 12, scale: 6, mode: "number" }).notNull().default(0),
    /** Worst-case cost reserved before the call (kept after settling, for comparison). */
    reservedUsd: numeric("reserved_usd", { precision: 12, scale: 6, mode: "number" }),
    /** Effective plan of the workspace when the call was made ("free" rows share the free pool). */
    planKey: text("plan_key"),
    latencyMs: integer("latency_ms").notNull().default(0),
    /** reserved (call in flight) | ok | error */
    status: text("status").notNull().default("ok"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ai_usage_organization_id_created_at_idx").on(t.organizationId, t.createdAt),
    index("ai_usage_created_at_idx").on(t.createdAt),
    index("ai_usage_reserved_idx").on(t.createdAt).where(sql`${t.status} = 'reserved'`),
  ],
);
