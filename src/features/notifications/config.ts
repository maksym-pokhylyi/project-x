/**
 * Scheduled e-mails: every number that shapes what is sent, when, and how much.
 * Pure data — safe to import from anywhere (components, scripts, tests).
 */

export const NOTIFICATION_KINDS = ["digest", "alert", "reminder", "renewal", "product"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Kinds this module sends on a schedule. `product` e-mails are sent by other modules, which only use the preference and the unsubscribe links. */
export const SCHEDULED_KINDS = ["digest", "alert", "reminder", "renewal"] as const;
export type ScheduledKind = (typeof SCHEDULED_KINDS)[number];

export function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === "string" && (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

export function isScheduledKind(value: unknown): value is ScheduledKind {
  return typeof value === "string" && (SCHEDULED_KINDS as readonly string[]).includes(value);
}

/** How each kind is named to the person receiving it. */
export const KIND_LABELS: Record<NotificationKind, { name: string; withArticle: string }> = {
  digest: { name: "Weekly digest", withArticle: "the weekly digest" },
  alert: { name: "Daily alerts", withArticle: "daily alerts" },
  reminder: { name: "Deadline reminders", withArticle: "deadline reminders" },
  renewal: { name: "Renewal reminder", withArticle: "the renewal reminder" },
  product: { name: "Product emails", withArticle: "product emails" },
};

export const NOTIFICATION_TIME_ZONE = "Europe/London";

export const notificationsConfig = {
  /**
   * When each kind goes out, in UK time (Europe/London, so 07:30 stays 07:30 across the
   * clock changes). `weekdays` are ISO weekdays: 1 = Monday … 7 = Sunday.
   * `catchUpHours`: how long after the scheduled moment a missed fan-out may still start.
   * Past that it is skipped — the next e-mail covers everything since the last one that
   * was sent, so nothing is lost and nobody gets a "Monday" digest on a Thursday.
   */
  schedule: {
    digest: { weekdays: [1], hour: 7, minute: 30, catchUpHours: 36 },
    alert: { weekdays: [1, 2, 3, 4, 5], hour: 7, minute: 30, catchUpHours: 10 },
    reminder: { weekdays: [1, 2, 3, 4, 5, 6, 7], hour: 8, minute: 0, catchUpHours: 12 },
    renewal: { weekdays: [1, 2, 3, 4, 5, 6, 7], hour: 8, minute: 0, catchUpHours: 20 },
  } satisfies Record<ScheduledKind, { weekdays: number[]; hour: number; minute: number; catchUpHours: number }>,

  digest: {
    /** New matches listed in full; the rest are counted in one line. */
    maxMatches: 5,
    maxEndingSoon: 3,
    /** Rival contracts are "ending soon" when their stated end date is within this many months. */
    endingSoonMonths: 12,
    /** Saved tenders are listed when they close within this many days (the radar's deadline strip). */
    savedClosingDays: 14,
    /** Saved tenders shown; more are counted in one line. */
    maxSavedClosing: 5,
    /** The first digest for a member looks back this many days. */
    firstLookbackDays: 7,
    /** Plans without a cap: how many ending-soon contracts to look through for new ones. */
    endingSoonScanLimit: 200,
  },
  alert: { maxMatches: 8 },
  reminder: {
    /** Days before the closing date on which a saved tender is mentioned. */
    offsets: [7, 2],
  },
  renewal: {
    /** The reminder goes out when the renewal is between these many days away. */
    windowDays: { min: 6, max: 8 },
  },

  /**
   * A procurement counts as "first seen" when we stored it, unless it reached us more than
   * this long after it was published (a backfill, a re-import, a restored database): then
   * it counts from its publication date and is not announced as new.
   */
  lateArrivalGraceHours: 72,
  /**
   * "Since the last e-mail" starts this much earlier than the last e-mail's own cut-off, so a
   * notice that was being stored at that very moment is not lost; what was already listed is
   * filtered out by id.
   */
  overlapMinutes: 20,
  /** When the last e-mail is older than this, start again from the first-digest lookback. */
  maxLookbackDays: 31,

  /** Volume guards: a bug must not be able to flood people. */
  limits: {
    /** Scheduled e-mails that may go out per five-minute tick, across all kinds. */
    perTick: 200,
    tickMinutes: 5,
    /** Per member and workspace per UK day: one reminder plus one digest or alert. Renewal notices are counted separately. */
    perMemberWorkspacePerDay: 2,
    /** Per person per UK day across all of their workspaces. */
    perUserPerDay: 8,
    /** A send that hits the per-tick cap is put back this many times (five minutes apart) before it is given up. */
    maxDeferrals: 36,
    /** Members handled by one fan-out job before it hands over to the next. */
    fanoutBatch: 500,
  },
} as const;
