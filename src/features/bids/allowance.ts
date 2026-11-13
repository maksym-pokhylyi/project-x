/**
 * Allowance windows of the bid desk — pure date arithmetic, no database (see ./access.ts).
 *
 * The monthly allowance renews on the BILLING date: windows are months anchored on the
 * subscription's current period start. On a monthly plan (and in a trial) the window is the
 * billing period itself; on an annual plan it is each monthly anniversary of the start.
 * Without a subscription that has period dates — a plan granted by hand, a simulated plan,
 * the Free plan — windows are UTC calendar months. Everything is in UTC.
 */
export type AllowanceSubscription = {
  /** "month" | "year" */
  billingInterval?: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
} | null;

export type AllowanceWindow = { start: Date; end: Date };

const DAY_MS = 24 * 60 * 60 * 1000;
/** A billing period this short is used as the window as it stands (a month, or a trial). */
const LONGEST_MONTHLY_PERIOD_MS = 32 * DAY_MS;

/**
 * `anchor` moved by whole months, keeping its day of the month and time of day. A month
 * without that day ends the window on its last day: the 31st gives 31 Jan, 28 Feb (29 in a
 * leap year), 31 Mar, 30 Apr — always counted from the anchor, so the day never drifts.
 */
export function addMonthsUtc(anchor: Date, months: number): Date {
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(anchor.getUTCDate(), lastDay), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds()),
  );
}

/** The index of the month-long window, counted from `anchor`, that `now` falls in (negative before the anchor). */
function windowIndex(anchor: Date, now: Date): number {
  let index = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth());
  while (addMonthsUtc(anchor, index) > now) index -= 1;
  while (addMonthsUtc(anchor, index + 1) <= now) index += 1;
  return index;
}

/**
 * The window `offset` windows away from the one `now` is in (0 = current, -1 = the one
 * before). Window 0 is the billing period itself when that is a month or shorter.
 */
export function windowAt(subscription: AllowanceSubscription, now: Date, offset: number): AllowanceWindow {
  const anchor = subscription?.currentPeriodStart ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = subscription?.currentPeriodStart ? subscription.currentPeriodEnd : null;
  const index = windowIndex(anchor, now);
  if (offset === 0 && index === 0 && periodEnd && now < periodEnd && periodEnd.getTime() - anchor.getTime() <= LONGEST_MONTHLY_PERIOD_MS) {
    return { start: anchor, end: periodEnd };
  }
  return { start: addMonthsUtc(anchor, index + offset), end: addMonthsUtc(anchor, index + offset + 1) };
}

/** The allowance window that `now` falls in. `end` is when the allowance renews. */
export function allowanceWindow(subscription: AllowanceSubscription, now: Date): AllowanceWindow {
  return windowAt(subscription, now, 0);
}

/**
 * Full bids carried INTO the current window, given what was taken from the plan in each
 * earlier window (oldest first, ending with the window just before the current one; only
 * windows in which the paid subscription was running).
 *
 * In every window the carried-in bids are used first and whatever is left of them lapses
 * at its end; only that window's OWN unused allowance moves on. So the carry is never more
 * than one plan limit, and a bid cannot be carried twice.
 */
export function carriedOver(limit: number, usedInEarlierWindows: number[]): number {
  let carried = 0;
  for (const used of usedInEarlierWindows) {
    const usedOfOwnAllowance = Math.max(0, used - carried);
    carried = Math.max(0, limit - usedOfOwnAllowance);
  }
  return Math.min(limit, carried);
}

/** "October" — the month a window started in, for "2 carried over from October". */
export function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(date);
}
