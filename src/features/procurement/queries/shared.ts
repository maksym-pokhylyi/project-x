import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { specFromManualProfile, tradeLevels, type RadarSpec } from "../domain/profile";
import { int, iso, num, queryRows, str, strArray, textArrayParam } from "../ingest/sql";

/**
 * Read-side building blocks shared by the query modules.
 *
 * DTOs carry dates as ISO strings and numbers as numbers, so they can cross the
 * server/client boundary and be cached as JSON without surprises.
 */
export { db, int, iso, num, queryRows, str, strArray, textArrayParam };

/** A supplier that may have a public page: an identified, incorporated body that has not asked to be removed. */
export const PUBLIC_SUPPLIER_SQL = sql`(s.merged_into is null and s.removed_at is null and s.identity_basis <> 'name' and s.is_incorporated)`;

/** Shown instead of the name of a supplier we do not publish (possible sole trader, name-only match). */
export const UNPUBLISHED_SUPPLIER_LABEL = "Supplier named in the notice";

export type NoticeCard = {
  ocid: string;
  noticeId: string;
  releaseId: string;
  stage: string;
  noticeType: string | null;
  status: string | null;
  title: string;
  buyerId: string | null;
  buyerName: string | null;
  buyerSlug: string | null;
  valueAmount: number | null;
  currency: string | null;
  valuePlaceholder: boolean;
  aboveThreshold: boolean | null;
  isFramework: boolean;
  smeSuitable: boolean | null;
  cpvMain: string | null;
  cpvLabel: string | null;
  cpvCodes: string[];
  regions: string[];
  /** Delivery places as published ("UKE42", "UK"); `regions` are their top-level regions. */
  regionCodes: string[];
  regionSource: string | null;
  publishedAt: string;
  deadlineAt: string | null;
  futureNoticeAt: string | null;
  engagementDeadlineAt: string | null;
  /** Planned contract period as stated in the notice; either end may be missing. */
  contractStart: string | null;
  contractEnd: string | null;
  lotsCount: number;
  /** The notice on Find a Tender — always shown, never gated. */
  noticeUrl: string;
};

/** Columns for NoticeCard; expects aliases `n` (notices) and `b` (buyers, left-joined). */
export const NOTICE_CARD_COLUMNS = sql`
  n.ocid, n.id as notice_id, n.release_id, n.stage, n.notice_type, n.status, n.title, n.buyer_id, b.name as buyer_name, b.slug as buyer_slug,
  n.value_amount, n.currency, n.value_placeholder, n.above_threshold, n.is_framework, n.sme_suitable, n.cpv_main, n.cpv_codes,
  (select c.label from cpv_codes c where c.code = n.cpv_main) as cpv_label,
  n.regions, n.region_codes, n.region_source, n.published_at, n.deadline_at, n.future_notice_at, n.engagement_deadline_at,
  n.contract_start, n.contract_end, n.lots_count, n.notice_url`;

export function toNoticeCard(row: Record<string, unknown>): NoticeCard {
  return {
    ocid: String(row.ocid),
    noticeId: String(row.notice_id),
    releaseId: String(row.release_id),
    stage: String(row.stage),
    noticeType: str(row.notice_type),
    status: str(row.status),
    title: String(row.title),
    buyerId: str(row.buyer_id),
    buyerName: str(row.buyer_name),
    buyerSlug: str(row.buyer_slug),
    valueAmount: num(row.value_amount),
    currency: str(row.currency),
    valuePlaceholder: row.value_placeholder === true,
    aboveThreshold: typeof row.above_threshold === "boolean" ? row.above_threshold : null,
    isFramework: row.is_framework === true,
    smeSuitable: typeof row.sme_suitable === "boolean" ? row.sme_suitable : null,
    cpvMain: str(row.cpv_main),
    cpvLabel: str(row.cpv_label),
    cpvCodes: strArray(row.cpv_codes),
    regions: strArray(row.regions),
    regionCodes: strArray(row.region_codes),
    regionSource: str(row.region_source),
    publishedAt: iso(row.published_at) ?? "",
    deadlineAt: iso(row.deadline_at),
    futureNoticeAt: iso(row.future_notice_at),
    engagementDeadlineAt: iso(row.engagement_deadline_at),
    contractStart: iso(row.contract_start),
    contractEnd: iso(row.contract_end),
    lotsCount: int(row.lots_count),
    noticeUrl: String(row.notice_url),
  };
}

/**
 * When the Find a Tender data was last brought up to date: the newest successful ingestion
 * (cron run, backfill or seed). Null when nothing has been ingested through a recorded run.
 * This is the date behind "updated 13 Nov 2026" in the meta line of a page.
 */
export async function getDataUpdatedAt(): Promise<string | null> {
  const [row] = await queryRows<{ updated_at: unknown }>(
    db,
    sql`
      select greatest(
        (select max(last_success_at) from ingest_state),
        (select max(finished_at) from ingest_runs where status in ('ok', 'partial'))
      ) as updated_at
    `,
  );
  return iso(row?.updated_at);
}

/** A live tender: newest tender-stage notice of its procurement, still open. Alias `n`. */
export function liveTenderCondition(now: Date): SQL {
  return sql`n.stage = 'tender' and n.is_latest and n.notice_type is distinct from 'UK12' and coalesce(n.status, 'active') = 'active' and n.deadline_at > ${now.toISOString()}::timestamptz`;
}

// ---------------------------------------------------------------------------
// Radar specs
// ---------------------------------------------------------------------------

function asWeights(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (value && typeof value === "object") {
    for (const [key, weight] of Object.entries(value as Record<string, unknown>)) {
      const parsed = num(weight);
      if (parsed !== null && /^\d{2,8}$/.test(key)) out[key] = parsed;
    }
  }
  return out;
}

/** What to match against for a supplier with published awards; null when it has no profile. */
export async function getSupplierSpec(supplierId: string): Promise<RadarSpec | null> {
  const [row] = await queryRows<Record<string, unknown>>(
    db,
    sql`
      select s.id, s.name, p.cpv_weights, p.cpv_divisions, p.cpv_groups, p.keywords, p.regions, p.value_low, p.value_high, p.awards_count
      from suppliers s join supplier_profiles p on p.supplier_id = s.id
      where s.id = ${supplierId} and s.merged_into is null
    `,
  );
  if (!row) return null;
  const cpvWeights = asWeights(row.cpv_weights);
  // One or two awards say little about the size of work a firm can take on: widen the band.
  const few = int(row.awards_count) < 3;
  const low = num(row.value_low);
  const high = num(row.value_high);
  return {
    key: `s:${String(row.id)}`,
    supplierId: String(row.id),
    label: String(row.name),
    cpvWeights,
    cpvDivisions: Object.keys(cpvWeights).filter((prefix) => prefix.length === 2),
    cpvGroups: strArray(row.cpv_groups),
    keywords: strArray(row.keywords),
    regions: strArray(row.regions),
    valueLow: low !== null && few ? low / 3 : low,
    valueHigh: high !== null && few ? high * 4 : high,
    trades: tradeLevels(cpvWeights),
    chosen: [],
  };
}

export type ManualProfileRow = {
  id: string;
  name: string;
  cpvCodes: string[];
  keywords: string[];
  regions: string[];
  valueMin: number | null;
  valueMax: number | null;
};

export function specForManualProfile(profile: ManualProfileRow): RadarSpec {
  return specFromManualProfile(profile);
}

/** code -> official label for a set of codes. */
export async function getCpvLabels(codes: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const list = [...new Set(codes)].filter(Boolean);
  if (list.length === 0) return out;
  const rows = await queryRows<{ code: string; label: string }>(db, sql`select code, label from cpv_codes where code = any(${textArrayParam(list)})`);
  for (const row of rows) out.set(row.code, row.label);
  return out;
}

/**
 * "Same trade" condition on award rows (alias `a`), as specific as the profile's own CPV
 * coding: classes where it has them, else groups, else divisions. Null when the profile
 * has no CPV at all.
 */
export function awardTradeCondition(spec: RadarSpec): SQL | null {
  const levels = spec.trades ?? tradeLevels(spec.cpvWeights);
  // Trades the owner picked by hand count at the depth they picked (a deeper code by its class).
  const chosen = spec.chosen ?? [];
  const classes = [...new Set([...levels.classes, ...chosen.filter((stem) => stem.length >= 4).map((stem) => stem.slice(0, 4))])];
  const groups = [...new Set([...levels.groups, ...chosen.filter((stem) => stem.length === 3)])];
  const divisions = [...new Set([...levels.divisions, ...chosen.filter((stem) => stem.length === 2)])];
  const parts: SQL[] = [];
  if (classes.length > 0) parts.push(sql`a.cpv_classes && ${textArrayParam(classes)}`);
  if (groups.length > 0) parts.push(sql`a.cpv_groups && ${textArrayParam(groups)}`);
  if (divisions.length > 0) parts.push(sql`a.cpv_divisions && ${textArrayParam(divisions)}`);
  if (parts.length === 0) return null;
  return sql`(${sql.join(parts, sql` or `)})`;
}
