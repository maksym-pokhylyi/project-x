import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { matchTier, MIN_MATCH_SCORE, scoreNotice, type MatchTier, type RadarSpec, type ScoreBreakdown } from "../domain/profile";
import { explainMatch, matchFacts, type MatchFacts, type ReferenceAward } from "../domain/reasons";
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
 *  3. matchTier() sorts what clears the threshold into two tiers: "strong" — the profile's
 *     own line of work, where it works (or a buyer it has already won from) — and "wider",
 *     the rest. Lists, counts, caps and e-mails are about STRONG matches: that is the default
 *     of every function here. One framework award with thirty codes must not turn 444 open
 *     tenders into "matches".
 * Every match carries a deterministic one-line reason; cached model-written reasons, when
 * present, replace it. It also carries the counted facts behind the reason chips of a row
 * (wins from this buyer, wins in the same work) — see domain/reasons.ts.
 */

export type MatchItem = NoticeCard & {
  score: number;
  /** "strong" or "wider" — see matchTier() in domain/profile.ts. */
  tier: MatchTier;
  reason: string;
  reasonSource: "rule" | "ai";
  breakdown: ScoreBreakdown;
  facts: MatchFacts;
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
  /** Only notices whose deadline falls within this many days. */
  closingWithinDays?: number | null;
};

export type MatchResult = {
  items: MatchItem[];
  /** Matches in the requested tier after filters and exclusions, before `limit` and `offset`. */
  total: number;
  /** The same matches by tier; with `tier: "strong"` (the default) `total === strong`. */
  strong: number;
  wider: number;
};

export type MatchOptions = {
  limit?: number;
  offset?: number;
  now?: Date;
  filters?: MatchFilters;
  excludeOcids?: readonly string[];
  /**
   * "relevance" (default): best match first. "deadline": every match above the threshold,
   * soonest deadline first — the order of a work list.
   */
  order?: "relevance" | "deadline";
  /**
   * "strong" (default): only the profile's own line of work — what a list, a count, the Free
   * cap or an e-mail should show. "all": the strong matches first, then the wider ones, each
   * in the chosen order; every item says which tier it is in.
   */
  tier?: "strong" | "all";
};

const CANDIDATE_LIMIT = 1500;
/** Own contracts read for the reason of a match: enough to count wins per buyer for all but the largest suppliers. */
const REFERENCE_LIMIT = 300;

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

/** Whether a notice passes a set of match filters (the same test the queries apply). */
export function passesFilters(item: NoticeCard, filters: MatchFilters | undefined, now: Date): boolean {
  if (!filters) return true;
  if (filters.closingWithinDays != null) {
    const deadline = item.deadlineAt ? Date.parse(item.deadlineAt) : Number.NaN;
    if (Number.isNaN(deadline) || deadline > now.getTime() + filters.closingWithinDays * 86_400_000) return false;
  }
  if (filters.division && !item.cpvCodes.some((code) => code.startsWith(filters.division!))) return false;
  if (filters.region && !(item.regions.includes(filters.region) || item.regions.includes("UK"))) return false;
  if (filters.valueMin != null && (item.valueAmount === null || item.valueAmount < filters.valueMin)) return false;
  if (filters.valueMax != null && (item.valueAmount === null || item.valueAmount > filters.valueMax)) return false;
  if (filters.kind === "below_threshold" && item.aboveThreshold !== false) return false;
  if (filters.kind === "framework" && !item.isFramework) return false;
  if (filters.kind === "tender" && (item.aboveThreshold === false || item.isFramework)) return false;
  return true;
}

/** Soonest deadline first; notices without one (early notices) last, newest first. */
function byDeadline(a: NoticeCard, b: NoticeCard): number {
  if (a.deadlineAt && b.deadlineAt) return a.deadlineAt.localeCompare(b.deadlineAt) || a.ocid.localeCompare(b.ocid);
  if (a.deadlineAt || b.deadlineAt) return a.deadlineAt ? -1 : 1;
  return b.publishedAt.localeCompare(a.publishedAt) || a.ocid.localeCompare(b.ocid);
}

const NO_MATCHES: MatchResult = { items: [], total: 0, strong: 0, wider: 0 };

type Scored = { card: NoticeCard; breakdown: ScoreBreakdown; tier: MatchTier };

function byRelevance(a: Scored, b: Scored): number {
  return (
    b.breakdown.total - a.breakdown.total ||
    (a.card.deadlineAt ?? a.card.publishedAt).localeCompare(b.card.deadlineAt ?? b.card.publishedAt) ||
    a.card.ocid.localeCompare(b.card.ocid)
  );
}

async function scoreCandidates(spec: RadarSpec, rows: Array<Record<string, unknown>>, options: MatchOptions): Promise<MatchResult> {
  const excluded = new Set(options.excludeOcids ?? []);
  const now = options.now ?? new Date();
  const passed: Array<{ card: NoticeCard; breakdown: ScoreBreakdown }> = [];
  for (const row of rows) {
    const card = toNoticeCard(row);
    if (excluded.has(card.ocid) || !passesFilters(card, options.filters, now)) continue;
    const breakdown = scoreNotice(spec, { title: card.title, cpvCodes: card.cpvCodes, regions: card.regions, valueAmount: card.valueAmount, textRank: num(row.text_rank) ?? 0 });
    if (breakdown.total >= MIN_MATCH_SCORE) passed.push({ card, breakdown });
  }
  if (passed.length === 0) return NO_MATCHES;

  // The supplier's own contracts: who it has won from helps decide the tier, and they anchor the reasons.
  const references = spec.supplierId ? await getReferenceAwards(spec.supplierId, REFERENCE_LIMIT) : [];
  const winsByBuyer = new Map<string, number>();
  for (const reference of references) if (reference.buyerId) winsByBuyer.set(reference.buyerId, (winsByBuyer.get(reference.buyerId) ?? 0) + 1);
  const scored = passed.map((entry): Scored => ({ ...entry, tier: matchTier(spec, entry.breakdown, entry.card.buyerId ? (winsByBuyer.get(entry.card.buyerId) ?? 0) : 0) }));
  const strong = scored.filter((entry) => entry.tier === "strong").length;
  const wider = scored.length - strong;
  const wanted = options.tier === "all" ? scored : scored.filter((entry) => entry.tier === "strong");
  // Strong matches always come first; within a tier, the chosen order.
  wanted.sort((a, b) => Number(b.tier === "strong") - Number(a.tier === "strong") || (options.order === "deadline" ? byDeadline(a.card, b.card) : byRelevance(a, b)));
  const offset = options.offset ?? 0;
  const page = wanted.slice(offset, offset + (options.limit ?? 25));
  if (page.length === 0) return { items: [], total: wanted.length, strong, wider };

  const [labels, cached] = await Promise.all([
    getCpvLabels(page.flatMap((entry) => entry.card.cpvCodes)),
    queryRows<{ ocid: string; reason: string }>(
      db,
      sql`select ocid, reason from match_reasons where profile_key = ${spec.key} and ocid = any(${textArrayParam(page.map((entry) => entry.card.ocid))})`,
    ),
  ]);
  const aiReasons = new Map(cached.map((row) => [row.ocid, row.reason]));
  const items = page.map(({ card, breakdown, tier }): MatchItem => {
    const ai = aiReasons.get(card.ocid);
    return {
      ...card,
      score: breakdown.total,
      tier,
      breakdown,
      reason: ai ?? explainMatch(spec, card, breakdown, references, labels),
      reasonSource: ai ? "ai" : "rule",
      facts: matchFacts(spec, card, breakdown, references, labels),
    };
  });
  return { items, total: wanted.length, strong, wider };
}

/**
 * Open tenders for a radar spec (supplier profile or manual profile): its STRONG matches,
 * best first, unless `options.tier` is "all" — see MatchOptions.
 */
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
 * How one procurement matches a radar spec, for the "Why this matches you" panel of the
 * tender page. Null when it does not reach the match threshold (or is not a tender or an
 * early notice). Unlike the lists, a closed tender still gets its explanation.
 */
export async function getMatchForNotice(spec: RadarSpec, ocid: string, now: Date = new Date()): Promise<MatchItem | null> {
  const query = keywordsToWebQuery(spec.keywords);
  const rows = await queryRows<Record<string, unknown>>(
    db,
    sql`
      select ${NOTICE_CARD_COLUMNS},
             ${query ? sql`ts_rank_cd(n.search, q.query, 32)` : sql`0`} as text_rank
      from notices n
      left join buyers b on b.id = n.buyer_id
      cross join (select ${query ? sql`websearch_to_tsquery('english', ${query})` : sql`null::tsquery`} as query) q
      where n.ocid = ${ocid} and n.is_latest and n.stage in ('tender', 'planning')
      order by (n.stage = 'tender') desc, n.published_at desc
      limit 1
    `,
  );
  const result = await scoreCandidates(spec, rows, { limit: 1, now, tier: "all" });
  return result.items[0] ?? null;
}

/**
 * A supplier's open tenders: live tender-stage notices (deadline in the future) ranked by
 * CPV overlap, full-text similarity, region and value fit, each with a one-line reason.
 * STRONG matches only unless `options.tier` is "all": anything that lists or counts
 * "matches" for a supplier (pages, the radar, digests) inherits that default from here.
 */
export async function getSupplierMatches(supplierId: string, options: MatchOptions = {}): Promise<MatchResult> {
  const spec = await getSupplierSpec(supplierId);
  if (!spec) return NO_MATCHES;
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
  return scoreCandidates(spec, rows, options);
}

export async function getEarlySignals(supplierId: string, options: MatchOptions = {}): Promise<MatchResult> {
  const spec = await getSupplierSpec(supplierId);
  if (!spec) return NO_MATCHES;
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
