import { describe, expect, it } from "vitest";
import { notificationsConfig, type ScheduledKind } from "@/features/notifications/config";
import {
  addDaysToDayKey,
  daysLeftLabel,
  describeSince,
  dueSlots,
  formatClockTime,
  formatDeadlineMoment,
  isoWeekKey,
  isoWeekKeyOfDay,
  latestSlot,
  londonDayKey,
  londonDayStart,
  londonDaysBetween,
  londonParts,
  londonWallTimeToUtc,
  periodKeyFor,
  previousSlot,
  shiftLondonDays,
  weekdayOfDayKey,
} from "@/features/notifications/time";

/**
 * Scheduled e-mails are promised in UK time. In 2026 the clocks go forward on Sunday
 * 29 March (01:00 UTC) and back on Sunday 25 October (01:00 UTC).
 */
const at = (iso: string) => new Date(iso);
const kinds = (now: Date) =>
  dueSlots(now)
    .map((slot) => `${slot.kind}:${slot.period}`)
    .sort();

describe("UK wall-clock time", () => {
  it("reads an instant as London shows it, in winter and in summer", () => {
    expect(londonParts(at("2026-11-16T07:30:00Z"))).toMatchObject({ year: 2026, month: 11, day: 16, hour: 7, minute: 30, weekday: 1 });
    expect(londonParts(at("2026-06-08T06:30:00Z"))).toMatchObject({ month: 6, day: 8, hour: 7, minute: 30, weekday: 1 });
    // 23:30 UTC on a summer Sunday is already Monday in the UK.
    expect(londonParts(at("2026-06-07T23:30:00Z"))).toMatchObject({ day: 8, hour: 0, minute: 30, weekday: 1 });
    expect(londonDayKey(at("2026-06-07T23:30:00Z"))).toBe("2026-06-08");
    expect(londonDayKey(at("2026-12-31T23:59:59Z"))).toBe("2026-12-31");
    expect(londonDayKey(at("2027-01-01T00:00:00Z"))).toBe("2027-01-01");
  });

  it("converts a UK wall time to the right instant on both sides of each clock change", () => {
    expect(londonWallTimeToUtc("2026-03-23", 7, 30).toISOString()).toBe("2026-03-23T07:30:00.000Z"); // GMT
    expect(londonWallTimeToUtc("2026-03-30", 7, 30).toISOString()).toBe("2026-03-30T06:30:00.000Z"); // BST
    expect(londonWallTimeToUtc("2026-10-19", 7, 30).toISOString()).toBe("2026-10-19T06:30:00.000Z"); // BST
    expect(londonWallTimeToUtc("2026-10-26", 7, 30).toISOString()).toBe("2026-10-26T07:30:00.000Z"); // GMT
    // On the changeover Sundays themselves, 08:00 is after the change.
    expect(londonWallTimeToUtc("2026-03-29", 8, 0).toISOString()).toBe("2026-03-29T07:00:00.000Z");
    expect(londonWallTimeToUtc("2026-10-25", 8, 0).toISOString()).toBe("2026-10-25T08:00:00.000Z");
  });

  it("starts the UK day at UK midnight, including the 23- and 25-hour days", () => {
    expect(londonDayStart("2026-03-29").toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(londonDayStart("2026-03-30").toISOString()).toBe("2026-03-29T23:00:00.000Z"); // a 23-hour day
    expect(londonDayStart("2026-10-25").toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(londonDayStart("2026-10-26").toISOString()).toBe("2026-10-26T00:00:00.000Z"); // a 25-hour day
    expect(londonDayStart("2026-10-26").getTime() - londonDayStart("2026-10-25").getTime()).toBe(25 * 3_600_000);
  });

  it("gives a defined answer for wall times the clock change skips or repeats", () => {
    // 01:30 does not exist on 29 March: the answer is a real moment after the gap.
    const skipped = londonWallTimeToUtc("2026-03-29", 1, 30);
    expect(skipped.toISOString()).toBe("2026-03-29T01:30:00.000Z");
    expect(londonParts(skipped)).toMatchObject({ day: 29, hour: 2, minute: 30 });
    // 01:30 happens twice on 25 October: the second one (winter time) is the answer.
    const repeated = londonWallTimeToUtc("2026-10-25", 1, 30);
    expect(repeated.toISOString()).toBe("2026-10-25T01:30:00.000Z");
    expect(londonParts(repeated)).toMatchObject({ day: 25, hour: 1, minute: 30 });
  });

  it("moves by calendar days, not by 24 hours", () => {
    expect(addDaysToDayKey("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDaysToDayKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDayKey("2028-03-01", -1)).toBe("2028-02-29");
    expect(weekdayOfDayKey("2026-11-16")).toBe(1);
    expect(weekdayOfDayKey("2026-11-15")).toBe(7);
    // "A week before Monday 07:30" stays 07:30 across the change (167 real hours).
    const monday = at("2026-03-30T06:30:00Z");
    expect(shiftLondonDays(monday, -7).toISOString()).toBe("2026-03-23T07:30:00.000Z");
    expect(shiftLondonDays(at("2026-10-26T07:30:00Z"), -7).toISOString()).toBe("2026-10-19T06:30:00.000Z");
  });

  it("counts days left as calendar days in the UK", () => {
    const deadline = at("2026-11-26T12:00:00Z");
    expect(londonDaysBetween(at("2026-11-24T08:00:00Z"), deadline)).toBe(2);
    expect(londonDaysBetween(at("2026-11-19T08:00:00Z"), deadline)).toBe(7);
    // Minutes either side of UK midnight.
    expect(londonDaysBetween(at("2026-11-23T23:59:00Z"), deadline)).toBe(3);
    expect(londonDaysBetween(at("2026-11-24T00:01:00Z"), deadline)).toBe(2);
    // In summer UK midnight is 23:00 UTC: 23:30 UTC on 1 June is already 2 June.
    expect(londonDaysBetween(at("2026-06-01T23:30:00Z"), at("2026-06-04T11:00:00Z"))).toBe(2);
    expect(londonDaysBetween(at("2026-06-01T22:30:00Z"), at("2026-06-04T11:00:00Z"))).toBe(3);
    // Across the spring change: Tue 24 March 08:00 GMT to Tue 31 March noon BST is 7 days, Sunday 29th is 2.
    const afterChange = at("2026-03-31T11:00:00Z");
    expect(londonDaysBetween(at("2026-03-24T08:00:00Z"), afterChange)).toBe(7);
    expect(londonDaysBetween(at("2026-03-29T07:00:00Z"), afterChange)).toBe(2);
    // A deadline at UK midnight belongs to the day it starts.
    expect(londonDaysBetween(at("2026-06-01T08:00:00Z"), at("2026-06-02T23:00:00Z"))).toBe(2);
  });
});

describe("ISO weeks (the digest's period)", () => {
  it("numbers weeks from Monday, with week 1 holding 4 January", () => {
    expect(isoWeekKeyOfDay("2026-11-16")).toBe("2026-W47");
    expect(isoWeekKeyOfDay("2026-11-22")).toBe("2026-W47"); // Sunday of the same week
    expect(isoWeekKeyOfDay("2026-11-23")).toBe("2026-W48");
    expect(isoWeekKeyOfDay("2026-01-01")).toBe("2026-W01");
    expect(isoWeekKeyOfDay("2025-12-29")).toBe("2026-W01"); // Monday of week 1 lies in the old year
  });

  it("handles the 53-week year and the turn of the year", () => {
    expect(isoWeekKeyOfDay("2026-12-28")).toBe("2026-W53");
    expect(isoWeekKeyOfDay("2027-01-03")).toBe("2026-W53"); // a Sunday in January still in the old ISO year
    expect(isoWeekKeyOfDay("2027-01-04")).toBe("2027-W01");
    expect(isoWeekKeyOfDay("2024-12-30")).toBe("2025-W01");
    expect(isoWeekKeyOfDay("2021-01-03")).toBe("2020-W53");
  });

  it("takes the week from the UK day, not the UTC day", () => {
    // Sunday 23:30 UTC in summer is Monday 00:30 in the UK: the next week has begun.
    expect(isoWeekKey(at("2026-06-07T22:30:00Z"))).toBe("2026-W23");
    expect(isoWeekKey(at("2026-06-07T23:30:00Z"))).toBe("2026-W24");
    expect(periodKeyFor("digest", "2026-11-16")).toBe("2026-W47");
    expect(periodKeyFor("alert", "2026-11-16")).toBe("2026-11-16");
    expect(periodKeyFor("reminder", "2026-11-16")).toBe("2026-11-16");
  });
});

describe("which fan-outs are due", () => {
  it("Monday 07:30 UK time brings the digest and the alert, 08:00 the reminders (winter)", () => {
    expect(kinds(at("2026-11-16T07:29:59Z"))).toEqual([]);
    expect(kinds(at("2026-11-16T07:30:00Z"))).toEqual(["alert:2026-11-16", "digest:2026-W47"]);
    expect(kinds(at("2026-11-16T07:59:59Z"))).toEqual(["alert:2026-11-16", "digest:2026-W47"]);
    expect(kinds(at("2026-11-16T08:00:00Z"))).toEqual(["alert:2026-11-16", "digest:2026-W47", "reminder:2026-11-16", "renewal:2026-11-16"]);
  });

  it("is an hour earlier in UTC during British Summer Time", () => {
    expect(kinds(at("2026-06-08T06:29:59Z"))).toEqual([]);
    expect(kinds(at("2026-06-08T06:30:00Z"))).toEqual(["alert:2026-06-08", "digest:2026-W24"]);
    expect(kinds(at("2026-06-08T07:00:00Z"))).toEqual(["alert:2026-06-08", "digest:2026-W24", "reminder:2026-06-08", "renewal:2026-06-08"]);
  });

  it("alerts go out on working days only; the digest on Mondays only", () => {
    expect(kinds(at("2026-11-17T07:30:00Z"))).toContain("alert:2026-11-17"); // Tuesday
    expect(kinds(at("2026-11-21T08:30:00Z"))).toEqual(["reminder:2026-11-21", "renewal:2026-11-21"]); // Saturday
    expect(kinds(at("2026-11-22T08:30:00Z"))).toEqual(["reminder:2026-11-22", "renewal:2026-11-22"]); // Sunday
    expect(kinds(at("2026-11-18T07:30:00Z")).some((entry) => entry.startsWith("digest"))).toBe(false); // Wednesday
  });

  it("a missed slot is caught up inside its window and dropped after it", () => {
    const { digest, alert, reminder } = notificationsConfig.schedule;
    const monday = at("2026-11-16T07:30:00Z").getTime();
    const hours = (count: number) => count * 3_600_000;
    expect(kinds(new Date(monday + hours(digest.catchUpHours) - 1))).toContain("digest:2026-W47");
    expect(kinds(new Date(monday + hours(digest.catchUpHours))).some((entry) => entry.startsWith("digest"))).toBe(false);
    expect(kinds(new Date(monday + hours(alert.catchUpHours) - 1))).toContain("alert:2026-11-16");
    expect(kinds(new Date(monday + hours(alert.catchUpHours)))).not.toContain("alert:2026-11-16");
    const eight = at("2026-11-16T08:00:00Z").getTime();
    expect(kinds(new Date(eight + hours(reminder.catchUpHours) - 1))).toContain("reminder:2026-11-16");
    expect(kinds(new Date(eight + hours(reminder.catchUpHours)))).not.toContain("reminder:2026-11-16");
  });

  it("ticking every five minutes through both clock changes starts each period once, at the promised UK time", () => {
    const expected: Record<ScheduledKind, string> = { digest: "07:30", alert: "07:30", reminder: "08:00", renewal: "08:00" };
    for (const [from, to] of [
      ["2026-03-23T00:00:00Z", "2026-04-06T00:00:00Z"],
      ["2026-10-19T00:00:00Z", "2026-11-02T00:00:00Z"],
    ] as const) {
      const firstSeen = new Map<string, Date>();
      for (let tick = at(from).getTime(); tick < at(to).getTime(); tick += 5 * 60_000) {
        for (const slot of dueSlots(new Date(tick))) {
          const key = `${slot.kind}:${slot.period}`;
          if (!firstSeen.has(key)) firstSeen.set(key, new Date(tick));
        }
      }
      const started = [...firstSeen.entries()].filter(([, tick]) => tick.getTime() > at(from).getTime());
      // Two weeks: 2 digests, 10 alerts, 14 reminders, 14 renewal checks — none twice, none missing.
      const count = (kind: string) => started.filter(([key]) => key.startsWith(`${kind}:`)).length;
      expect({ digest: count("digest"), alert: count("alert"), reminder: count("reminder"), renewal: count("renewal") }).toEqual({ digest: 2, alert: 10, reminder: 14, renewal: 14 });
      for (const [key, tick] of started) {
        const kind = key.split(":")[0] as ScheduledKind;
        const { hour, minute } = londonParts(tick);
        expect(`${key} at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`).toBe(`${key} at ${expected[kind]}`);
      }
    }
  });

  it("names the slot before the latest one", () => {
    const tuesday = at("2026-11-17T09:00:00Z");
    expect(latestSlot("alert", tuesday)).toMatchObject({ period: "2026-11-17" });
    expect(previousSlot("alert", tuesday)).toMatchObject({ period: "2026-11-16" });
    // Monday's previous alert is Friday's.
    expect(previousSlot("alert", at("2026-11-16T09:00:00Z"))?.scheduledFor.toISOString()).toBe("2026-11-13T07:30:00.000Z");
    expect(previousSlot("digest", at("2026-11-16T09:00:00Z"))).toMatchObject({ period: "2026-W46" });
    // Before this week's slot the latest digest is still last week's.
    expect(latestSlot("digest", at("2026-11-16T07:00:00Z"))).toMatchObject({ period: "2026-W46" });
  });
});

describe("how dates are worded", () => {
  it("writes a deadline with its weekday and a 24-hour UK time", () => {
    expect(formatDeadlineMoment(at("2026-11-26T12:00:00Z"))).toBe("Thu 26 Nov 2026, 12:00 noon");
    expect(formatDeadlineMoment(at("2026-06-04T11:00:00Z"))).toBe("Thu 4 Jun 2026, 12:00 noon"); // BST
    expect(formatDeadlineMoment(at("2026-11-26T17:00:00Z"))).toBe("Thu 26 Nov 2026, 17:00");
    expect(formatClockTime(at("2026-11-27T00:00:00Z"))).toBe("00:00 (midnight, start of the day)");
    expect(formatClockTime(at("2026-06-04T22:59:00Z"))).toBe("23:59");
  });

  it("says how long is left in whole UK days", () => {
    const deadline = at("2026-11-26T12:00:00Z");
    expect(daysLeftLabel(deadline, at("2026-10-04T09:00:00Z"))).toBe("53 days left");
    expect(daysLeftLabel(deadline, at("2026-11-25T09:00:00Z"))).toBe("1 day left");
    expect(daysLeftLabel(deadline, at("2026-11-26T09:00:00Z"))).toBe("closes today");
    expect(daysLeftLabel(deadline, at("2026-11-26T12:00:00Z"))).toBeNull();
  });

  it("names the moment an e-mail looks back to", () => {
    const now = at("2026-11-16T07:30:00Z");
    expect(describeSince(at("2026-11-09T07:30:00Z"), now)).toBe("last Monday");
    expect(describeSince(at("2026-11-15T07:30:00Z"), now)).toBe("yesterday");
    expect(describeSince(at("2026-11-13T07:30:00Z"), now)).toBe("Friday");
    expect(describeSince(at("2026-11-06T07:30:00Z"), now)).toBe("Fri 6 Nov");
  });
});
