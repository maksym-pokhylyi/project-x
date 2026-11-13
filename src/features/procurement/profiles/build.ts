import { sql } from "drizzle-orm";
import { supplierProfiles } from "../../../db/schema/procurement";
import { buildSupplierProfile, type ProfileAward } from "../domain/profile";
import { bulkUpsert, chunk, iso, num, queryRows, str, strArray, textArrayParam, type SqlExecutor } from "../ingest/sql";
import { WON_STATUSES_SQL } from "../ingest/upsert";

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
        sql`
          select a.supplier_id, a.title, a.cpv_codes, a.regions, a.value_amount, a.currency, a.value_shared, a.is_framework, a.competition,
                 least(coalesce(a.awarded_at, a.published_at), a.published_at) as award_date, a.buyer_id, b.name as buyer_name
          from awards a left join buyers b on b.id = a.buyer_id
          where a.supplier_id = any(${list}) and a.is_current and a.effective_status in ${WON_STATUSES_SQL}
        `,
      ),
    ]);

    const awardsBySupplier = new Map<string, ProfileAward[]>();
    const codes = new Set<string>();
    for (const row of awardRows) {
      const award: ProfileAward = {
        title: String(row.title ?? ""),
        cpvCodes: strArray(row.cpv_codes),
        regions: strArray(row.regions),
        valueAmount: num(row.value_amount),
        currency: str(row.currency),
        valueShared: row.value_shared === true,
        isFramework: row.is_framework === true,
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
