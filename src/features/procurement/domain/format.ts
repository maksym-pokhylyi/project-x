/**
 * Date and deadline formatting (PURE). All dates are shown in UK time: deadlines in
 * notices are local UK times.
 */
const TIME_ZONE = "Europe/London";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });
const DATE_TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIME_ZONE });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: TIME_ZONE });
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIME_ZONE });

function valid(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "22 Nov 2026" */
export function formatDate(value: string | Date | null | undefined): string | null {
  const date = valid(value);
  return date ? DATE.format(date) : null;
}

/** "22 Nov 2026, 12:00" */
export function formatDateTime(value: string | Date | null | undefined): string | null {
  const date = valid(value);
  return date ? DATE_TIME.format(date).replace(" at ", ", ") : null;
}

/** "Nov 2026" */
export function formatMonth(value: string | Date | null | undefined): string | null {
  const date = valid(value);
  return date ? MONTH.format(date) : null;
}

/** Whole calendar days between two instants, counted in UK time (today -> 0, tomorrow -> 1). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const key = (date: Date) => Date.parse(`${DAY_KEY.format(date)}T00:00:00Z`);
  return Math.round((key(to) - key(from)) / 86_400_000);
}

export type DeadlineUrgency = "neutral" | "soon" | "urgent" | "closed";

export type DeadlineDescription = {
  /** "Closes in 9 days", "Closes tomorrow", "Closes today", "Closed". */
  label: string;
  /** "22 Nov 2026, 12:00" — always shown next to the label. */
  absolute: string;
  urgency: DeadlineUrgency;
  days: number;
};

/**
 * DESIGN.md §5 DeadlineChip: more than 14 days neutral, 4–14 days amber, 3 days or fewer
 * danger, closed struck through. The absolute date always accompanies the relative one.
 */
export function describeDeadline(deadline: string | Date | null | undefined, now: Date = new Date()): DeadlineDescription | null {
  const date = valid(deadline);
  if (!date) return null;
  const absolute = formatDateTime(date)!;
  if (date.getTime() <= now.getTime()) return { label: "Closed", absolute, urgency: "closed", days: calendarDaysBetween(now, date) };
  const days = calendarDaysBetween(now, date);
  const label = days <= 0 ? "Closes today" : days === 1 ? "Closes tomorrow" : `Closes in ${days} days`;
  return { label, absolute, urgency: days <= 3 ? "urgent" : days <= 14 ? "soon" : "neutral", days };
}

/** "in 5 months", "in 3 weeks", "in 4 days", "today" — for contract end dates. */
export function describeTimeUntil(value: string | Date | null | undefined, now: Date = new Date()): string | null {
  const date = valid(value);
  if (!date) return null;
  const days = calendarDaysBetween(now, date);
  if (days < 0) return "ended";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 21) return `in ${days} days`;
  if (days < 70) return `in ${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.4375);
  return months < 24 ? `in ${months} months` : `in ${Math.round(months / 12)} years`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? singular : plural}`;
}
