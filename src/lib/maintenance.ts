import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { RETENTION_DAYS } from "@/config/retention";
import { db } from "@/db";
import { settleStaleAiReservations } from "./ai";
import { purgeExpiredRateLimits } from "./rate-limit";

/**
 * Daily housekeeping (the `maintenance.cleanup` job): enforces src/config/retention.ts.
 *
 * Every delete runs in batches so a large backlog never holds a long lock or produces one
 * huge transaction; whatever does not fit in a run is picked up by the next one. The job
 * is idempotent — running it twice removes nothing extra.
 */
const BATCH_SIZE = 5_000;
const MAX_BATCHES = 20;

type Batching = { batchSize?: number; maxBatches?: number };

/** Deletes rows of `table` matching `condition`, `batchSize` at a time. Returns the number removed. */
async function deleteInBatches(table: string, condition: SQL, batching: Batching): Promise<number> {
  const batchSize = batching.batchSize ?? BATCH_SIZE;
  let total = 0;
  for (let batch = 0; batch < (batching.maxBatches ?? MAX_BATCHES); batch += 1) {
    const rows = await db.execute(sql`
      delete from ${sql.identifier(table)}
      where ctid in (select ctid from ${sql.identifier(table)} where ${condition} limit ${batchSize})
      returning 1
    `);
    total += rows.length;
    if (rows.length < batchSize) break;
  }
  return total;
}

const olderThan = (column: string, days: number) => sql`${sql.identifier(column)} < now() - make_interval(days => ${days}::int)`;

export type MaintenanceSummary = Record<
  | "rateLimits"
  | "jobsSucceeded"
  | "jobsFailed"
  | "events"
  | "errorLog"
  | "webhookPayloadsRedacted"
  | "webhookEvents"
  | "emailBodies"
  | "emailOutbox"
  | "sessions"
  | "verifications"
  | "invitations"
  | "aiUsage"
  | "auditLog"
  | "checkoutNonces"
  | "purchasePayloads"
  | "notificationLog"
  | "aiReservationsSettled"
  | "outreachProspectsErased"
  | "outreachAudit"
  | "outreachContactsStamped"
  | "supplierContactsErased",
  number
>;

export async function runMaintenance(batching: Batching = {}): Promise<MaintenanceSummary> {
  const d = RETENTION_DAYS;
  const batchSize = batching.batchSize ?? BATCH_SIZE;

  const rateLimits = await purgeExpiredRateLimits();
  const aiReservationsSettled = await settleStaleAiReservations();

  const jobsSucceeded = await deleteInBatches("jobs", sql`status = 'succeeded' and ${olderThan("completed_at", d.jobsSucceeded)}`, batching);
  const jobsFailed = await deleteInBatches("jobs", sql`status = 'failed' and ${olderThan("updated_at", d.jobsFailed)}`, batching);
  const events = await deleteInBatches("events", olderThan("created_at", d.events), batching);
  const errorLog = await deleteInBatches("error_log", olderThan("created_at", d.errorLog), batching);
  const aiUsage = await deleteInBatches("ai_usage", olderThan("created_at", d.aiUsage), batching);
  const auditLog = await deleteInBatches("audit_log", olderThan("created_at", d.auditLog), batching);
  const checkoutNonces = await deleteInBatches("billing_checkout_nonces", olderThan("consumed_at", d.checkoutNonces), batching);
  // One-off purchases keep their row (a business record); only the stored Paddle transaction goes.
  const purchasePayloads = await db.execute(sql`
    update billing_purchases set raw = null
    where ${olderThan("created_at", d.purchasePayload)} and raw is not null
    returning 1
  `);
  const notificationLog = await deleteInBatches("notification_log", olderThan("created_at", d.notificationLog), batching);

  // Paddle payloads: keep what idempotency and ordering need (ids, type, time), drop the rest.
  const redacted = await db.execute(sql`
    update webhook_events set payload = jsonb_build_object(
      'event_id', event_id,
      'event_type', event_type,
      'occurred_at', payload ->> 'occurred_at',
      'data', jsonb_build_object('id', payload -> 'data' ->> 'id'),
      'redacted', true
    )
    where ctid in (
      select ctid from webhook_events
      where ${olderThan("received_at", d.webhookPayload)} and payload ->> 'redacted' is null
      limit ${batchSize * (batching.maxBatches ?? MAX_BATCHES)}
    )
    returning 1
  `);
  const webhookEvents = await deleteInBatches("webhook_events", olderThan("received_at", d.webhookEvents), batching);

  const emailOutbox = await deleteInBatches("email_outbox", olderThan("created_at", d.emailOutbox), batching);
  // Unsent bodies of old e-mails still contain one-time links (and their headers an unsubscribe link).
  const emailBodies = await db.execute(sql`
    update email_outbox set html = null, text = null, headers = null
    where ${olderThan("created_at", d.emailBodies)} and (html is not null or text is not null or headers is not null)
    returning 1
  `);

  // Better Auth tables: expired sessions keep IP addresses and user agents; expired tokens are useless.
  const sessions = await deleteInBatches("sessions", olderThan("expires_at", d.sessionsExpired), batching);
  const verifications = await deleteInBatches("verifications", olderThan("expires_at", d.verificationsExpired), batching);
  const invitations = await deleteInBatches(
    "invitations",
    sql`(status <> 'pending' and ${olderThan("created_at", d.invitationsClosed)}) or ${olderThan("expires_at", d.invitationsClosed)}`,
    batching,
  );

  // Outreach: prospect addresses are erased (the rows stay for the counts), the audit trail is
  // trimmed and new contact rows are stamped from the suppression list. Imported lazily so the
  // job registry does not pull the outreach module into every bundle.
  const { runOutreachRetention } = await import("@/features/outreach/server/retention");
  const outreach = await runOutreachRetention();

  // Procurement: a contact address from a notice that identifies a person is erased in place
  // a month after it was stored. After the outreach step, so that an address whose prospect
  // copy was erased just now goes in the same run.
  const { runContactRetention } = await import("@/features/procurement/retention");
  const contacts = await runContactRetention(new Date(), batching);

  return {
    ...outreach,
    ...contacts,
    rateLimits,
    jobsSucceeded,
    jobsFailed,
    events,
    errorLog,
    webhookPayloadsRedacted: redacted.length,
    webhookEvents,
    emailBodies: emailBodies.length,
    emailOutbox,
    sessions,
    verifications,
    invitations,
    aiUsage,
    auditLog,
    checkoutNonces,
    purchasePayloads: purchasePayloads.length,
    notificationLog,
    aiReservationsSettled,
  };
}
