import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { scoreCpv, type RadarSpec } from "../domain/profile";
import { NATIONWIDE } from "../domain/regions";
import { AWARD_DATE_SQL, CONTRACT_VALUE_SQL, WON_STATUSES_SQL } from "../ingest/upsert";
import { awardTradeCondition, db, getSupplierSpec, int, iso, num, queryRows, str, UNPUBLISHED_SUPPLIER_LABEL } from "./shared";

/**
 * Contracts: current award rows rolled up per procurement and supplier. A framework
 * awarded in twenty lots is one row here, with `lotsCount` = 20.
 */
export type ContractRow = {
  ocid: string;
  title: string;
  lotsCount: number;
  supplierId: string;
  /** Null when the supplier is not one we publish (possible sole trader / name-only match). */
  supplierName: string | null;
  supplierSlug: string | null;
  supplierLabel: string;
  buyerId: string | null;
  buyerName: string | null;
  buyerSlug: string | null;
  /** Attributable to this supplier alone; null for shared awards, framework ceilings and unpublished values. */
  valueAmount: number | null;
  valueShared: boolean;
  isFramework: boolean;
  awardedAt: string | null;
  contractStart: string | null;
  /** End date stated in the notice. */
  contractEnd: string | null;
  /** Latest end if every extension is used, when the notice states one. */
  maxExtentEnd: string | null;
  competition: string;
  procedure: string | null;
  aboveThreshold: boolean | null;
  status: string;
  cpvCodes: string[];
  cpvMain: string | null;
  cpvLabel: string | null;
  regions: string[];
  noticeType: string | null;
  /** The source notice on Find a Tender. */
  noticeUrl: string;
  releaseId: string;
};

const splitList = (value: unknown): string[] => [...new Set(String(value ?? "").split(",").filter(Boolean))];

/** Aggregated contract columns; aliases: a (awards). Group by a.ocid, a.supplier_id. */
const CONTRACT_COLUMNS = sql`
  a.ocid, a.supplier_id,
  (array_agg(a.title order by a.published_at desc, a.id))[1] as title,
  count(*) as lots_count,
  max(a.buyer_id) as buyer_id,
  ${CONTRACT_VALUE_SQL} as value_amount,
  bool_or(a.value_shared) as value_shared,
  bool_or(a.is_framework) as is_framework,
  min(${AWARD_DATE_SQL}) as awarded_at,
  min(a.contract_start) as contract_start,
  max(a.contract_end) as contract_end,
  max(a.max_extent_end) as max_extent_end,
  min(a.competition) as competition,
  max(a.procedure) as procedure,
  bool_or(a.above_threshold) as above_threshold,
  case when bool_or(a.effective_status = 'active') then 'active' when bool_or(a.effective_status = 'pending') then 'pending' else max(a.effective_status) end as status,
  string_agg(array_to_string(a.cpv_codes, ','), ',' order by a.published_at desc, a.id) as cpv_codes,
  (array_agg(a.cpv_main order by a.published_at desc, a.id))[1] as cpv_main,
  string_agg(array_to_string(a.regions, ','), ',') as regions,
  (array_agg(a.notice_type order by a.published_at desc, a.id))[1] as notice_type,
  (array_agg(a.notice_id order by a.published_at desc, a.id))[1] as notice_id,
  (array_agg(a.release_id order by a.published_at desc, a.id))[1] as release_id`;

/** Wraps an aggregated contracts sub-select `k` with supplier, buyer and notice facts. */
function contractsSelect(inner: SQL, tail: SQL): SQL {
  return sql`
    select k.*, s.name as supplier_name, s.slug as supplier_slug,
           (s.merged_into is null and s.removed_at is null and s.identity_basis <> 'name' and s.is_incorporated) as supplier_public,
           b.name as buyer_name, b.slug as buyer_slug, n.notice_url,
           (select c.label from cpv_codes c where c.code = k.cpv_main) as cpv_label
    from (${inner}) k
    join suppliers s on s.id = k.supplier_id
    left join buyers b on b.id = k.buyer_id
    left join notices n on n.id = k.notice_id
    ${tail}
  `;
}

function toContractRow(row: Record<string, unknown>): ContractRow {
  const isPublic = row.supplier_public === true;
  return {
    ocid: String(row.ocid),
    title: String(row.title ?? ""),
    lotsCount: int(row.lots_count),
    supplierId: String(row.supplier_id),
    supplierName: isPublic ? str(row.supplier_name) : null,
    supplierSlug: isPublic ? str(row.supplier_slug) : null,
    supplierLabel: isPublic ? String(row.supplier_name) : UNPUBLISHED_SUPPLIER_LABEL,
    buyerId: str(row.buyer_id),
    buyerName: str(row.buyer_name),
    buyerSlug: str(row.buyer_slug),
    valueAmount: num(row.value_amount),
    valueShared: row.value_shared === true,
    isFramework: row.is_framework === true,
    awardedAt: iso(row.awarded_at),
    contractStart: iso(row.contract_start),
    contractEnd: iso(row.contract_end),
    maxExtentEnd: iso(row.max_extent_end),
    competition: String(row.competition ?? "unknown"),
    procedure: str(row.procedure),
    aboveThreshold: typeof row.above_threshold === "boolean" ? row.above_threshold : null,
    status: String(row.status ?? "active"),
    cpvCodes: splitList(row.cpv_codes),
    cpvMain: str(row.cpv_main),
    cpvLabel: str(row.cpv_label),
    regions: splitList(row.regions),
    noticeType: str(row.notice_type),
    noticeUrl: str(row.notice_url) ?? `https://www.find-tender.service.gov.uk/Notice/${encodeURIComponent(String(row.release_id))}`,
    releaseId: String(row.release_id),
  };
}

/** A supplier's own contracts, newest first (the awards table on its page). */
export async function getSupplierContracts(supplierId: string, options: { limit?: number; offset?: number } = {}): Promise<{ items: ContractRow[]; total: number }> {
  const inner = sql`
    select ${CONTRACT_COLUMNS}
    from awards a
    where a.supplier_id = ${supplierId} and a.is_current and a.effective_status in ${WON_STATUSES_SQL}
    group by a.ocid, a.supplier_id
  `;
  const [rows, [count]] = await Promise.all([
    queryRows<Record<string, unknown>>(db, contractsSelect(inner, sql`order by k.awarded_at desc nulls last, k.ocid limit ${options.limit ?? 50} offset ${options.offset ?? 0}`)),
    queryRows<{ n: unknown }>(
      db,
      sql`select count(distinct a.ocid) as n from awards a where a.supplier_id = ${supplierId} and a.is_current and a.effective_status in ${WON_STATUSES_SQL}`,
    ),
  ]);
  return { items: rows.map(toContractRow), total: int(count?.n) };
}

export type EndingSoonItem = ContractRow & {
  /** Months until the stated end date (rounded down). */
  monthsLeft: number;
  /** The contract was delivered in a region the profile works in. */
  sameRegion: boolean;
  /** How closely the contract's CPV codes match the profile's trade (0..1). */
  tradeScore: number;
};

export type EndingSoonOptions = { limit?: number; offset?: number; now?: Date; region?: string | null };

/**
 * Other suppliers' contracts in the same trade (CPV group) whose stated end date falls
 * within `months`. Same-region contracts first, then closest trade, then soonest end.
 * "Ending" is the end date stated in the notice — never a judgement about the incumbent.
 */
export async function getEndingSoonForSpec(spec: RadarSpec, months = 9, options: EndingSoonOptions = {}): Promise<{ items: EndingSoonItem[]; total: number }> {
  const trade = awardTradeCondition(spec);
  if (!trade) return { items: [], total: 0 };
  const now = options.now ?? new Date();
  const inner = sql`
    select ${CONTRACT_COLUMNS}
    from awards a
    where a.is_current and a.effective_status in ('active', 'pending')
      and a.contract_end > ${now.toISOString()}::timestamptz
      and a.contract_end <= ${now.toISOString()}::timestamptz + make_interval(months => ${months}::int)
      and ${trade}
      ${spec.supplierId ? sql`and a.supplier_id <> ${spec.supplierId}` : sql``}
    group by a.ocid, a.supplier_id
  `;
  const rows = await queryRows<Record<string, unknown>>(db, contractsSelect(inner, sql`order by k.contract_end asc limit 2000`));
  const specific = spec.regions.filter((region) => region !== NATIONWIDE);
  let items = rows.map((row): EndingSoonItem => {
    const contract = toContractRow(row);
    const end = Date.parse(contract.contractEnd ?? now.toISOString());
    return {
      ...contract,
      monthsLeft: Math.max(0, Math.floor((end - now.getTime()) / (30.4375 * 86_400_000))),
      sameRegion: contract.regions.some((region) => specific.includes(region)),
      tradeScore: scoreCpv(spec.cpvWeights, contract.cpvCodes).score,
    };
  });
  // Drop distant relatives (same division only, different line of work).
  items = items.filter((item) => item.tradeScore >= 0.3);
  if (options.region) items = items.filter((item) => item.regions.includes(options.region!) || item.regions.includes(NATIONWIDE));
  const rank = (item: EndingSoonItem) => item.tradeScore * (item.sameRegion ? 1 : item.regions.includes(NATIONWIDE) || item.regions.length === 0 ? 0.8 : 0.6);
  items.sort((a, b) => rank(b) - rank(a) || (a.contractEnd ?? "").localeCompare(b.contractEnd ?? "") || a.ocid.localeCompare(b.ocid));
  const offset = options.offset ?? 0;
  return { items: items.slice(offset, offset + (options.limit ?? 25)), total: items.length };
}

export async function getEndingSoon(supplierId: string, months = 9, options: EndingSoonOptions = {}): Promise<{ items: EndingSoonItem[]; total: number }> {
  const spec = await getSupplierSpec(supplierId);
  if (!spec) return { items: [], total: 0 };
  return getEndingSoonForSpec(spec, months, options);
}

/** The supplier's own contracts whose stated end date falls within `months`: up for renewal or re-tender. */
export async function getOwnRenewals(supplierId: string, months = 12, now: Date = new Date()): Promise<ContractRow[]> {
  const inner = sql`
    select ${CONTRACT_COLUMNS}
    from awards a
    where a.supplier_id = ${supplierId} and a.is_current and a.effective_status in ('active', 'pending')
      and a.contract_end > ${now.toISOString()}::timestamptz
      and a.contract_end <= ${now.toISOString()}::timestamptz + make_interval(months => ${months}::int)
    group by a.ocid, a.supplier_id
  `;
  const rows = await queryRows<Record<string, unknown>>(db, contractsSelect(inner, sql`order by k.contract_end asc limit 50`));
  return rows.map(toContractRow);
}

/** Contracts a buyer has awarded, newest first (buyer page). */
export async function getBuyerContracts(buyerId: string, options: { limit?: number; offset?: number } = {}): Promise<{ items: ContractRow[]; total: number }> {
  const inner = sql`
    select ${CONTRACT_COLUMNS}
    from awards a
    where a.buyer_id = ${buyerId} and a.is_current and a.effective_status in ${WON_STATUSES_SQL}
    group by a.ocid, a.supplier_id
  `;
  const [rows, [count]] = await Promise.all([
    queryRows<Record<string, unknown>>(db, contractsSelect(inner, sql`order by k.awarded_at desc nulls last, k.ocid, k.supplier_id limit ${options.limit ?? 25} offset ${options.offset ?? 0}`)),
    queryRows<{ n: unknown }>(
      db,
      sql`select count(*) as n from (select 1 from awards a where a.buyer_id = ${buyerId} and a.is_current and a.effective_status in ${WON_STATUSES_SQL} group by a.ocid, a.supplier_id) x`,
    ),
  ]);
  return { items: rows.map(toContractRow), total: int(count?.n) };
}
