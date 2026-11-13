import "server-only";
import { features } from "@/env";
import { enqueueJob } from "@/lib/jobs/queue";
import { reportError } from "@/lib/report-error";
import { dueSlots, type DueSlot } from "./time";

/**
 * The scheduler of scheduled e-mails. Called on every tick of /api/cron/jobs (every five
 * minutes, UTC) — the same pattern as the once-a-day maintenance job there.
 *
 * Each tick asks "which slots are due in UK time?" (time.ts: Mondays 07:30 for the digest,
 * working days 07:30 for alerts, 08:00 daily for reminders) and enqueues one fan-out job
 * per (kind, period) with a dedupe key. The first tick after the slot creates the job;
 * every later tick of that period is a no-op. Running the tick twice is therefore safe.
 *
 * NOTIFICATIONS_PAUSED=1 stops it here (and in the jobs, for work already queued).
 * Never throws: the cron route must go on to run the worker.
 */
export type ScheduleResult = { status: "ok" | "paused" | "no_mail" | "error"; due: DueSlot[]; enqueued: string[] };

export const fanoutDedupeKey = (slot: Pick<DueSlot, "kind" | "period">) => `notifications.fanout:${slot.kind}:${slot.period}`;

export async function scheduleNotifications(now: Date = new Date()): Promise<ScheduleResult> {
  if (features.notificationsPaused) return { status: "paused", due: [], enqueued: [] };
  // A deployment that cannot deliver mail has nothing to schedule.
  if (features.mailDelivery === "none") return { status: "no_mail", due: [], enqueued: [] };
  const due = dueSlots(now);
  const enqueued: string[] = [];
  try {
    for (const slot of due) {
      const id = await enqueueJob("notifications.fanout", { kind: slot.kind, period: slot.period }, { dedupeKey: fanoutDedupeKey(slot), maxAttempts: 3 });
      if (id) enqueued.push(fanoutDedupeKey(slot));
    }
    return { status: "ok", due, enqueued };
  } catch (error) {
    await reportError(error, { route: "notifications.schedule" });
    return { status: "error", due, enqueued };
  }
}
