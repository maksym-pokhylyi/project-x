import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox, jobs, notificationLog, organizations } from "@/db/schema";
import { features } from "@/env";
import { KIND_LABELS, notificationsConfig, SCHEDULED_KINDS, type ScheduledKind } from "./config";
import { latestSlot } from "./time";

/**
 * What /admin/notifications shows: whether scheduled e-mails are running, the last fan-out
 * of each kind, and seven days of outcomes. Founder-only data — callers guard with
 * requireAdmin()/requireAdminForPage(). Counts only: no addresses, no subjects.
 */
export type FanoutRun = { period: string; status: string; startedAt: Date; finishedAt: Date | null; error: string | null };

export type KindOverview = {
  kind: ScheduledKind;
  name: string;
  /** "Mondays 07:30" — UK time. */
  schedule: string;
  /** The slot the scheduler would run now (or ran last). */
  currentPeriod: string | null;
  lastFanout: FanoutRun | null;
  week: { sent: number; skippedEmpty: number; skippedPref: number; failed: number; opened: number; undelivered: number };
};

export type NotificationsOverview = {
  paused: boolean;
  mailDelivery: "resend" | "outbox" | "none";
  /** Sends still waiting in the job queue (staggered, deferred or retrying). */
  queuedSends: number;
  kinds: KindOverview[];
};

const TEMPLATE_OF_KIND: Record<ScheduledKind, string> = { digest: "radar-digest", alert: "radar-alert", reminder: "deadline-reminder", renewal: "renewal-reminder" };
const WEEKDAY_NAMES = ["", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];

function describeSchedule(kind: ScheduledKind): string {
  const { weekdays, hour, minute } = notificationsConfig.schedule[kind];
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const days = weekdays.length === 7 ? "Every day" : weekdays.length === 5 && weekdays.every((day, index) => day === index + 1) ? "Working days" : weekdays.map((day) => WEEKDAY_NAMES[day]).join(", ");
  return `${days} ${time}`;
}

export async function getNotificationsOverview(now: Date = new Date()): Promise<NotificationsOverview> {
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const kindOfJob = sql<string>`${jobs.payload}->>'kind'`;

  const [fanouts, outcomes, opened, undelivered, queued] = await Promise.all([
    // The newest FIRST page of each kind's fan-out (continuation pages carry a cursor).
    db
      .selectDistinctOn([kindOfJob], {
        kind: kindOfJob,
        period: sql<string>`${jobs.payload}->>'period'`,
        status: jobs.status,
        startedAt: jobs.createdAt,
        finishedAt: jobs.completedAt,
        error: jobs.lastError,
      })
      .from(jobs)
      .where(and(eq(jobs.type, "notifications.fanout"), sql`${jobs.payload}->>'cursor' is null`))
      .orderBy(kindOfJob, desc(jobs.createdAt)),
    db
      .select({ kind: notificationLog.kind, status: notificationLog.status, count: sql<number>`count(*)::int` })
      .from(notificationLog)
      .where(gte(notificationLog.createdAt, since))
      .groupBy(notificationLog.kind, notificationLog.status),
    db
      .select({ kind: notificationLog.kind, count: sql<number>`count(*)::int` })
      .from(notificationLog)
      .where(gte(notificationLog.firstClickedAt, since))
      .groupBy(notificationLog.kind),
    db
      .select({ template: emailOutbox.template, count: sql<number>`count(*)::int` })
      .from(emailOutbox)
      .where(and(inArray(emailOutbox.template, Object.values(TEMPLATE_OF_KIND)), eq(emailOutbox.status, "failed"), gte(emailOutbox.createdAt, since)))
      .groupBy(emailOutbox.template),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(and(eq(jobs.type, "notifications.send"), inArray(jobs.status, ["pending", "running"]))),
  ]);

  const count = (kind: ScheduledKind, status: string) => outcomes.find((row) => row.kind === kind && row.status === status)?.count ?? 0;
  return {
    paused: features.notificationsPaused,
    mailDelivery: features.mailDelivery,
    queuedSends: queued[0]?.count ?? 0,
    kinds: SCHEDULED_KINDS.map((kind) => {
      const last = fanouts.find((row) => row.kind === kind);
      return {
        kind,
        name: KIND_LABELS[kind].name,
        schedule: describeSchedule(kind),
        currentPeriod: latestSlot(kind, now)?.period ?? null,
        lastFanout: last ? { period: last.period, status: last.status, startedAt: last.startedAt, finishedAt: last.finishedAt, error: last.error } : null,
        week: {
          sent: count(kind, "sent"),
          skippedEmpty: count(kind, "skipped_empty"),
          skippedPref: count(kind, "skipped_pref"),
          failed: count(kind, "failed"),
          opened: opened.find((row) => row.kind === kind)?.count ?? 0,
          undelivered: undelivered.find((row) => row.template === TEMPLATE_OF_KIND[kind])?.count ?? 0,
        },
      };
    }),
  };
}

/** Workspaces to choose from in the preview form: the newest first. */
export async function listPreviewWorkspaces(limit = 200): Promise<Array<{ id: string; name: string }>> {
  return db.select({ id: organizations.id, name: organizations.name }).from(organizations).orderBy(desc(organizations.createdAt)).limit(limit);
}
