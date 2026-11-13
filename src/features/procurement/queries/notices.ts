import "server-only";
import { sql } from "drizzle-orm";
import type { AwardCriterionSummary, LotSummary } from "../domain/map-release";
import { WON_STATUSES_SQL } from "../ingest/upsert";
import {
  db,
  getCpvLabels,
  int,
  iso,
  NOTICE_CARD_COLUMNS,
  num,
  queryRows,
  str,
  textArrayParam,
  toNoticeCard,
  UNPUBLISHED_SUPPLIER_LABEL,
  type NoticeCard,
} from "./shared";

/** Everything the tender page shows about one procurement. Company-level data only. */
export type TenderDetail = NoticeCard & {
  /** How `valueAmount` is stated: net of VAT unless the notice gave only a VAT-inclusive figure. Null when no value is published. */
  valueBasis: "net" | "gross" | null;
  description: string | null;
  procedure: string | null;
  competition: string;
  category: string | null;
  regime: string;
  enquiryDeadlineAt: string | null;
  awardCriteria: { criteria: AwardCriterionSummary[]; description: string | null } | null;
  lots: LotSummary[];
  cpv: Array<{ code: string; label: string | null }>;
  bidsCount: number | null;
  /** True when this is an open tender whose deadline has not passed. */
  isLive: boolean;
  buyerRegion: string | null;
  /** Every notice published for this procurement, newest first. */
  history: Array<{ releaseId: string; stage: string; noticeType: string | null; isUpdate: boolean; publishedAt: string; noticeUrl: string }>;
  /** Winners named in award notices of this procurement. */
  winners: Array<{ name: string; slug: string | null; valueAmount: number | null }>;
};

const OCID_PATTERN = /^ocds-[a-z0-9]{6}-[a-z0-9]{4,12}$/i;
const RELEASE_PATTERN = /^\d{4,7}-\d{4}$/;

/** The public id of a procurement is its ocid; a Find a Tender notice id resolves to it. */
export async function resolveOcid(id: string): Promise<string | null> {
  const value = id.trim();
  if (OCID_PATTERN.test(value)) return value.toLowerCase();
  if (!RELEASE_PATTERN.test(value)) return null;
  const [row] = await queryRows<{ ocid: string }>(db, sql`select ocid from notices where release_id = ${value} order by ocid limit 1`);
  return row?.ocid ?? null;
}

/**
 * The notice that best represents a procurement right now: the newest tender-stage
 * notice if there is one, otherwise the newest notice of any stage.
 */
export async function getTender(idOrOcid: string, now: Date = new Date()): Promise<TenderDetail | null> {
  const ocid = await resolveOcid(idOrOcid);
  if (!ocid) return null;
  const [row] = await queryRows<Record<string, unknown>>(
    db,
    sql`
      select ${NOTICE_CARD_COLUMNS}, n.value_gross, n.description, n.procedure, n.competition, n.category, n.regime, n.enquiry_deadline_at,
             n.award_criteria, n.lots, n.bids_count, b.region as buyer_region
      from notices n left join buyers b on b.id = n.buyer_id
      where n.ocid = ${ocid} and n.is_latest
      order by (n.stage = 'tender') desc, (n.stage = 'planning') desc, n.published_at desc
      limit 1
    `,
  );
  if (!row) return null;
  const card = toNoticeCard(row);
  const [history, winners, labels] = await Promise.all([
    queryRows<Record<string, unknown>>(
      db,
      sql`select release_id, stage, notice_type, is_update, published_at, notice_url from notices where ocid = ${ocid} order by published_at desc, release_id desc limit 40`,
    ),
    queryRows<Record<string, unknown>>(
      db,
      sql`
        select s.name, s.slug, (s.merged_into is null and s.removed_at is null and s.identity_basis <> 'name' and s.is_incorporated) as is_public,
               case when bool_or(a.value_shared or a.is_framework) then null else sum(a.value_amount) end as value_amount
        from awards a join suppliers s on s.id = a.supplier_id
        where a.ocid = ${ocid} and a.is_current and a.effective_status in ${WON_STATUSES_SQL}
        group by s.id, s.name, s.slug
        order by s.name
        limit 30
      `,
    ),
    getCpvLabels(card.cpvCodes),
  ]);
  const criteria = row.award_criteria as TenderDetail["awardCriteria"];
  const deadline = card.deadlineAt ? Date.parse(card.deadlineAt) : null;
  const gross = num(row.value_gross);
  return {
    ...card,
    // The stored figure is the net one when the notice gives it, otherwise the gross one (domain/money.ts).
    valueBasis: card.valueAmount === null ? null : gross !== null && Math.abs(gross - card.valueAmount) < 0.005 ? "gross" : "net",
    description: str(row.description),
    procedure: str(row.procedure),
    competition: String(row.competition ?? "unknown"),
    category: str(row.category),
    regime: String(row.regime),
    enquiryDeadlineAt: iso(row.enquiry_deadline_at),
    awardCriteria: criteria && typeof criteria === "object" ? criteria : null,
    lots: Array.isArray(row.lots) ? (row.lots as LotSummary[]) : [],
    cpv: card.cpvCodes.map((code) => ({ code, label: labels.get(code) ?? null })),
    bidsCount: row.bids_count === null || row.bids_count === undefined ? null : int(row.bids_count),
    isLive: card.stage === "tender" && card.noticeType !== "UK12" && (card.status ?? "active") === "active" && deadline !== null && deadline > now.getTime(),
    buyerRegion: str(row.buyer_region),
    history: history.map((entry) => ({
      releaseId: String(entry.release_id),
      stage: String(entry.stage),
      noticeType: str(entry.notice_type),
      isUpdate: entry.is_update === true,
      publishedAt: iso(entry.published_at) ?? "",
      noticeUrl: String(entry.notice_url),
    })),
    winners: winners.map((entry) => ({
      name: entry.is_public === true ? String(entry.name) : UNPUBLISHED_SUPPLIER_LABEL,
      slug: entry.is_public === true ? String(entry.slug) : null,
      valueAmount: num(entry.value_amount),
    })),
  };
}

/** Notice cards for a list of procurements (saved list, deadline strip), newest tender-stage notice each. */
export async function getNoticeCardsByOcid(ocids: readonly string[]): Promise<NoticeCard[]> {
  if (ocids.length === 0) return [];
  const rows = await queryRows<Record<string, unknown>>(
    db,
    sql`
      select distinct on (n.ocid) ${NOTICE_CARD_COLUMNS}
      from notices n left join buyers b on b.id = n.buyer_id
      where n.ocid = any(${textArrayParam(ocids)}) and n.is_latest
      order by n.ocid, (n.stage = 'tender') desc, (n.stage = 'planning') desc, n.published_at desc
    `,
  );
  return rows.map(toNoticeCard);
}

/** Open tenders for the sitemap: ocid + last change. */
export async function listLiveTenderOcids(limit: number, offset: number, now: Date = new Date()): Promise<Array<{ ocid: string; publishedAt: string }>> {
  const rows = await queryRows<Record<string, unknown>>(
    db,
    sql`
      select n.ocid, n.published_at from notices n
      where n.stage = 'tender' and n.is_latest and n.notice_type is distinct from 'UK12' and coalesce(n.status, 'active') = 'active'
        and n.deadline_at > ${now.toISOString()}::timestamptz
      order by n.published_at desc, n.ocid
      limit ${limit} offset ${offset}
    `,
  );
  return rows.map((row) => ({ ocid: String(row.ocid), publishedAt: iso(row.published_at) ?? "" }));
}
