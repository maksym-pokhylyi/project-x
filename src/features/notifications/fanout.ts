import "server-only";
import { features } from "@/env";
import { enqueueJob } from "@/lib/jobs/queue";
import { notificationsConfig, type ScheduledKind } from "./config";
import { deadlineSources } from "./content/reminders";
import { listRenewalsDue } from "./content/renewal";
import { sendDedupeKey } from "./deliver";
import { listFanoutMembers, type FanoutMember } from "./recipients";
import { addDaysToDayKey, latestSlot, londonDayKey, londonDayStart, londonParts } from "./time";

/**
 * Fan-out (the `notifications.fanout` job): one `notifications.send` job per member who
 * should hear from us for this kind and period.
 *
 * Send jobs carry the dedupe key `<kind>:<workspace>:<user>:<period>` — for the digest
 * `digest:<org>:<user>:<iso-week>` — so a fan-out that runs twice (a retry, a second tick)
 * adds nothing. Members are read a page at a time; a large list continues in a follow-up
 * job instead of one long run. Sends are spread over the five-minute ticks, `perTick` at a
 * time, which is the first of the two volume guards (the second is checked at send time).
 */
export type FanoutPayload = {
  kind: ScheduledKind;
  period: string;
  /** Continue after this member. */
  cursor?: FanoutMember | null;
  /** Members already queued by earlier pages of this fan-out (for spreading the sends). */
  offset?: number;
  /** A simulated moment (dev tools only, see jobs.ts): handed on to the send jobs. */
  at?: string;
};

export type FanoutResult = { status: "done" | "continued" | "paused" | "stale"; enqueued: number };

const SEND_ATTEMPTS = 4;

/** When the n-th send of a fan-out may start: `perTick` per tick. */
function startTime(now: Date, index: number): Date {
  const { perTick, tickMinutes } = notificationsConfig.limits;
  return new Date(now.getTime() + Math.floor(index / perTick) * tickMinutes * 60_000);
}

async function enqueueSends(kind: ScheduledKind, period: string, members: readonly FanoutMember[], now: Date, offset: number, at?: string): Promise<number> {
  // A simulated run is spread from the real clock: its jobs must be claimable now.
  const base = at ? new Date() : now;
  let enqueued = 0;
  for (const [index, member] of members.entries()) {
    const payload = { kind, period, organizationId: member.organizationId, userId: member.userId, ...(at ? { at } : {}) };
    const id = await enqueueJob("notifications.send", payload, { dedupeKey: sendDedupeKey(payload), runAfter: startTime(base, offset + index), maxAttempts: SEND_ATTEMPTS });
    if (id) enqueued += 1;
  }
  return enqueued;
}

/** The UK days on which a tender must close to be mentioned today (today + 7, today + 2), as instant ranges. */
export function reminderRanges(now: Date): Array<{ from: Date; to: Date }> {
  const today = londonDayKey(now);
  return notificationsConfig.reminder.offsets.map((days) => {
    const day = addDaysToDayKey(today, days);
    return { from: londonDayStart(day), to: londonDayStart(addDaysToDayKey(day, 1)) };
  });
}

export async function runFanout(payload: FanoutPayload, options: { now?: Date } = {}): Promise<FanoutResult> {
  const now = options.now ?? new Date();
  if (features.notificationsPaused || features.mailDelivery === "none") return { status: "paused", enqueued: 0 };
  // A fan-out that was queued for a period which has since passed does nothing.
  const slot = latestSlot(payload.kind, now);
  const window = notificationsConfig.schedule[payload.kind].catchUpHours * 3_600_000 + 3_600_000;
  if (!slot || slot.period !== payload.period || now.getTime() - slot.scheduledFor.getTime() > window) return { status: "stale", enqueued: 0 };

  if (payload.kind === "renewal") {
    // Few rows: each workspace has its own period (the day its paid year ends).
    let enqueued = 0;
    for (const due of await listRenewalsDue(now)) {
      const owners = await listFanoutMembers({ kind: "renewal", organizationIds: [due.organizationId], limit: 50, now });
      enqueued += await enqueueSends("renewal", due.periodKey, owners.members, now, enqueued, payload.at);
    }
    return { status: "done", enqueued };
  }

  let organizationIds: string[] | undefined;
  if (payload.kind === "reminder") {
    const ranges = reminderRanges(now);
    const found = await Promise.all(deadlineSources().map((source) => source.organizations(ranges)));
    organizationIds = [...new Set(found.flat())];
    if (organizationIds.length === 0) return { status: "done", enqueued: 0 };
  }

  const digestDay = (notificationsConfig.schedule.digest.weekdays as readonly number[]).includes(londonParts(now).weekday);
  const page = await listFanoutMembers({
    kind: payload.kind,
    after: payload.cursor ?? null,
    limit: notificationsConfig.limits.fanoutBatch,
    organizationIds,
    // On the digest's day the digest carries the new tenders: members who get it get no alert.
    exceptDigestRecipients: payload.kind === "alert" && digestDay,
    now,
  });
  const offset = payload.offset ?? 0;
  const enqueued = await enqueueSends(payload.kind, payload.period, page.members, now, offset, payload.at);
  if (!page.next) return { status: "done", enqueued };

  await enqueueJob(
    "notifications.fanout",
    { kind: payload.kind, period: payload.period, cursor: page.next, offset: offset + page.members.length, ...(payload.at ? { at: payload.at } : {}) },
    { dedupeKey: `notifications.fanout:${payload.kind}:${payload.period}:${page.next.organizationId}:${page.next.userId}`, maxAttempts: 3 },
  );
  return { status: "continued", enqueued };
}
