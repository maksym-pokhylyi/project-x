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

/**
 * A town as a notice gives it, without the stray comma or full stop some buyers type after
 * it ("Cambridge," → "Cambridge"). Null when nothing is left.
 */
export function tidyPlace(value: string | null | undefined): string | null {
  const cleaned = (value ?? "").replace(/^[\s,;.·-]+/u, "").replace(/[\s,;.·-]+$/u, "");
  return cleaned || null;
}

/** Months are three letters in every date: the en-GB locale alone writes September as "Sept". */
const threeLetterMonth = (text: string) => text.replace("Sept", "Sep");

/** "22 Nov 2026" */
export function formatDate(value: string | Date | null | undefined): string | null {
  const date = valid(value);
  return date ? threeLetterMonth(DATE.format(date)) : null;
}

/** "22 Nov 2026, 12:00" */
export function formatDateTime(value: string | Date | null | undefined): string | null {
  const date = valid(value);
  return date ? threeLetterMonth(DATE_TIME.format(date).replace(" at ", ", ")) : null;
}

/** "Nov 2026" */
export function formatMonth(value: string | Date | null | undefined): string | null {
  const date = valid(value);
  return date ? threeLetterMonth(MONTH.format(date)) : null;
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

/** "in 5 months", "in 4½ months", "in 3 weeks", "in 4 days", "today" — for contract end dates. */
export function describeTimeUntil(value: string | Date | null | undefined, now: Date = new Date()): string | null {
  const date = valid(value);
  if (!date) return null;
  const days = calendarDaysBetween(now, date);
  if (days < 0) return "ended";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 21) return `in ${days} days`;
  if (days < 70) return `in ${Math.round(days / 7)} weeks`;
  // To the nearest half month: "in 4½ months" says more than "in 5 months" when a re-tender is being timed.
  const halves = Math.round((days / 30.4375) * 2);
  if (halves < 48) return `in ${Math.floor(halves / 2)}${halves % 2 === 1 ? "½" : ""} months`;
  return `in ${Math.round(halves / 24)} years`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? singular : plural}`;
}

// ---------------------------------------------------------------------------
// Closing dates, as the artboards write them
// ---------------------------------------------------------------------------

const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIME_ZONE });

/** "12:00", "17:00" — UK time. */
export function formatClock(value: string | Date | null | undefined): string | null {
  const date = valid(value);
  return date ? CLOCK.format(date) : null;
}

/** "12:00 noon", "17:00" — midday is spelled out, because "12:00" alone is read both ways. */
export function formatTime(value: string | Date | null | undefined): string | null {
  const clock = formatClock(value);
  if (!clock) return null;
  return clock === "12:00" ? "12:00 noon" : clock;
}

export type ClosingInfo = {
  /** open: the deadline is ahead. closed: it has passed. unknown: the notice gives none. */
  state: "open" | "closed" | "unknown";
  /** ISO instant, for <time dateTime>. */
  iso: string | null;
  /** "27 Nov 2026" */
  date: string | null;
  /** "12:00 noon" */
  time: string | null;
  /** "27 Nov 2026, 12:00" — the one-line form. */
  dateTime: string | null;
  /** "14 days left", "Tomorrow", "Today"; null once closed or when unknown. Always shown NEXT TO the date. */
  left: string | null;
  /** Whole calendar days to the deadline in UK time (today = 0); null when unknown. */
  days: number | null;
};

/**
 * Everything a deadline marker needs (DESIGN.md §1.3: an amber marker, the absolute date,
 * the time left in a small pill). Days are calendar days in UK time, so a tender closing
 * tomorrow at noon says "Tomorrow" at any hour today.
 */
export function describeClosing(deadline: string | Date | null | undefined, now: Date = new Date()): ClosingInfo {
  const date = valid(deadline);
  if (!date) return { state: "unknown", iso: null, date: null, time: null, dateTime: null, left: null, days: null };
  const days = calendarDaysBetween(now, date);
  const open = date.getTime() > now.getTime();
  return {
    state: open ? "open" : "closed",
    iso: date.toISOString(),
    date: threeLetterMonth(DATE.format(date)),
    time: formatTime(date),
    dateTime: `${threeLetterMonth(DATE.format(date))}, ${CLOCK.format(date)}`,
    left: !open ? null : days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days left`,
    days,
  };
}

/**
 * Length of a contract as a buyer would say it: "9 months", "18 months", "4 years",
 * "2 years 6 months". Null when either date is missing or the period is not positive.
 */
export function formatTerm(start: string | Date | null | undefined, end: string | Date | null | undefined): string | null {
  const from = valid(start);
  const to = valid(end);
  if (!from || !to) return null;
  // Periods are published inclusive ("1 Apr 2027 to 31 Mar 2031" is four years): count the last day.
  const days = calendarDaysBetween(from, to) + 1;
  if (days <= 1) return null;
  if (days < 14) return `${days} days`;
  if (days < 50) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.4375);
  if (months < 24) return months === 1 ? "1 month" : `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (rest === 0) return `${years} years`;
  if (rest === 11) return `${years + 1} years`;
  if (rest === 1) return `${years} years`;
  return `${years} years ${rest} months`;
}
