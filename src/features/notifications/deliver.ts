import "server-only";
import { db } from "@/db";
import type { NotificationItemRef } from "@/db/schema";
import { features } from "@/env";
import { track } from "@/lib/analytics";
import { errorReason } from "@/lib/describe-error";
import { sendEmail } from "@/lib/email/send";
import { enqueueJob } from "@/lib/jobs/queue";
import { log } from "@/lib/logger";
import type { OrgContext } from "@/server/session";
import { notificationAccess } from "./access";
import { composeRadarEmail, composeReminderEmail, composeRenewalEmail, type ComposeContext, type ComposedEmail } from "./compose";
import { notificationsConfig, type ScheduledKind } from "./config";
import { buildAlert, buildDigest } from "./content/digest";
import { buildReminder } from "./content/reminders";
import { buildRenewal } from "./content/renewal";
import { attachOutbox, claimSend, isSettled, recordSkip, volumeState, type LogKey } from "./log";
import { getNotificationPrefs, wantsKind } from "./prefs";
import { loadMemberContext } from "./recipients";
import { latestSlot, londonParts } from "./time";

/**
 * One scheduled e-mail to one member of one workspace (the `notifications.send` job).
 *
 * Everything that decides whether a message goes out is checked HERE, at the last moment,
 * whatever the fan-out believed: the pause flag, membership, a verified address, the
 * preference, the plan, the volume guards and whether there is anything to say.
 *
 * IDEMPOTENT BY CONSTRUCTION. The notification_log row for (user, workspace, kind, period)
 * is inserted in the same transaction as the outbox row:
 *  - the job runs twice, or a second job exists for the same key → the second insert hits
 *    the unique key and sends nothing;
 *  - a crash anywhere before the commit → neither row exists; the retry starts clean;
 *  - two workers race → one waits on the unique index for the other's commit, then stops.
 * The provider call itself happens later (`email.send`) with its own idempotency key.
 */
export type SendPayload = {
  kind: ScheduledKind;
  /** Digest: ISO week. Alert, reminder: UK day. Renewal: the day the paid period ends. */
  period: string;
  organizationId: string;
  userId: string;
  /** Times this send was put back by the per-tick cap. */
  deferrals?: number;
};

export type SendOutcome =
  | "sent"
  | "skipped_empty"
  | "skipped_pref"
  /** Not a member any more, address not verified, plan without this e-mail, or no longer due. */
  | "not_eligible"
  /** This period already has its row: sent, or deliberately skipped. */
  | "already_done"
  | "paused"
  /** The job outlived its slot (a queue that stood still): better no e-mail than a stale one. */
  | "stale"
  | "daily_ceiling"
  | "deferred"
  | "global_cap";

/** Extra time a send may take after its slot's catch-up window (queue depth, deferrals). */
const SEND_ALLOWANCE_MS = 6 * 3_600_000;

export const sendDedupeKey = (payload: Pick<SendPayload, "kind" | "organizationId" | "userId" | "period">) =>
  `${payload.kind}:${payload.organizationId}:${payload.userId}:${payload.period}`;

/** A send is stale when its period is no longer the current one, or its slot is long past. Renewals carry their own date check. */
function isStale(payload: SendPayload, now: Date): boolean {
  if (payload.kind === "renewal") return false;
  const slot = latestSlot(payload.kind, now);
  if (!slot || slot.period !== payload.period) return true;
  return now.getTime() - slot.scheduledFor.getTime() > notificationsConfig.schedule[payload.kind].catchUpHours * 3_600_000 + SEND_ALLOWANCE_MS;
}

type Prepared = { asOf: Date; refs: NotificationItemRef[]; itemCount: number; compose: (context: ComposeContext) => ComposedEmail; track: () => Promise<void> };

/** What there is to say, or null when there is nothing. */
async function prepare(kind: ScheduledKind, period: string, ctx: OrgContext, now: Date): Promise<Prepared | null> {
  const who = { organizationId: ctx.organization.id, userId: ctx.user.id };
  if (kind === "digest" || kind === "alert") {
    const content = kind === "digest" ? await buildDigest(ctx, now) : await buildAlert(ctx, now);
    if (!content) return null;
    const counts = { matches: content.matches.total, ending: content.ending.total, saved: content.saved.total };
    return {
      asOf: content.asOf,
      refs: content.refs,
      itemCount: content.matches.shown.length + content.ending.shown.length + content.saved.shown.length,
      compose: (context) => composeRadarEmail(content, context),
      track: () =>
        kind === "digest"
          ? track("digest_sent", who, { ...counts, plan: ctx.entitlements.planKey })
          : track("alert_sent", who, { matches: counts.matches, plan: ctx.entitlements.planKey }),
    };
  }
  if (kind === "reminder") {
    const content = await buildReminder(ctx, now);
    if (!content) return null;
    return {
      asOf: content.asOf,
      refs: content.refs,
      itemCount: content.items.length,
      compose: (context) => composeReminderEmail(content, context),
      track: () => track("reminder_sent", who, { type: "deadline", items: content.items.length }),
    };
  }
  const content = await buildRenewal(ctx, now);
  // One reminder per paid period: a job made for another period (the subscription has since
  // renewed or changed) is not this one's.
  if (!content || content.periodKey !== period) return null;
  return {
    asOf: content.asOf,
    refs: [],
    itemCount: 1,
    compose: (context) => composeRenewalEmail(content, context),
    track: () => track("reminder_sent", who, { type: "renewal", items: 1 }),
  };
}

export async function sendNotification(payload: SendPayload, options: { now?: Date } = {}): Promise<SendOutcome> {
  const now = options.now ?? new Date();
  if (features.notificationsPaused || features.mailDelivery === "none") return "paused";
  if (isStale(payload, now)) return "stale";

  const key: LogKey = { userId: payload.userId, organizationId: payload.organizationId, kind: payload.kind, periodKey: payload.period };
  if (await isSettled(key)) return "already_done";

  // Still a member, with a verified address? (A deleted workspace or account has no membership.)
  const ctx = await loadMemberContext(payload.organizationId, payload.userId, now);
  if (!ctx || !ctx.user.emailVerified) return "not_eligible";

  const prefs = await getNotificationPrefs(payload.userId, payload.organizationId);
  if (!wantsKind(prefs, payload.kind)) {
    // (Not written: another attempt settled this period in the meantime.)
    return (await recordSkip(key, "skipped_pref", { asOf: now })) ? "skipped_pref" : "already_done";
  }
  if (payload.kind === "alert") {
    if (!notificationAccess(ctx.entitlements).dailyAlerts) return "not_eligible";
    // On the digest's day the digest carries the same new tenders: one e-mail, not two.
    const digestDay = (notificationsConfig.schedule.digest.weekdays as readonly number[]).includes(londonParts(now).weekday);
    if (digestDay && wantsKind(prefs, "digest")) return "not_eligible";
  }
  if (payload.kind === "renewal" && ctx.role !== "owner") return "not_eligible";

  // Volume guards.
  const volume = await volumeState(payload.userId, payload.organizationId, now);
  const { limits } = notificationsConfig;
  if ((payload.kind !== "renewal" && volume.memberWorkspaceToday >= limits.perMemberWorkspacePerDay) || volume.userToday >= limits.perUserPerDay) {
    await recordSkip(key, "failed", { asOf: now, detail: "daily_ceiling" });
    log.error("notifications: daily ceiling reached, e-mail not sent", { kind: payload.kind, organizationId: payload.organizationId, userId: payload.userId });
    return "daily_ceiling";
  }
  if (volume.lastTick >= limits.perTick) {
    const deferrals = (payload.deferrals ?? 0) + 1;
    if (deferrals > limits.maxDeferrals) {
      await recordSkip(key, "failed", { asOf: now, detail: "global_cap" });
      log.error("notifications: per-tick cap still reached after the last deferral, e-mail not sent", { kind: payload.kind });
      return "global_cap";
    }
    await enqueueJob(
      "notifications.send",
      { ...payload, deferrals },
      { runAfter: new Date(now.getTime() + limits.tickMinutes * 60_000), dedupeKey: `${sendDedupeKey(payload)}:defer:${deferrals}`, maxAttempts: 4 },
    );
    return "deferred";
  }

  try {
    const prepared = await prepare(payload.kind, payload.period, ctx, now);
    if (!prepared) {
      // A renewal that is no longer due simply does not apply; the others had nothing new to say.
      if (payload.kind === "renewal") return "not_eligible";
      // A racing attempt that already sent this period leaves nothing new for this one: its row stands.
      return (await recordSkip(key, "skipped_empty", { asOf: now })) ? "skipped_empty" : "already_done";
    }
    const sent = await db.transaction(async (tx) => {
      const logId = await claimSend(tx, key, { asOf: prepared.asOf, sentAt: now, items: prepared.refs, itemCount: prepared.itemCount });
      if (!logId) return false;
      const recipient = { userId: ctx.user.id, organizationId: ctx.organization.id, name: ctx.user.name, email: ctx.user.email };
      const composed = prepared.compose({ recipient, notificationId: logId, now });
      const outboxId = await sendEmail(ctx.user.email, composed.template, { headers: composed.headers, executor: tx });
      await attachOutbox(tx, logId, outboxId);
      return true;
    });
    if (!sent) return "already_done";
    await prepared.track();
    return "sent";
  } catch (error) {
    // Leave a trace for /admin; the row is taken over if a retry succeeds.
    await recordSkip(key, "failed", { asOf: now, detail: `error: ${errorReason(error)}`.slice(0, 300) }).catch(() => undefined);
    throw error;
  }
}
