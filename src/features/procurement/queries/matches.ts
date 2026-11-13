import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { MIN_MATCH_SCORE, scoreNotice, type RadarSpec, type ScoreBreakdown } from "../domain/profile";
import { explainMatch, type ReferenceAward } from "../domain/reasons";
import { keywordsToWebQuery } from "../domain/text";
import { AWARD_DATE_SQL, CONTRACT_VALUE_SQL, WON_STATUSES_SQL } from "../ingest/upsert";
import {
  db,
  getCpvLabels,
  getSupplierSpec,
  iso,
  liveTenderCondition,
  NOTICE_CARD_COLUMNS,
  num,
  queryRows,
  str,
  textArrayParam,
  toNoticeCard,
  type NoticeCard,
} from "./shared";

/**
 * Matching: which open tenders (and early notices) resemble the work a supplier has won.
 *
 * Two steps:
 *  1. SQL picks candidates cheaply with indexes: live notices that share a CPV division
 *     with the profile OR match its keywords in full-text search (GIN on both).
 *  2. scoreNotice() ranks them: CPV overlap at the deepest shared level (45%), keywords
 *     and full-text rank (20%), region (18%), value fit (17%) — see domain/profile.ts.
 * Every match carries a deterministic one-line reason; cached model-written reasons, when
 * present, replace it.
 */

export type MatchItem = NoticeCard & {
  score: number;
  reason: string;
  reasonSource: "rule" | "ai";
  breakdown: ScoreBreakdown;
};

export type MatchFilters = {
  /** CPV division, e.g. "45". */
  division?: string | null;
  /** Top-level region, e.g. "UKI". */
  region?: string | null;
  valueMin?: number | null;
  valueMax?: number | null;
  /** tender | below_threshold | framework */
  kind?: string | null;
};

export type MatchResult = { items: MatchItem[]; total: number };

export type MatchOptions = { limit?: number; offset?: number; now?: Date; filters?: MatchFilters; excludeOcids?: readonly string[] };

const CANDIDATE_LIMIT = 1500;

function candidateCondition(spec: RadarSpec, query: string | null): SQL {
  const divisions = spec.cpvDivisions;
  if (divisions.length === 0 && !query) return sql`false`;
  if (divisions.length === 0) return sql`n.search @@ q.query`;
  if (!query) return sql`n.cpv_divisions && ${textArrayParam(divisions)}`;
  return sql`(n.cpv_divisions && ${textArrayParam(divisions)} or n.search @@ q.query)`;
}

/** The supplier's own contracts, newest first, used to anchor match reasons. */
export async function getReferenceAwards(supplierId: string, limit = 80): Promise<ReferenceAward[]> {
  const rows = await queryRows<Record<string, unknown>>(
    db,
    sql`
      select a.ocid, min(a.title) as title, string_agg(array_to_string(a.cpv_codes, ','), ',') as cpv_codes,
             ${CONTRACT_VALUE_SQL} as value_amount, max(a.buyer_id) as buyer_id, max(b.name) as buyer_name, max(${AWARD_DATE_SQL}) as award_date
      from awards a left join buyers b on b.id = a.buyer_id
      where a.supplier_id = ${supplierId} and a.is_current and a.effective_status in ${WON_STATUSES_SQL}
      group by a.ocid
      order by max(${AWARD_DATE_SQL}) desc
      limit ${limit}
    `,
  );
  return rows.map((row) => ({
    ocid: String(row.ocid),
    title: String(row.title ?? ""),
    cpvCodes: [...new Set(String(row.cpv_codes ?? "").split(",").filter(Boolean))],
    valueAmount: num(row.value_amount),
    buyerId: str(row.buyer_id),
    buyerName: str(row.buyer_name),
    date: iso(row.award_date) ?? "",
  }));
}

function passesFilters(item: NoticeCard, filters: MatchFilters | undefined): boolean {
  if (!filters) return true;
  if (filters.division && !item.cpvCodes.some((code) => code.startsWith(filters.division!))) return false;
  if (filters.region && !(item.regions.includes(filters.region) || item.regions.includes("UK"))) return false;
  if (filters.valueMin != null && (item.valueAmount === null || item.valueAmount < filters.valueMin)) return false;
  if (filters.valueMax != null && (item.valueAmount === null || item.valueAmount > filters.valueMax)) return false;
  if (filters.kind === "below_threshold" && item.aboveThreshold !== false) return false;
  if (filters.kind === "framework" && !item.isFramework) return false;
  if (filters.kind === "tender" && (item.aboveThreshold === false || item.isFramework)) return false;
  return true;
}

async function scoreCandidates(spec: RadarSpec, rows: Array<Record<string, unknown>>, options: MatchOptions): Promise<MatchResult> {
  const excluded = new Set(options.excludeOcids ?? []);
  const scored: Array<{ card: NoticeCard; breakdown: ScoreBreakdown }> = [];
  for (const row of rows) {
    const card = toNoticeCard(row);
    if (excluded.has(card.ocid) || !passesFilters(card, options.filters)) continue;
    const breakdown = scoreNotice(spec, { title: card.title, cpvCodes: card.cpvCodes, regions: card.regions, valueAmount: card.valueAmount, textRank: num(row.text_rank) ?? 0 });
    if (breakdown.total >= MIN_MATCH_SCORE) scored.push({ card, breakdown });
  }
  scored.sort(
    (a, b) =>
      b.breakdown.total - a.breakdown.total ||
      (a.card.deadlineAt ?? a.card.publishedAt).localeCompare(b.card.deadlineAt ?? b.card.publishedAt) ||
      a.card.ocid.localeCompare(b.card.ocid),
  );
  const offset = options.offset ?? 0;
  const page = scored.slice(offset, offset + (options.limit ?? 25));
  if (page.length === 0) return { items: [], total: scored.length };

  const [references, labels, cached] = await Promise.all([
    spec.supplierId ? getReferenceAwards(spec.supplierId) : Promise.resolve([]),
    getCpvLabels(page.flatMap((entry) => entry.card.cpvCodes)),
    queryRows<{ ocid: string; reason: string }>(
      db,
      sql`select ocid, reason from match_reasons where profile_key = ${spec.key} and ocid = any(${textArrayParam(page.map((entry) => entry.card.ocid))})`,
    ),
  ]);
  const aiReasons = new Map(cached.map((row) => [row.ocid, row.reason]));
  const items = page.map(({ card, breakdown }): MatchItem => {
    const ai = aiReasons.get(card.ocid);
    return {
      ...card,
      score: breakdown.total,
      breakdown,
      reason: ai ?? explainMatch(spec, card, breakdown, references, labels),
      reasonSource: ai ? "ai" : "rule",
    };
  });
  return { items, total: scored.length };
}

/** Open tenders ranked for a radar spec (supplier profile or manual profile). */
export async function getMatchesForSpec(spec: RadarSpec, options: MatchOptions = {}): Promise<MatchResult> {
  const now = options.now ?? new Date();
  const query = keywordsToWebQuery(spec.keywords);
  const rows = await queryRows<Record<string, unknown>>(
    db,
    sql`
      select ${NOTICE_CARD_COLUMNS},
             ${query ? sql`ts_rank_cd(n.search, q.query, 32)` : sql`0`} as text_rank
      from notices n
      left join buyers b on b.id = n.buyer_id
      cross join (select ${query ? sql`websearch_to_tsquery('english', ${query})` : sql`null::tsquery`} as query) q
      where ${liveTenderCondition(now)} and ${candidateCondition(spec, query)}
      order by n.deadline_at asc
      limit ${CANDIDATE_LIMIT}
    `,
  );
  return scoreCandidates(spec, rows, options);
}

/**
 * Live tender-stage notices (deadline in the future) ranked by CPV overlap, full-text
 * similarity, region and value fit, each with a one-line reason.
 */
export async function getSupplierMatches(supplierId: string, options: MatchOptions = {}): Promise<MatchResult> {
  const spec = await getSupplierSpec(supplierId);
  if (!spec) return { items: [], total: 0 };
  return getMatchesForSpec(spec, options);
}

/**
 * Early signals: planning-stage notices (pipeline, market engagement, planned procurement)
 * for procurements that have not reached a tender yet.
 */
export async function getEarlySignalsForSpec(spec: RadarSpec, options: MatchOptions = {}): Promise<MatchResult> {
  const now = options.now ?? new Date();
  const query = keywordsToWebQuery(spec.keywords);
  const rows = await queryRows<Record<string, unknown>>(
    db,
    sql`
      select ${NOTICE_CARD_COLUMNS},
             ${query ? sql`ts_rank_cd(n.search, q.query, 32)` : sql`0`} as text_rank
      from notices n
      left join buyers b on b.id = n.buyer_id
      cross join (select ${query ? sql`websearch_to_tsquery('english', ${query})` : sql`null::tsquery`} as query) q
      where n.stage = 'planning' and n.is_latest
        and n.published_at > ${now.toISOString()}::timestamptz - interval '12 months'
        and coalesce(n.status, 'planned') in ('planning', 'planned', 'active')
        -- Still ahead of us: the expected tender date has not long passed…
        and (n.future_notice_at is null or n.future_notice_at > ${now.toISOString()}::timestamptz - interval '30 days')
        -- …and the procurement has not moved on to a tender or an award.
        and not exists (select 1 from notices t where t.ocid = n.ocid and t.stage in ('tender', 'award'))
        -- Buyers sometimes publish the tender under a new ocid: drop the early notice once a same-titled tender is out.
        and not exists (select 1 from notices t where t.buyer_id = n.buyer_id and t.stage = 'tender' and lower(t.title) = lower(n.title))
        and ${candidateCondition(spec, query)}
      order by n.published_at desc
      limit ${CANDIDATE_LIMIT}
    `,
  );
  const result = await scoreCandidates(spec, rows, options);
  return result;
}

export async function getEarlySignals(supplierId: string, options: MatchOptions = {}): Promise<MatchResult> {
  const spec = await getSupplierSpec(supplierId);
  if (!spec) return { items: [], total: 0 };
  return getEarlySignalsForSpec(spec, options);
}

/** A buyer's open tenders and early notices (buyer page). */
export async function getBuyerNotices(buyerId: string, now: Date = new Date()): Promise<{ live: NoticeCard[]; planning: NoticeCard[] }> {
  const [live, planning] = await Promise.all([
    queryRows<Record<string, unknown>>(
      db,
      sql`select ${NOTICE_CARD_COLUMNS} from notices n left join buyers b on b.id = n.buyer_id where n.buyer_id = ${buyerId} and ${liveTenderCondition(now)} order by n.deadline_at asc limit 50`,
    ),
    queryRows<Record<string, unknown>>(
      db,
      sql`
        select ${NOTICE_CARD_COLUMNS} from notices n left join buyers b on b.id = n.buyer_id
        where n.buyer_id = ${buyerId} and n.stage = 'planning' and n.is_latest
          and n.published_at > ${now.toISOString()}::timestamptz - interval '12 months'
          and (n.future_notice_at is null or n.future_notice_at > ${now.toISOString()}::timestamptz - interval '30 days')
          and not exists (select 1 from notices t where t.ocid = n.ocid and t.stage in ('tender', 'award'))
        order by n.published_at desc limit 25
      `,
    ),
  ]);
  return { live: live.map(toNoticeCard), planning: planning.map(toNoticeCard) };
}
