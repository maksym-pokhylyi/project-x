import { sql } from "drizzle-orm";
import { supplierProfiles } from "../../../db/schema/procurement";
import { buildSupplierProfile, type ProfileAward } from "../domain/profile";
import { bulkUpsert, chunk, iso, num, queryRows, str, textArrayParam, type SqlExecutor } from "../ingest/sql";
import { AWARD_DATE_SQL, CONTRACT_VALUE_SQL, WON_STATUSES_SQL } from "../ingest/upsert";

const splitList = (value: unknown): string[] => [...new Set(String(value ?? "").split(",").filter(Boolean))];

/**
 * Rebuilds `supplier_profiles` for the given suppliers from their current awards.
 * Called with the suppliers an ingestion batch touched, so the work is incremental.
 * Suppliers left without any counted award lose their profile row.
 * Returns the number of profiles written.
 */
export async function rebuildSupplierProfiles(db: SqlExecutor, supplierIds: readonly string[], now: Date = new Date()): Promise<number> {
  let written = 0;
  for (const ids of chunk([...new Set(supplierIds)], 400)) {
    const list = textArrayParam(ids);
    const [supplierRows, awardRows] = await Promise.all([
      queryRows<Record<string, unknown>>(db, sql`select id, name, region from suppliers where id = any(${list}) and merged_into is null`),
      queryRows<Record<string, unknown>>(
        db,
        // One input row per procurement (ocid): lots of one framework are one contract.
        sql`
          select a.supplier_id, a.ocid,
                 left(string_agg(distinct a.title, ' | '), 600) as title,
                 string_agg(array_to_string(a.cpv_codes, ','), ',' order by a.published_at desc, a.id) as cpv_codes,
                 string_agg(array_to_string(a.regions, ','), ',') as regions,
                 ${CONTRACT_VALUE_SQL} as value_amount,
                 min(a.competition) as competition,
                 max(${AWARD_DATE_SQL}) as award_date,
                 max(a.buyer_id) as buyer_id,
                 max(b.name) as buyer_name
          from awards a left join buyers b on b.id = a.buyer_id
          where a.supplier_id = any(${list}) and a.is_current and a.effective_status in ${WON_STATUSES_SQL}
          group by a.supplier_id, a.ocid
        `,
      ),
    ]);

    const awardsBySupplier = new Map<string, ProfileAward[]>();
    const codes = new Set<string>();
    for (const row of awardRows) {
      const award: ProfileAward = {
        title: String(row.title ?? ""),
        cpvCodes: splitList(row.cpv_codes),
        regions: splitList(row.regions),
        // Already attributable (shared values and framework ceilings arrive as null).
        valueAmount: num(row.value_amount),
        currency: "GBP",
        valueShared: false,
        isFramework: false,
        competition: String(row.competition ?? "unknown"),
        date: iso(row.award_date) ?? now.toISOString(),
        buyerId: str(row.buyer_id),
        buyerName: str(row.buyer_name),
      };
      for (const code of award.cpvCodes) codes.add(code);
      const key = String(row.supplier_id);
      if (!awardsBySupplier.has(key)) awardsBySupplier.set(key, []);
      awardsBySupplier.get(key)!.push(award);
    }

    const labels = new Map<string, string>();
    for (const part of chunk([...codes], 5000)) {
      const rows = await queryRows<{ code: string; label: string }>(db, sql`select code, label from cpv_codes where code = any(${textArrayParam(part)})`);
      for (const row of rows) labels.set(row.code, row.label);
    }

    const rows: Array<Record<string, unknown>> = [];
    const empty: string[] = [];
    for (const supplier of supplierRows) {
      const id = String(supplier.id);
      const own = awardsBySupplier.get(id) ?? [];
      if (own.length === 0) {
        empty.push(id);
        continue;
      }
      const profile = buildSupplierProfile({ name: String(supplier.name), region: str(supplier.region) }, own, labels, now);
      rows.push({ supplierId: id, ...profile, computedAt: now.toISOString() });
    }
    await bulkUpsert(db, supplierProfiles, rows, {
      columns: [
        "supplierId", "cpvWeights", "cpvDivisions", "cpvGroups", "topCpv", "keywords", "regions", "homeRegion", "valueLow", "valueMedian", "valueHigh",
        "awardsCount", "totalValue", "summary", "stats", "computedAt",
      ],
      conflict: ["supplierId"],
      chunkSize: 400,
    });
    if (empty.length > 0) await db.execute(sql`delete from supplier_profiles where supplier_id = any(${textArrayParam(empty)})`);
    written += rows.length;
  }
  return written;
}
