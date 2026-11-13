import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { NotificationItemRef } from "@/db/schema";
import { getSavedTenders } from "@/features/procurement/radar/data";
import type { OrgContext } from "@/server/session";
import { notificationsConfig } from "../config";
import { reminderKey, remindedBefore } from "../log";
import { formatDeadlineMoment, londonDaysBetween } from "../time";
import { clipTitle } from "../wording";
import { isOpenTender } from "./radar";

/**
 * Deadline reminders: 7 days and 2 days before a tender the workspace is working on closes.
 *
 * WHERE DEADLINES COME FROM — the seam for other modules
 * A `DeadlineSource` lists the open deadlines of a workspace. Two are registered:
 *   - saved tenders (the radar's Saved list), implemented below;
 *   - bids in progress — `bidsDeadlineSource`, which returns nothing until the bids module
 *     is merged. To plug it in, either fill in its two functions, or call
 *     `registerDeadlineSource({ name: "bids", … })` from the bids module (same name replaces).
 *     A bid can bring the lines of the artboard's "Where your bid stands" list (`progress`),
 *     its own page (`url`) and link label ("Open the bid").
 * A tender present in two sources (saved AND being bid for) is mentioned once: sources are
 * de-duplicated on `ocid`, the later source winning (its link goes to the bid).
 *
 * WHICH DAYS — calendar days in UK time between today and the closing date, so "closes in
 * 2 days" is sent on Tuesday for a Thursday deadline whatever the hour, and stays right
 * across a clock change.
 *
 * ONCE — each (member, tender, offset) is mentioned once, ever: the offsets already sent
 * are read from notification_log. A deadline the buyer moves does not start them again.
 */
export type DeadlineItem = {
  /** Stable id within the source (the ocid for saved tenders, the bid id for bids). */
  ref: string;
  /** The procurement, when the deadline belongs to one: used to merge sources. */
  ocid: string | null;
  title: string;
  buyer: string | null;
  deadlineAt: Date;
  /** Where the main link leads (absolute, or a path on this site). Null = the tender page of `ocid`. */
  url: string | null;
  /** Label of the main link. Default "Open on Bidfolio". */
  openLabel?: string;
  /** The official notice on Find a Tender. */
  noticeUrl: string | null;
  /** Where the work stands, one fact per line ("4 of 6 answers drafted and marked"). Bids only. */
  progress?: string[];
};

export type DeadlineSource = {
  name: string;
  /** Workspaces with at least one deadline inside any of the ranges: the fan-out only visits these. */
  organizations(ranges: ReadonlyArray<{ from: Date; to: Date }>): Promise<string[]>;
  /** The open deadlines of one workspace, read through the member's context. */
  list(ctx: OrgContext, now: Date): Promise<DeadlineItem[]>;
};

/** Saved tenders on the radar: the same list as the "Saved" tab, open tenders only. */
export const savedTendersSource: DeadlineSource = {
  name: "radar",
  async organizations(ranges) {
    if (ranges.length === 0) return [];
    const inRange = sql.join(
      ranges.map((range) => sql`(n.deadline_at >= ${range.from.toISOString()}::timestamptz and n.deadline_at < ${range.to.toISOString()}::timestamptz)`),
      sql` or `,
    );
    const rows = await db.execute<{ organization_id: string }>(sql`
      select distinct r.organization_id
      from radar_items r
      join notices n on n.ocid = r.ocid and n.stage = 'tender' and n.is_latest
      where r.state = 'saved' and (${inRange})
    `);
    return rows.map((row) => row.organization_id);
  },
  async list(ctx, now) {
    const saved = await getSavedTenders(ctx);
    return saved
      .filter((card) => isOpenTender(card, now))
      .map((card) => ({ ref: card.ocid, ocid: card.ocid, title: card.title, buyer: card.buyerName, deadlineAt: new Date(card.deadlineAt!), url: null, noticeUrl: card.noticeUrl }));
  },
};

/**
 * Bids in progress. EMPTY ON PURPOSE: the bids module lives in another branch. At merge,
 * return the workspace's open bids here (ref = bid id, ocid = the linked tender if any,
 * url = the bid's page, openLabel = "Open the bid", progress = where it stands) — nothing
 * else in this module needs to change.
 */
export const bidsDeadlineSource: DeadlineSource = {
  name: "bids",
  async organizations() {
    return [];
  },
  async list() {
    return [];
  },
};

const sources: DeadlineSource[] = [savedTendersSource, bidsDeadlineSource];

/** Adds a source of deadlines, or replaces the one with the same name. */
export function registerDeadlineSource(source: DeadlineSource): void {
  const index = sources.findIndex((existing) => existing.name === source.name);
  if (index === -1) sources.push(source);
  else sources[index] = source;
}

export function deadlineSources(): readonly DeadlineSource[] {
  return sources;
}

export type ReminderLine = {
  /** What the dedupe is keyed on: the ocid, or `<source>:<ref>`. */
  key: string;
  ocid: string | null;
  title: string;
  buyer: string | null;
  /** Calendar days (UK) until it closes. */
  daysLeft: number;
  /** "Thu 26 Nov 2026, 12:00 noon" */
  moment: string;
  url: string | null;
  openLabel: string | null;
  noticeUrl: string | null;
  progress: string[];
};

export type ReminderContent = {
  asOf: Date;
  items: ReminderLine[];
  refs: NotificationItemRef[];
};

/** Every open deadline of the workspace, one per tender, soonest first. */
export async function listDeadlines(ctx: OrgContext, now: Date): Promise<Array<DeadlineItem & { key: string }>> {
  const byKey = new Map<string, DeadlineItem & { key: string }>();
  for (const source of sources) {
    for (const item of await source.list(ctx, now)) {
      if (item.deadlineAt.getTime() <= now.getTime()) continue;
      const key = item.ocid ?? `${source.name}:${item.ref}`;
      byKey.set(key, { ...item, key });
    }
  }
  return [...byKey.values()].sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime() || a.key.localeCompare(b.key));
}

export function reminderLine(item: DeadlineItem & { key: string }, now: Date): ReminderLine {
  return {
    key: item.key,
    ocid: item.ocid,
    title: clipTitle(item.title),
    buyer: item.buyer,
    daysLeft: londonDaysBetween(now, item.deadlineAt),
    moment: formatDeadlineMoment(item.deadlineAt),
    url: item.url,
    openLabel: item.openLabel ?? null,
    noticeUrl: item.noticeUrl,
    progress: (item.progress ?? []).slice(0, 6),
  };
}

/**
 * Today's reminder for the member in `ctx`: every tender that closes in exactly 7 or 2
 * calendar days and has not been mentioned at that offset before. Null when there is none.
 * `everything` (previews): the soonest open deadlines, whatever the day.
 */
export async function buildReminder(ctx: OrgContext, now: Date, options: { everything?: boolean } = {}): Promise<ReminderContent | null> {
  const deadlines = await listDeadlines(ctx, now);
  if (deadlines.length === 0) return null;
  const offsets: readonly number[] = notificationsConfig.reminder.offsets;
  const lines = deadlines.map((item) => reminderLine(item, now));
  let due: ReminderLine[];
  if (options.everything) {
    due = lines.slice(0, 3);
  } else {
    const done = await remindedBefore(ctx.user.id, ctx.organization.id);
    due = lines.filter((line) => offsets.includes(line.daysLeft) && !done.has(reminderKey(line.key, line.daysLeft)));
  }
  if (due.length === 0) return null;
  return { asOf: now, items: due, refs: due.map((line) => ({ t: "deadline", ref: line.key, offset: line.daysLeft })) };
}
