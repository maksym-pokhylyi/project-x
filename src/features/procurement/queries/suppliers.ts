import "server-only";
import { sql } from "drizzle-orm";
import { tidyPlace } from "../domain/format";
import { normaliseCompanyNumber, normaliseName } from "../domain/normalize";
import { db, int, iso, num, PUBLIC_SUPPLIER_SQL, queryRows, str, strArray } from "./shared";

/**
 * Suppliers: lookup, search and the public profile record.
 *
 * COMPANY-LEVEL DATA ONLY. Nothing in this module reads supplier_contacts, and no DTO here
 * has a field for a contact name, e-mail address or telephone number.
 */
export type SupplierHit = {
  id: string;
  slug: string;
  name: string;
  /** Companies House number, when published. */
  companyNumber: string | null;
  locality: string | null;
  region: string | null;
  awardsCount: number;
  totalValue: number;
  lastAwardAt: string | null;
  /** Has a public page (identified, incorporated, not removed). */
  isPublic: boolean;
};

function toHit(row: Record<string, unknown>): SupplierHit {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    companyNumber: str(row.coh),
    locality: tidyPlace(str(row.locality)),
    region: str(row.region),
    awardsCount: int(row.awards_count),
    totalValue: num(row.total_value) ?? 0,
    lastAwardAt: iso(row.last_award_at),
    isPublic: row.is_public === true,
  };
}

export type SearchOptions = {
  limit?: number;
  /** Include suppliers without a public page (used inside the app, where the user looks for their own company). */
  includeUnpublished?: boolean;
};

/**
 * Finds suppliers by name (trigram similarity, tolerant of typos and partial names) or by
 * Companies House number. Queries shorter than two characters return nothing.
 */
export async function searchSuppliers(query: string, options: SearchOptions = {}): Promise<SupplierHit[]> {
  const raw = query.trim().slice(0, 120);
  if (raw.length < 2) return [];
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const visibility = options.includeUnpublished ? sql`s.merged_into is null and s.removed_at is null` : PUBLIC_SUPPLIER_SQL;
  const columns = sql`s.id, s.slug, s.name, s.coh, s.locality, s.region, s.awards_count, s.total_value, s.last_award_at, ${PUBLIC_SUPPLIER_SQL} as is_public`;

  // A company number: 6–8 digits, or a two-letter prefix and digits ("SC123456", "OC300001").
  const compact = raw.replace(/\s+/g, "");
  if (/^(\d{6,8}|[A-Za-z]{2}\d{4,6}R?)$/.test(compact)) {
    const number = normaliseCompanyNumber(compact);
    if (number) {
      const rows = await queryRows<Record<string, unknown>>(db, sql`select ${columns} from suppliers s where s.coh = ${number} and ${visibility} order by s.awards_count desc limit ${limit}`);
      if (rows.length > 0) return rows.map(toHit);
    }
  }

  const norm = normaliseName(raw);
  if (norm.length < 2) return [];
  const pattern = `%${norm.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await queryRows<Record<string, unknown>>(
    db,
    sql`
      select ${columns}, word_similarity(${norm}, s.name_norm) as sim
      from suppliers s
      where (s.name_norm like ${pattern} or ${norm} <% s.name_norm) and ${visibility}
      order by (s.name_norm = ${norm}) desc, (s.name_norm like ${`${norm.replace(/[\\%_]/g, "\\$&")}%`}) desc, word_similarity(${norm}, s.name_norm) desc, s.awards_count desc, s.name asc
      limit ${limit}
    `,
  );
  return rows.map(toHit);
}

export type TopCpv = Array<{ code: string; label: string | null; weight: number }>;

export type SupplierRecord = {
  id: string;
  slug: string;
  name: string;
  companyNumber: string | null;
  legalForm: string;
  scale: string | null;
  locality: string | null;
  region: string | null;
  postcodeArea: string | null;
  awardsCount: number;
  totalValue: number;
  buyersCount: number;
  firstAwardAt: string | null;
  lastAwardAt: string | null;
  /** Notices on Find a Tender that name this supplier (every version counts: each one is a published notice). */
  noticesCount: number;
  isPublic: boolean;
  /** Slug of the supplier this record was merged into (the page redirects there). */
  mergedIntoSlug: string | null;
  profile: {
    summary: string | null;
    keywords: string[];
    regions: string[];
    topCpv: TopCpv;
    cpvDivisions: string[];
    valueLow: number | null;
    valueMedian: number | null;
    valueHigh: number | null;
  } | null;
};

function toRecord(row: Record<string, unknown>): SupplierRecord {
  const hasProfile = row.profile_supplier_id !== null && row.profile_supplier_id !== undefined;
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    companyNumber: str(row.coh),
    legalForm: String(row.legal_form ?? "unknown"),
    scale: str(row.scale),
    locality: tidyPlace(str(row.locality)),
    region: str(row.region),
    postcodeArea: str(row.postcode_area),
    awardsCount: int(row.awards_count),
    totalValue: num(row.total_value) ?? 0,
    buyersCount: int(row.buyers_count),
    firstAwardAt: iso(row.first_award_at),
    lastAwardAt: iso(row.last_award_at),
    noticesCount: int(row.notices_count),
    isPublic: row.is_public === true,
    mergedIntoSlug: str(row.merged_into_slug),
    profile: hasProfile
      ? {
          summary: str(row.summary),
          keywords: strArray(row.keywords),
          regions: strArray(row.profile_regions),
          topCpv: Array.isArray(row.top_cpv) ? (row.top_cpv as TopCpv) : [],
          cpvDivisions: strArray(row.cpv_divisions),
          valueLow: num(row.value_low),
          valueMedian: num(row.value_median),
          valueHigh: num(row.value_high),
        }
      : null,
  };
}

const RECORD_SELECT = sql`
  select s.id, s.slug, s.name, s.coh, s.legal_form, s.scale, s.locality, s.region, s.postcode_area, s.awards_count, s.total_value, s.buyers_count,
         s.first_award_at, s.last_award_at, ${PUBLIC_SUPPLIER_SQL} as is_public,
         (select m.slug from suppliers m where m.id = s.merged_into) as merged_into_slug,
         (select count(distinct a.release_id) from awards a where a.supplier_id = s.id) as notices_count,
         p.supplier_id as profile_supplier_id, p.summary, p.keywords, p.regions as profile_regions, p.top_cpv, p.cpv_divisions, p.value_low, p.value_median, p.value_high
  from suppliers s left join supplier_profiles p on p.supplier_id = s.id`;

/** Supplier by slug, including merged and unpublished ones (callers decide what to render). */
export async function getSupplierBySlug(slug: string): Promise<SupplierRecord | null> {
  const [row] = await queryRows<Record<string, unknown>>(db, sql`${RECORD_SELECT} where s.slug = ${slug.slice(0, 200)}`);
  return row ? toRecord(row) : null;
}

export async function getSupplierById(id: string): Promise<SupplierRecord | null> {
  const [row] = await queryRows<Record<string, unknown>>(db, sql`${RECORD_SELECT} where s.id = ${id}`);
  return row ? toRecord(row) : null;
}

/** Slugs for the sitemap, most recently awarded first. Only suppliers with a public page and at least one award. */
export async function listPublicSupplierSlugs(limit: number, offset: number): Promise<Array<{ slug: string; lastAwardAt: string | null }>> {
  const rows = await queryRows<Record<string, unknown>>(
    db,
    sql`select s.slug, s.last_award_at from suppliers s where ${PUBLIC_SUPPLIER_SQL} and s.awards_count > 0 order by s.last_award_at desc nulls last, s.id limit ${limit} offset ${offset}`,
  );
  return rows.map((row) => ({ slug: String(row.slug), lastAwardAt: iso(row.last_award_at) }));
}

export async function countPublicSuppliers(): Promise<number> {
  const [row] = await queryRows<{ n: unknown }>(db, sql`select count(*) as n from suppliers s where ${PUBLIC_SUPPLIER_SQL} and s.awards_count > 0`);
  return int(row?.n);
}
