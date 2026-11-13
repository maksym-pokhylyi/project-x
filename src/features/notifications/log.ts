import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { notificationLog, type NotificationItemRef } from "@/db/schema";
import { notificationsConfig, type ScheduledKind } from "./config";
import { londonDayKey, londonDayStart } from "./time";

/**
 * notification_log: the idempotency record of scheduled e-mails.
 *
 * One row per (user, workspace, kind, period). `claimSend()` is the only way a row becomes
 * "sent", and it is called inside the transaction that also writes the outbox row — so the
 * unique key decides, atomically, which attempt (first run, retry, racing worker) sends.
 */
export type LogKey = { userId: string; organizationId: string; kind: ScheduledKind; periodKey: string };

export type SkipStatus = "skipped_empty" | "skipped_pref" | "failed";

/**
 * Claims the right to send for this key and records the send. Returns the row id, or null
 * when another attempt already holds it (sent, or deliberately skipped): the caller must
 * then send nothing. A row left "failed" by an earlier attempt is taken over.
 * Call it inside the transaction that writes the outbox row.
 */
export async function claimSend(
  tx: DbOrTx,
  key: LogKey,
  data: { asOf: Date; sentAt: Date; items: NotificationItemRef[]; itemCount: number },
): Promise<string | null> {
  const rows = await tx
    .insert(notificationLog)
    .values({ ...key, status: "sent", asOf: data.asOf, sentAt: data.sentAt, items: data.items, itemCount: data.itemCount })
    .onConflictDoUpdate({
      target: [notificationLog.userId, notificationLog.organizationId, notificationLog.kind, notificationLog.periodKey],
      set: { status: "sent", asOf: data.asOf, sentAt: data.sentAt, items: data.items, itemCount: data.itemCount, detail: null },
      setWhere: eq(notificationLog.status, "failed"),
    })
    .returning({ id: notificationLog.id });
  return rows[0]?.id ?? null;
}

export async function attachOutbox(tx: DbOrTx, logId: string, outboxId: string): Promise<void> {
  await tx.update(notificationLog).set({ outboxId }).where(eq(notificationLog.id, logId));
}

/**
 * Records that nothing was sent for this key, and why. Never overwrites an existing row:
 * a period that was sent stays sent. Returns true when the row was written.
 */
export async function recordSkip(key: LogKey, status: SkipStatus, data: { asOf: Date; detail?: string | null }): Promise<boolean> {
  const rows = await db
    .insert(notificationLog)
    .values({ ...key, status, asOf: data.asOf, detail: data.detail ?? null })
    .onConflictDoNothing()
    .returning({ id: notificationLog.id });
  return rows.length > 0;
}

/** True when this key already has a final row (anything but "failed"). */
export async function isSettled(key: LogKey): Promise<boolean> {
  const [row] = await db
    .select({ status: notificationLog.status })
    .from(notificationLog)
    .where(and(eq(notificationLog.userId, key.userId), eq(notificationLog.organizationId, key.organizationId), eq(notificationLog.kind, key.kind), eq(notificationLog.periodKey, key.periodKey)));
  return Boolean(row) && row!.status !== "failed";
}

/**
 * The moment the member's last e-mail of these kinds was computed for — sent, or skipped
 * because there was nothing new (which says the same: nothing up to then is news).
 * Null when there is none within the lookback limit.
 */
export async function lastCutoff(userId: string, organizationId: string, kinds: readonly ScheduledKind[], now: Date): Promise<Date | null> {
  const oldest = new Date(now.getTime() - notificationsConfig.maxLookbackDays * 86_400_000);
  const [row] = await db
    .select({ asOf: notificationLog.asOf })
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.userId, userId),
        eq(notificationLog.organizationId, organizationId),
        inArray(notificationLog.kind, [...kinds]),
        inArray(notificationLog.status, ["sent", "skipped_empty"]),
        gte(notificationLog.asOf, oldest),
      ),
    )
    .orderBy(desc(notificationLog.asOf))
    .limit(1);
  return row?.asOf ?? null;
}

/** Everything e-mails of these kinds listed for the member since `from` (ids only). */
export async function listedSince(userId: string, organizationId: string, kinds: readonly ScheduledKind[], from: Date): Promise<NotificationItemRef[]> {
  const rows = await db
    .select({ items: notificationLog.items })
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.userId, userId),
        eq(notificationLog.organizationId, organizationId),
        inArray(notificationLog.kind, [...kinds]),
        eq(notificationLog.status, "sent"),
        gte(notificationLog.asOf, from),
      ),
    );
  return rows.flatMap((row) => row.items ?? []);
}

/** Every (tender, offset) a deadline reminder already mentioned to this member in this workspace. */
export async function remindedBefore(userId: string, organizationId: string): Promise<Set<string>> {
  const rows = await db
    .select({ items: notificationLog.items })
    .from(notificationLog)
    .where(and(eq(notificationLog.userId, userId), eq(notificationLog.organizationId, organizationId), eq(notificationLog.kind, "reminder"), eq(notificationLog.status, "sent")));
  return new Set(rows.flatMap((row) => row.items ?? []).filter((item) => item.t === "deadline").map((item) => reminderKey(item.ref, item.offset ?? 0)));
}

export const reminderKey = (ref: string, offset: number) => `${ref}#${offset}`;

export type VolumeState = {
  /** Scheduled e-mails already sent to this member for this workspace today (UK day), renewal notices aside. */
  memberWorkspaceToday: number;
  /** …and to this person across all workspaces. */
  userToday: number;
  /** Scheduled e-mails sent to anyone within the current tick window. */
  lastTick: number;
};

/** What the volume guards need to know before one more e-mail goes out. */
export async function volumeState(userId: string, organizationId: string, now: Date): Promise<VolumeState> {
  const dayStart = londonDayStart(londonDayKey(now));
  const tickStart = new Date(now.getTime() - notificationsConfig.limits.tickMinutes * 60_000);
  const day = dayStart.toISOString();
  // Three small index lookups: the member's own rows (unique key), then the tick window (sent_at).
  const [row] = await db.execute<{ member_workspace: number; user_total: number; last_tick: number }>(sql`
    select
      (select count(*) from notification_log
        where user_id = ${userId} and organization_id = ${organizationId} and status = 'sent' and kind <> 'renewal' and sent_at >= ${day}::timestamptz)::int as member_workspace,
      (select count(*) from notification_log where user_id = ${userId} and status = 'sent' and sent_at >= ${day}::timestamptz)::int as user_total,
      (select count(*) from notification_log where status = 'sent' and sent_at >= ${tickStart.toISOString()}::timestamptz)::int as last_tick
  `);
  return { memberWorkspaceToday: row?.member_workspace ?? 0, userToday: row?.user_total ?? 0, lastTick: row?.last_tick ?? 0 };
}
