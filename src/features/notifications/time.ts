import { calendarDaysBetween, formatDate } from "@/features/procurement/domain/format";
import { NOTIFICATION_TIME_ZONE, notificationsConfig, type ScheduledKind } from "./config";

/**
 * UK time for scheduled e-mails (PURE).
 *
 * Everything a person reads or is promised — "Mondays at 07:30", "53 days left", "since last
 * Monday" — is reckoned in Europe/London, so it stays right across the clock changes on the
 * last Sunday of March and October. Vercel Cron and the database run in UTC; this file is
 * the only place the two are converted.
 *
 * Days left use the SAME function as the app (calendarDaysBetween), so an e-mail and the
 * radar never disagree about a deadline.
 */

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: NOTIFICATION_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: NOTIFICATION_TIME_ZONE, weekday: "short" });
const WEEKDAY_LONG = new Intl.DateTimeFormat("en-GB", { timeZone: NOTIFICATION_TIME_ZONE, weekday: "long" });
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { timeZone: NOTIFICATION_TIME_ZONE, day: "numeric", month: "short" });

const ISO_WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const DAY_MS = 86_400_000;

export type LondonParts = {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  weekday: number;
};

/** The UK wall-clock reading of an instant. */
export function londonParts(date: Date): LondonParts {
  const parts: Record<string, string> = {};
  for (const part of PARTS.formatToParts(date)) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: ISO_WEEKDAY[parts.weekday ?? ""] ?? 1,
  };
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** "2026-11-16": the UK calendar day an instant falls on. */
export function londonDayKey(date: Date): string {
  const { year, month, day } = londonParts(date);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function parseDayKey(dayKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) throw new Error(`Not a day key: ${dayKey}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** A day key moved by whole calendar days ("2026-03-29" + 1 = "2026-03-30", whatever the clocks do). */
export function addDaysToDayKey(dayKey: string, days: number): string {
  const { year, month, day } = parseDayKey(dayKey);
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return `${pad(moved.getUTCFullYear(), 4)}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a day key. */
export function weekdayOfDayKey(dayKey: string): number {
  const { year, month, day } = parseDayKey(dayKey);
  return ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
}

/**
 * The instant at which UK clocks show the given wall time. On the night the clocks go
 * forward 01:00–01:59 does not exist (the next real moment is returned); on the night they
 * go back it happens twice (the first is returned). Neither touches 07:30 or 08:00.
 */
export function londonWallTimeToUtc(dayKey: string, hour: number, minute = 0): Date {
  const { year, month, day } = parseDayKey(dayKey);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  const offsetAt = (instant: number) => {
    const parts = londonParts(new Date(instant));
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(instant / 1000) * 1000;
  };
  // Two rounds settle the offset on either side of a clock change.
  let instant = wanted - offsetAt(wanted);
  instant = wanted - offsetAt(instant);
  return new Date(instant);
}

/** 00:00 UK time on the given day. */
export function londonDayStart(dayKey: string): Date {
  return londonWallTimeToUtc(dayKey, 0, 0);
}

/** The same UK wall-clock time a number of calendar days away ("a week ago", not "168 hours ago"). */
export function shiftLondonDays(date: Date, days: number): Date {
  const parts = londonParts(date);
  const shifted = londonWallTimeToUtc(addDaysToDayKey(londonDayKey(date), days), parts.hour, parts.minute);
  return new Date(shifted.getTime() + parts.second * 1000 + (date.getTime() % 1000));
}

/** ISO 8601 week of a UK calendar day: "2026-W47". Weeks start on Monday; week 1 holds 4 January. */
export function isoWeekKeyOfDay(dayKey: string): string {
  const { year, month, day } = parseDayKey(dayKey);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Thursday of this week decides the ISO year.
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${pad(isoYear, 4)}-W${pad(week)}`;
}

export function isoWeekKey(date: Date): string {
  return isoWeekKeyOfDay(londonDayKey(date));
}

/** Whole calendar days from `from` to `to`, counted in UK time (today → 0, tomorrow → 1). */
export function londonDaysBetween(from: Date, to: Date): number {
  return calendarDaysBetween(from, to);
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export type Schedule = Record<ScheduledKind, { weekdays: readonly number[]; hour: number; minute: number; catchUpHours: number }>;

export type DueSlot = {
  kind: ScheduledKind;
  /** Digest: ISO week ("2026-W47"). Everything else: UK day ("2026-11-16"). */
  period: string;
  /** The moment this slot was due. */
  scheduledFor: Date;
};

/** The period a slot on the given UK day belongs to. */
export function periodKeyFor(kind: ScheduledKind, dayKey: string): string {
  return kind === "digest" ? isoWeekKeyOfDay(dayKey) : dayKey;
}

/**
 * The most recent slot of `kind` at or before `now`, looking back up to `maxDaysBack`
 * UK days; null when there is none.
 */
export function latestSlot(kind: ScheduledKind, now: Date, schedule: Schedule = notificationsConfig.schedule, maxDaysBack = 8): DueSlot | null {
  const rule = schedule[kind];
  const today = londonDayKey(now);
  for (let back = 0; back <= maxDaysBack; back += 1) {
    const dayKey = addDaysToDayKey(today, -back);
    if (!rule.weekdays.includes(weekdayOfDayKey(dayKey))) continue;
    const scheduledFor = londonWallTimeToUtc(dayKey, rule.hour, rule.minute);
    if (scheduledFor.getTime() > now.getTime()) continue;
    return { kind, period: periodKeyFor(kind, dayKey), scheduledFor };
  }
  return null;
}

/** The slot before the latest one (the previous working day's alert, last Monday's digest). */
export function previousSlot(kind: ScheduledKind, now: Date, schedule: Schedule = notificationsConfig.schedule): DueSlot | null {
  const latest = latestSlot(kind, now, schedule);
  if (!latest) return null;
  return latestSlot(kind, new Date(latest.scheduledFor.getTime() - 1), schedule);
}

/**
 * Which fan-outs should exist at `now`: for each kind, its latest slot if that slot is still
 * inside the catch-up window. Calling this every five minutes and enqueueing each result
 * with a dedupe key per (kind, period) gives exactly one fan-out per period.
 */
export function dueSlots(now: Date, schedule: Schedule = notificationsConfig.schedule): DueSlot[] {
  const due: DueSlot[] = [];
  for (const kind of Object.keys(schedule) as ScheduledKind[]) {
    const slot = latestSlot(kind, now, schedule);
    if (!slot) continue;
    if (now.getTime() - slot.scheduledFor.getTime() < schedule[kind].catchUpHours * 3_600_000) due.push(slot);
  }
  return due;
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

/** "Thu 26 Nov 2026" */
export function formatWeekdayDate(date: Date): string {
  return `${WEEKDAY.format(date)} ${formatDate(date) ?? ""}`.trim();
}

/** "12:00 noon", "17:00", "00:00 (midnight, start of the day)" — 24-hour clock, UK time. */
export function formatClockTime(date: Date): string {
  const { hour, minute } = londonParts(date);
  const clock = `${pad(hour)}:${pad(minute)}`;
  if (hour === 12 && minute === 0) return `${clock} noon`;
  if (hour === 0 && minute === 0) return `${clock} (midnight, start of the day)`;
  return clock;
}

/** "Thu 26 Nov 2026, 12:00 noon" */
export function formatDeadlineMoment(date: Date): string {
  return `${formatWeekdayDate(date)}, ${formatClockTime(date)}`;
}

/** "53 days left", "1 day left", "closes today" — calendar days in UK time. Null once the moment has passed. */
export function daysLeftLabel(deadline: Date, now: Date): string | null {
  if (deadline.getTime() <= now.getTime()) return null;
  const days = londonDaysBetween(now, deadline);
  if (days <= 0) return "closes today";
  return days === 1 ? "1 day left" : `${days} days left`;
}

/**
 * How an e-mail names the moment it looks back to: "last Monday" for exactly a week ago,
 * "yesterday", otherwise "Tue 3 Nov".
 */
export function describeSince(since: Date, now: Date): string {
  const days = londonDaysBetween(since, now);
  if (days === 1) return "yesterday";
  if (days === 7) return `last ${WEEKDAY_LONG.format(since)}`;
  if (days >= 2 && days <= 6) return `${WEEKDAY_LONG.format(since)}`;
  return `${WEEKDAY.format(since)} ${DAY_MONTH.format(since)}`;
}
