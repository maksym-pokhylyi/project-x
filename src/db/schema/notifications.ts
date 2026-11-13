import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";

/**
 * Scheduled e-mails (src/features/notifications): what each member wants to receive for a
 * workspace, and what was sent.
 *
 * Both tables are TENANT tables: `organization_id` and `user_id` cascade, so deleting a
 * workspace or an account removes its rows, and the catalogue-driven export and erasure
 * (src/server/tenant-data.ts) cover them without registration.
 */

const tz = (name: string) => timestamp(name, { withTimezone: true });

/**
 * Preferences per (user, workspace). A MISSING ROW MEANS THE DEFAULTS (everything on):
 * read them through `getNotificationPrefs()`, never straight from the table.
 */
export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    weeklyDigest: boolean("weekly_digest").notNull().default(true),
    /** Only has an effect on plans with daily alerts (see notificationAccess()). */
    dailyAlerts: boolean("daily_alerts").notNull().default(true),
    deadlineReminders: boolean("deadline_reminders").notNull().default(true),
    /** E-mails about something the member asked for ("your bid check is ready"). Sent by other modules. */
    productEmails: boolean("product_emails").notNull().default(true),
    /** The reminder before an annual plan renews (owners). A billing notice: NOT covered by "unsubscribe from all". */
    renewalReminders: boolean("renewal_reminders").notNull().default(true),
    /** Set by "unsubscribe from all e-mails": stops digests, alerts, deadline reminders and product e-mails. */
    unsubscribedAllAt: tz("unsubscribed_all_at"),
    createdAt: tz("created_at").notNull().defaultNow(),
    updatedAt: tz("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.organizationId] }), index("notification_prefs_organization_idx").on(t.organizationId)],
);

/** What an e-mail listed: enough to recognise an item again, never a title or an address. */
export type NotificationItemRef = {
  /** match | ending | saved | deadline */
  t: string;
  /** The procurement (ocid), or `<source>:<id>` for a deadline that has none. */
  ref: string;
  /** Ending-soon contracts: the supplier holding the contract. */
  supplier?: string;
  /** Deadline reminders: days before the closing date (7 or 2). */
  offset?: number;
};

/**
 * One row per (user, workspace, kind, period): the idempotency record of every scheduled
 * e-mail and the source of "new since last time".
 *
 *   kind        digest | alert | reminder | renewal
 *   period_key  digest: ISO week "2026-W47" · alert, reminder: UK day "2026-11-16" ·
 *               renewal: the day the paid period ends "2027-11-20"
 *   status      sent | skipped_empty | skipped_pref | failed
 *
 * The row is written in the SAME transaction as the outbox row, so "sent" and "logged"
 * cannot come apart; the unique key makes a second attempt for the same period a no-op.
 */
export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    periodKey: text("period_key").notNull(),
    status: text("status").notNull(),
    itemCount: integer("item_count").notNull().default(0),
    /** What was listed (ids only): validates clicks and keeps an item from being announced twice. */
    items: jsonb("items").$type<NotificationItemRef[]>().notNull().default(sql`'[]'::jsonb`),
    /** The instant the content was computed for: the next e-mail of this kind starts from here. */
    asOf: tz("as_of").notNull(),
    sentAt: tz("sent_at"),
    /** email_outbox.id of the message (no foreign key: outbox rows have their own retention). */
    outboxId: uuid("outbox_id"),
    /** Short machine-readable reason for `failed` (daily_ceiling, global_cap, error). */
    detail: text("detail"),
    /** Refs whose link was opened; each is counted once (`digest_clicked`). */
    clicked: jsonb("clicked").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    firstClickedAt: tz("first_clicked_at"),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_log_user_org_kind_period_key").on(t.userId, t.organizationId, t.kind, t.periodKey),
    index("notification_log_organization_idx").on(t.organizationId),
    index("notification_log_created_at_idx").on(t.createdAt),
    // Volume guards count what went out recently.
    index("notification_log_sent_at_idx").on(t.sentAt).where(sql`${t.status} = 'sent'`),
  ],
);
