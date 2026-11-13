import "server-only";
import { sql } from "drizzle-orm";
import type { RadarSpec } from "../domain/profile";
import { NATIONWIDE } from "../domain/regions";
import { AWARD_DATE_SQL, CONTRACT_VALUE_SQL, WON_STATUSES_SQL } from "../ingest/upsert";
import { awardTradeCondition, db, getSupplierSpec, int, iso, num, queryRows, str } from "./shared";

/**
 * Buyers awarding in a supplier's trade.
 *
 * More than half of published awards never appear as an open tender (below-threshold
 * awards made directly or after inviting a few quotes), so "who buys this, and how" is the
 * view a small supplier cannot get from tender alerts.
 */
export type BuyerInsight = {
  buyerId: string;
  name: string;
  slug: string;
  region: string | null;
  buyerType: string | null;
  /** Contracts awarded in the profile's trade within the window. */
  awards: number;
  totalValue: number | null;
  /** Awarded directly, with no competition. */
  direct: number;
  /** Awarded after inviting selected suppliers only. */
  limited: number;
  framework: number;
  open: number;
  /** direct + limited */
  withoutOpenCompetition: number;
  /** Share of `awards` made without an openly advertised competition (0..1). */
  shareWithoutOpen: number;
  suppliers: number;
  /** How many of those contracts went to the profile's own supplier. */
  ownAwards: number;
  lastAwardAt: string | null;
  sameRegion: boolean;
};

export type BuyerOptions = { limit?: number; offset?: number; months?: number; now?: Date; region?: string | null };

export async function getBuyersForSpec(spec: RadarSpec, options: BuyerOptions = {}): Promise<{ items: BuyerInsight[]; total: number }> {
  const trade = awardTradeCondition(spec);
  if (!trade) return { items: [], total: 0 };
  const now = options.now ?? new Date();
  const months = options.months ?? 24;
  const rows = await queryRows<Record<string, unknown>>(
    db,
    sql`
      with k as (
        -- One row per procurement: a framework with forty suppliers is one award decision, not forty.
        select a.buyer_id, a.ocid, ${CONTRACT_VALUE_SQL} as value, min(a.competition) as competition, max(${AWARD_DATE_SQL}) as award_date,
               count(distinct a.supplier_id) as suppliers, bool_or(a.supplier_id = ${spec.supplierId ?? ""}) as own
        from awards a
        where a.is_current and a.effective_status in ${WON_STATUSES_SQL} and a.buyer_id is not null
          and ${AWARD_DATE_SQL} >= ${now.toISOString()}::timestamptz - make_interval(months => ${months}::int)
          and ${trade}
        group by a.buyer_id, a.ocid
      )
      select k.buyer_id, b.name, b.slug, b.region, b.buyer_type,
             count(*) as awards,
             sum(k.value) filter (where k.value < 1000000000) as total_value,
             count(*) filter (where k.competition = 'direct') as direct,
             count(*) filter (where k.competition = 'limited') as limited,
             count(*) filter (where k.competition = 'framework') as framework,
             count(*) filter (where k.competition = 'open') as open,
             sum(k.suppliers) as suppliers,
             count(*) filter (where k.own) as own_awards,
             max(k.award_date) as last_award_at
      from k join buyers b on b.id = k.buyer_id
      where b.merged_into is null
      group by k.buyer_id, b.name, b.slug, b.region, b.buyer_type
    `,
  );
  const specific = spec.regions.filter((region) => region !== NATIONWIDE);
  let items = rows.map((row): BuyerInsight => {
    const awards = int(row.awards);
    const direct = int(row.direct);
    const limited = int(row.limited);
    const region = str(row.region);
    return {
      buyerId: String(row.buyer_id),
      name: String(row.name),
      slug: String(row.slug),
      region,
      buyerType: str(row.buyer_type),
      awards,
      totalValue: num(row.total_value),
      direct,
      limited,
      framework: int(row.framework),
      open: int(row.open),
      withoutOpenCompetition: direct + limited,
      shareWithoutOpen: awards > 0 ? (direct + limited) / awards : 0,
      suppliers: int(row.suppliers),
      ownAwards: int(row.own_awards),
      lastAwardAt: iso(row.last_award_at),
      sameRegion: region !== null && specific.includes(region),
    };
  });
  if (options.region) items = items.filter((item) => item.region === options.region);
  // Nearby buyers first, then by how much they award in the trade.
  items.sort((a, b) => Number(b.sameRegion) - Number(a.sameRegion) || b.awards - a.awards || (b.totalValue ?? 0) - (a.totalValue ?? 0) || a.name.localeCompare(b.name));
  const offset = options.offset ?? 0;
  return { items: items.slice(offset, offset + (options.limit ?? 25)), total: items.length };
}

/**
 * Buyers ranked by contracts awarded in the supplier's CPV groups in the last 24 months,
 * with the share awarded without open competition.
 */
export async function getBuyersForSupplier(supplierId: string, options: BuyerOptions = {}): Promise<{ items: BuyerInsight[]; total: number }> {
  const spec = await getSupplierSpec(supplierId);
  if (!spec) return { items: [], total: 0 };
  return getBuyersForSpec(spec, options);
}

// ---------------------------------------------------------------------------
// Buyer page
// ---------------------------------------------------------------------------

export type BuyerRecord = {
  id: string;
  slug: string;
  name: string;
  buyerType: string | null;
  devolved: string | null;
  region: string | null;
  locality: string | null;
  website: string | null;
  noticesCount: number;
  awardsCount: number;
  awardsValue: number;
  lastNoticeAt: string | null;
  mergedIntoSlug: string | null;
};

export async function getBuyerBySlug(slug: string): Promise<BuyerRecord | null> {
  const [row] = await queryRows<Record<string, unknown>>(
    db,
    sql`
      select b.id, b.slug, b.name, b.buyer_type, b.devolved, b.region, b.locality, b.website, b.notices_count, b.awards_count, b.awards_value, b.last_notice_at,
             (select m.slug from buyers m where m.id = b.merged_into) as merged_into_slug
      from buyers b where b.slug = ${slug.slice(0, 200)}
    `,
  );
  if (!row) return null;
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    buyerType: str(row.buyer_type),
    devolved: str(row.devolved),
    region: str(row.region),
    locality: str(row.locality),
    website: str(row.website),
    noticesCount: int(row.notices_count),
    awardsCount: int(row.awards_count),
    awardsValue: num(row.awards_value) ?? 0,
    lastNoticeAt: iso(row.last_notice_at),
    mergedIntoSlug: str(row.merged_into_slug),
  };
}

export type BuyerCompetitionMix = { awards: number; direct: number; limited: number; framework: number; open: number; unknown: number; belowThreshold: number };

/** How a buyer has awarded its contracts in the last `months`. */
export async function getBuyerCompetitionMix(buyerId: string, months = 24, now: Date = new Date()): Promise<BuyerCompetitionMix> {
  const [row] = await queryRows<Record<string, unknown>>(
    db,
    sql`
      with k as (
        select a.ocid, a.supplier_id, min(a.competition) as competition, bool_or(a.above_threshold) as above
        from awards a
        where a.buyer_id = ${buyerId} and a.is_current and a.effective_status in ${WON_STATUSES_SQL}
          and ${AWARD_DATE_SQL} >= ${now.toISOString()}::timestamptz - make_interval(months => ${months}::int)
        group by a.ocid, a.supplier_id
      )
      select count(*) as awards,
             count(*) filter (where competition = 'direct') as direct,
             count(*) filter (where competition = 'limited') as limited,
             count(*) filter (where competition = 'framework') as framework,
             count(*) filter (where competition = 'open') as open,
             count(*) filter (where competition = 'unknown') as unknown,
             count(*) filter (where above = false) as below_threshold
      from k
    `,
  );
  return {
    awards: int(row?.awards),
    direct: int(row?.direct),
    limited: int(row?.limited),
    framework: int(row?.framework),
    open: int(row?.open),
    unknown: int(row?.unknown),
    belowThreshold: int(row?.below_threshold),
  };
}

/** Slugs for the sitemap. */
export async function listBuyerSlugs(limit: number, offset: number): Promise<Array<{ slug: string; lastNoticeAt: string | null }>> {
  const rows = await queryRows<Record<string, unknown>>(
    db,
    sql`select slug, last_notice_at from buyers where merged_into is null and notices_count > 0 order by last_notice_at desc nulls last, id limit ${limit} offset ${offset}`,
  );
  return rows.map((row) => ({ slug: String(row.slug), lastNoticeAt: iso(row.last_notice_at) }));
}

export async function countBuyers(): Promise<number> {
  const [row] = await queryRows<{ n: unknown }>(db, sql`select count(*) as n from buyers where merged_into is null and notices_count > 0`);
  return int(row?.n);
}
