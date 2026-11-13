import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { radarAccess, type RadarAccess } from "@/features/procurement/access";
import type { NoticeCard } from "@/features/procurement/queries/shared";
import { getRadarItemStates, getSavedTenders, listRadarSources, type RadarSource } from "@/features/procurement/radar/data";
import type { OrgContext } from "@/server/session";
import { notificationsConfig } from "../config";
import { londonDaysBetween } from "../time";
import { shortCompanyName } from "../wording";

/**
 * A workspace's radar as a scheduled e-mail sees it: its sources, its plan's cap and its
 * saved and dismissed tenders.
 *
 * Read through the SAME functions the Radar screen calls (radar/data.ts, access.ts) and
 * through the member's OrgContext, so an e-mail can never show something the app would
 * not. Which tenders and contracts are worth mentioning is decided in ./matches.ts.
 */
export type RadarSnapshot = {
  access: RadarAccess;
  /** The radar sources the plan covers (a capped plan has one). */
  sources: RadarSource[];
  /** How the radar is named: "Aldermoor & Pike" in a sentence, the registered name in the footer. */
  label: RadarLabel | null;
  savedOcids: Set<string>;
  /** Procurements the workspace dismissed: never mentioned. */
  dismissed: string[];
  /** Saved tenders that are still open and close within the next 14 days, soonest first. */
  savedClosing: NoticeCard[];
};

export type RadarLabel = { short: string; full: string; otherSources: number };

/** An open tender: the newest tender-stage notice is live and its deadline has not passed (same rule as the tender page). */
export function isOpenTender(card: Pick<NoticeCard, "stage" | "noticeType" | "status" | "deadlineAt">, now: Date): boolean {
  if (card.stage !== "tender" || card.noticeType === "UK12" || (card.status ?? "active") !== "active" || !card.deadlineAt) return false;
  return Date.parse(card.deadlineAt) > now.getTime();
}

/**
 * The radar is named after the company it follows, as on the Radar screen. Several radars
 * in one workspace go by the workspace's own name — unless that is still the automatic
 * "Joanne's workspace", which says nothing.
 */
export function radarLabel(workspaceName: string, sources: ReadonlyArray<Pick<RadarSource, "name">>): RadarLabel | null {
  const primary = sources[0];
  if (!primary) return null;
  const workspaceNamed = !/'s workspace$/i.test(workspaceName.trim());
  const short = sources.length > 1 && workspaceNamed ? workspaceName.trim() : shortCompanyName(primary.name);
  return { short, full: primary.name, otherSources: sources.length - 1 };
}

export async function loadRadarSnapshot(ctx: OrgContext, now: Date): Promise<RadarSnapshot> {
  const access = radarAccess(ctx.entitlements);
  const [allSources, states, saved] = await Promise.all([listRadarSources(ctx), getRadarItemStates(ctx), getSavedTenders(ctx)]);
  // A capped plan has one radar; if a downgraded workspace still holds more, the e-mail
  // follows the first — the one the Radar screen opens on.
  const sources = access.maxProfiles === null ? allSources : allSources.slice(0, Math.max(1, access.maxProfiles));
  return {
    access,
    sources,
    label: radarLabel(ctx.organization.name, sources),
    savedOcids: new Set([...states].filter(([, state]) => state === "saved").map(([ocid]) => ocid)),
    dismissed: [...states].filter(([, state]) => state === "dismissed").map(([ocid]) => ocid),
    savedClosing: saved.filter((card) => isOpenTender(card, now) && londonDaysBetween(now, new Date(card.deadlineAt!)) <= notificationsConfig.digest.savedClosingDays),
  };
}

export const endingKey = (item: { ocid: string; supplierId: string }) => `${item.ocid}|${item.supplierId}`;

// ---------------------------------------------------------------------------
// "First seen": when a procurement first appeared on our side
// ---------------------------------------------------------------------------

const jsonTextArray = (values: readonly string[]) => sql`array(select jsonb_array_elements_text(${JSON.stringify(values)}::jsonb))`;

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;
  const time = Date.parse(value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  return Number.isNaN(time) ? null : new Date(time);
}

/**
 * When each procurement first had a tender notice here: the time we stored it — or, for a
 * notice that reached us long after it was published (backfill, re-import, a restored
 * database), its publication date, so old tenders are never announced as new.
 */
export async function tenderFirstSeen(ocids: readonly string[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (ocids.length === 0) return out;
  const grace = notificationsConfig.lateArrivalGraceHours;
  const rows = await db.execute<{ ocid: string; first_seen: unknown }>(sql`
    select n.ocid,
           min(case when n.ingested_at - n.published_at <= make_interval(hours => ${grace}::int) then n.ingested_at else n.published_at end) as first_seen
    from notices n
    where n.ocid = any(${jsonTextArray(ocids)}) and n.stage = 'tender'
    group by n.ocid
  `);
  for (const row of rows) {
    const date = toDate(row.first_seen);
    if (date) out.set(row.ocid, date);
  }
  return out;
}

/** The same for contracts, keyed by `endingKey()` (procurement and supplier). */
export async function contractFirstSeen(contracts: ReadonlyArray<{ ocid: string; supplierId: string }>): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (contracts.length === 0) return out;
  const grace = notificationsConfig.lateArrivalGraceHours;
  const wanted = new Set(contracts.map(endingKey));
  const rows = await db.execute<{ ocid: string; supplier_id: string; first_seen: unknown }>(sql`
    select a.ocid, a.supplier_id,
           min(case when n.ingested_at - a.published_at <= make_interval(hours => ${grace}::int) then n.ingested_at else a.published_at end) as first_seen
    from awards a join notices n on n.id = a.notice_id
    where a.ocid = any(${jsonTextArray([...new Set(contracts.map((contract) => contract.ocid))])})
    group by a.ocid, a.supplier_id
  `);
  for (const row of rows) {
    const key = endingKey({ ocid: row.ocid, supplierId: row.supplier_id });
    const date = toDate(row.first_seen);
    if (date && wanted.has(key)) out.set(key, date);
  }
  return out;
}
