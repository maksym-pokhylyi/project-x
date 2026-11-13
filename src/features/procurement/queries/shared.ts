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
  regionSource: string | null;
  publishedAt: string;
  deadlineAt: string | null;
  futureNoticeAt: string | null;
  engagementDeadlineAt: string | null;
  /** The notice on Find a Tender — always shown, never gated. */
  noticeUrl: string;
};

/** Columns for NoticeCard; expects aliases `n` (notices) and `b` (buyers, left-joined). */
export const NOTICE_CARD_COLUMNS = sql`
  n.ocid, n.id as notice_id, n.release_id, n.stage, n.notice_type, n.status, n.title, n.buyer_id, b.name as buyer_name, b.slug as buyer_slug,
  n.value_amount, n.currency, n.value_placeholder, n.above_threshold, n.is_framework, n.sme_suitable, n.cpv_main, n.cpv_codes,
  (select c.label from cpv_codes c where c.code = n.cpv_main) as cpv_label,
  n.regions, n.region_source, n.published_at, n.deadline_at, n.future_notice_at, n.engagement_deadline_at, n.notice_url`;

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
    regionSource: str(row.region_source),
    publishedAt: iso(row.published_at) ?? "",
    deadlineAt: iso(row.deadline_at),
    futureNoticeAt: iso(row.future_notice_at),
    engagementDeadlineAt: iso(row.engagement_deadline_at),
    noticeUrl: String(row.notice_url),
  };
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
  const levels = tradeLevels(spec.cpvWeights);
  const parts: SQL[] = [];
  if (levels.classes.length > 0) parts.push(sql`a.cpv_classes && ${textArrayParam(levels.classes)}`);
  if (levels.groups.length > 0) parts.push(sql`a.cpv_groups && ${textArrayParam(levels.groups)}`);
  if (levels.divisions.length > 0) parts.push(sql`a.cpv_divisions && ${textArrayParam(levels.divisions)}`);
  if (parts.length === 0) return null;
  return sql`(${sql.join(parts, sql` or `)})`;
}
