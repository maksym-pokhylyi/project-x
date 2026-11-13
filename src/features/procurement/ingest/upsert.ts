import { sql } from "drizzle-orm";
import {
  awards,
  buyers,
  cpvCodes,
  notices,
  procurementAliases,
  supplierContacts,
  suppliers,
} from "../../../db/schema/procurement";
import type { MappedBuyer, MappedRelease, MappedSupplier } from "../domain/map-release";
import { classifyLegalForm, slugifyName, stableId } from "../domain/normalize";
import { resolveEntities, type OrgRecord } from "./resolve";
import { bulkUpsert, chunk, iso, queryRows, str, textArrayParam, type SqlExecutor } from "./sql";

/**
 * upsertBatch: writes mapped releases.
 *
 *  - IDEMPOTENT: every row has a deterministic key; running a batch twice changes nothing.
 *  - ORDER-INDEPENDENT: organisation fields are taken from the newest release that
 *    mentions them (older releases only fill gaps); "latest notice" and "current award"
 *    flags are recomputed set-wise from everything stored for the touched procurements,
 *    so replaying old releases after new ones cannot roll state back. This is what lets
 *    the backfill walk backwards in time.
 *  - NO INTERACTIVE TRANSACTIONS: a sequence of single statements, each safe to repeat.
 *    A batch that dies half-way is repaired by running it again.
 *
 * Imports are relative (not "@/…") on purpose: scripts/seed-fts.ts runs this file outside Next.js.
 */

export type UpsertSummary = {
  releases: number;
  notices: number;
  awards: number;
  suppliersCreated: number;
  buyersCreated: number;
  merges: number;
  contacts: number;
  /** Suppliers whose awards or attributes may have changed: rebuild their profiles. */
  touchedSupplierIds: string[];
  touchedOcids: string[];
};

type Newest = { date: string; releaseId: string };
const newer = (a: Newest, b: Newest) => a.date > b.date || (a.date === b.date && a.releaseId >= b.releaseId);

async function loadAliases(db: SqlExecutor, kind: "supplier" | "buyer", keys: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (keys.length === 0) return out;
  for (const part of chunk(keys, 5000)) {
    // Aliases of the keys in the batch, plus every other alias of the entities they point to
    // (needed to know an entity's company number when deciding whether two rows may merge).
    const rows = await queryRows<{ alias_key: string; entity_id: string }>(
      db,
      sql`
        select a.alias_key, a.entity_id from procurement_aliases a
        where a.kind = ${kind} and a.entity_id in (
          select b.entity_id from procurement_aliases b where b.kind = ${kind} and b.alias_key = any(${textArrayParam(part)})
        )
      `,
    );
    for (const row of rows) out.set(row.alias_key, row.entity_id);
  }
  return out;
}

async function writeAliases(db: SqlExecutor, kind: "supplier" | "buyer", aliases: Map<string, string>): Promise<void> {
  const rows = [...aliases].map(([aliasKey, entityId]) => ({ kind, aliasKey, entityId }));
  await bulkUpsert(db, procurementAliases, rows, { columns: ["kind", "aliasKey", "entityId"], conflict: ["kind", "aliasKey"], update: ["entityId"] });
}

function slugFor(name: string, id: string, coh: string | null): string {
  const suffix = coh ? coh.toLowerCase() : id.replace(/^[a-z]+_/, "").slice(0, 8);
  return `${slugifyName(name, 60)}-${suffix}`;
}

export async function upsertBatch(db: SqlExecutor, input: readonly MappedRelease[]): Promise<UpsertSummary> {
  // The same release can arrive twice in one batch (overlapping harvest windows).
  const byNotice = new Map<string, MappedRelease>();
  for (const release of input) byNotice.set(release.notice.id, release);
  const releases = [...byNotice.values()];
  const summary: UpsertSummary = {
    releases: releases.length,
    notices: 0,
    awards: 0,
    suppliersCreated: 0,
    buyersCreated: 0,
    merges: 0,
    contacts: 0,
    touchedSupplierIds: [],
    touchedOcids: [],
  };
  if (releases.length === 0) return summary;

  // --- 1. identity resolution -----------------------------------------------------------------
  const supplierRecords: Array<OrgRecord & { supplier: MappedSupplier; newest: Newest }> = [];
  const buyerRecords: Array<OrgRecord & { buyer: MappedBuyer; newest: Newest }> = [];
  for (const release of releases) {
    const newest = { date: release.publishedAt, releaseId: release.releaseId };
    for (const supplier of release.suppliers) {
      supplierRecords.push({ ref: `${release.notice.id}|${supplier.partyId}`, keys: supplier.keys, supplier, newest });
    }
    if (release.buyer) buyerRecords.push({ ref: `${release.notice.id}|${release.buyer.partyId}`, keys: release.buyer.keys, buyer: release.buyer, newest });
  }

  const [supplierAliases, buyerAliases] = await Promise.all([
    loadAliases(db, "supplier", [...new Set(supplierRecords.flatMap((record) => record.keys))]),
    loadAliases(db, "buyer", [...new Set(buyerRecords.flatMap((record) => record.keys))]),
  ]);
  const supplierResolution = resolveEntities(supplierRecords, supplierAliases, { idPrefix: "sup", exclusiveScheme: "GB-COH" });
  const buyerResolution = resolveEntities(buyerRecords, buyerAliases, { idPrefix: "buy", exclusiveScheme: "GB-PPON" });
  summary.suppliersCreated = supplierResolution.created.size;
  summary.buyersCreated = buyerResolution.created.size;
  summary.merges = supplierResolution.merges.length + buyerResolution.merges.length;

  // --- 2. buyers ------------------------------------------------------------------------------
  const buyerIds = [...new Set(buyerResolution.entityOf.values())];
  const existingBuyers = new Map(
    (
      await Promise.all(
        chunk(buyerIds, 5000).map((part) =>
          queryRows<Record<string, unknown>>(db, sql`select id, ppon, source_date, source_release_id from buyers where id = any(${textArrayParam(part)})`),
        ),
      )
    )
      .flat()
      .map((row) => [String(row.id), row]),
  );
  const buyerRows = new Map<string, Record<string, unknown> & { newest: Newest; fresh: boolean }>();
  for (const record of buyerRecords) {
    const id = buyerResolution.entityOf.get(record.ref);
    if (!id) continue;
    const current = buyerRows.get(id);
    const buyer = record.buyer;
    const candidate = {
      id,
      key: buyerResolution.created.get(id) ?? buyer.keys[0]!,
      ppon: buyer.ppon ?? (current?.ppon as string | null | undefined) ?? null,
      name: buyer.name,
      nameNorm: buyer.nameNorm,
      slug: slugFor(buyer.name, id, null),
      buyerType: buyer.buyerType,
      devolved: buyer.devolved,
      regionCode: buyer.regionCode,
      region: buyer.topRegion,
      locality: buyer.locality,
      postcodeArea: buyer.postcodeArea,
      website: buyer.website,
      sourceDate: record.newest.date,
      sourceReleaseId: record.newest.releaseId,
      newest: record.newest,
      fresh: true,
    };
    if (!current || newer(record.newest, current.newest)) {
      // Keep facts the newer release omits.
      for (const field of ["buyerType", "devolved", "regionCode", "region", "locality", "postcodeArea", "website", "ppon"] as const) {
        if (candidate[field] === null && current && current[field] != null) (candidate as Record<string, unknown>)[field] = current[field];
      }
      buyerRows.set(id, candidate);
    } else {
      for (const field of ["buyerType", "devolved", "regionCode", "region", "locality", "postcodeArea", "website", "ppon"] as const) {
        if (current[field] == null && candidate[field] != null) current[field] = candidate[field];
      }
    }
  }
  await bulkUpsert(db, buyers, [...buyerRows.values()], {
    columns: ["id", "key", "ppon", "name", "nameNorm", "slug", "buyerType", "devolved", "regionCode", "region", "locality", "postcodeArea", "website", "sourceDate", "sourceReleaseId"],
    conflict: ["id"],
    update: [],
    // Newest release wins for descriptive fields; older releases only fill gaps. Slug and key never change.
    setRaw: [
      ...["name", "name_norm"].map((column) => `"${column}" = case when (excluded.source_date, excluded.source_release_id) >= (t.source_date, t.source_release_id) then excluded."${column}" else t."${column}" end`),
      ...["buyer_type", "devolved", "region_code", "region", "locality", "postcode_area", "website"].map(
        (column) =>
          `"${column}" = case when (excluded.source_date, excluded.source_release_id) >= (t.source_date, t.source_release_id) then coalesce(excluded."${column}", t."${column}") else coalesce(t."${column}", excluded."${column}") end`,
      ),
      `"ppon" = coalesce(t."ppon", excluded."ppon")`,
      `"source_release_id" = case when (excluded.source_date, excluded.source_release_id) >= (t.source_date, t.source_release_id) then excluded.source_release_id else t.source_release_id end`,
      `"source_date" = greatest(t.source_date, excluded.source_date)`,
      `"updated_at" = now()`,
    ],
  });
  void existingBuyers;
  await writeAliases(db, "buyer", buyerResolution.aliases);

  // --- 3. suppliers ---------------------------------------------------------------------------
  const supplierIds = [...new Set(supplierResolution.entityOf.values())];
  const existingSuppliers = new Map(
    (
      await Promise.all(
        chunk(supplierIds, 5000).map((part) =>
          queryRows<Record<string, unknown>>(
            db,
            sql`select id, coh, ppon, name, identity_basis, source_date, source_release_id from suppliers where id = any(${textArrayParam(part)})`,
          ),
        ),
      )
    )
      .flat()
      .map((row) => [String(row.id), row]),
  );
  // Register schemes known for each entity (from all its aliases), for legal-form classification.
  const schemesOf = new Map<string, Set<string>>();
  for (const [key, id] of supplierResolution.aliasView) {
    const scheme = key.slice(0, key.indexOf(":"));
    if (!schemesOf.has(id)) schemesOf.set(id, new Set());
    schemesOf.get(id)!.add(scheme);
  }
  type SupplierRow = Record<string, unknown> & { id: string; newest: Newest; name: string; coh: string | null; ppon: string | null };
  const supplierRows = new Map<string, SupplierRow>();
  const nullable = ["scale", "vcse", "country", "regionCode", "region", "locality", "postcodeArea", "website"] as const;
  for (const record of supplierRecords) {
    const id = supplierResolution.entityOf.get(record.ref);
    if (!id) continue;
    const supplier = record.supplier;
    const current = supplierRows.get(id);
    const candidate: SupplierRow = {
      id,
      key: supplierResolution.created.get(id) ?? supplier.keys[0]!,
      coh: supplier.coh,
      ppon: supplier.ppon,
      name: supplier.name,
      nameNorm: supplier.nameNorm,
      scale: supplier.scale,
      vcse: supplier.vcse,
      country: supplier.country,
      regionCode: supplier.regionCode,
      region: supplier.topRegion,
      locality: supplier.locality,
      postcodeArea: supplier.postcodeArea,
      website: supplier.website,
      sourceDate: record.newest.date,
      sourceReleaseId: record.newest.releaseId,
      newest: record.newest,
    };
    if (!current) {
      supplierRows.set(id, candidate);
    } else if (newer(record.newest, current.newest)) {
      for (const field of nullable) if (candidate[field] == null && current[field] != null) candidate[field] = current[field];
      candidate.coh = candidate.coh ?? current.coh;
      candidate.ppon = candidate.ppon ?? current.ppon;
      supplierRows.set(id, candidate);
    } else {
      for (const field of nullable) if (current[field] == null && candidate[field] != null) current[field] = candidate[field];
      current.coh = current.coh ?? candidate.coh;
      current.ppon = current.ppon ?? candidate.ppon;
    }
  }
  for (const row of supplierRows.values()) {
    const stored = existingSuppliers.get(row.id);
    // An entity keeps exactly one company number (see resolve.ts); stored values win over nulls.
    const coh = (stored ? str(stored.coh) : null) ?? row.coh;
    const ppon = (stored ? str(stored.ppon) : null) ?? row.ppon;
    const storedIsNewer =
      stored !== undefined && !newer(row.newest, { date: iso(stored.source_date) ?? "", releaseId: String(stored.source_release_id ?? "") });
    const effectiveName = storedIsNewer ? String(stored!.name) : row.name;
    const schemes = [...(schemesOf.get(row.id) ?? [])];
    const legal = classifyLegalForm({ coh, name: effectiveName, otherSchemes: schemes });
    row.coh = coh;
    row.ppon = ppon;
    row.identityBasis = coh ? "coh" : ppon ? "ppon" : schemes.some((scheme) => scheme !== "NAME" && scheme !== "GB-COH" && scheme !== "GB-PPON") ? "register" : "name";
    row.legalForm = legal.legalForm;
    row.isIncorporated = legal.isIncorporated;
    row.legalEvidence = legal.evidence;
    row.slug = slugFor(row.name, row.id, row.coh);
  }
  await bulkUpsert(db, suppliers, [...supplierRows.values()], {
    columns: [
      "id", "key", "identityBasis", "coh", "ppon", "name", "nameNorm", "slug", "scale", "vcse", "legalForm", "isIncorporated", "legalEvidence",
      "country", "regionCode", "region", "locality", "postcodeArea", "website", "sourceDate", "sourceReleaseId",
    ],
    conflict: ["id"],
    update: ["identityBasis", "legalForm", "isIncorporated", "legalEvidence"],
    setRaw: [
      ...["name", "name_norm"].map((column) => `"${column}" = case when (excluded.source_date, excluded.source_release_id) >= (t.source_date, t.source_release_id) then excluded."${column}" else t."${column}" end`),
      ...["scale", "vcse", "country", "region_code", "region", "locality", "postcode_area", "website"].map(
        (column) =>
          `"${column}" = case when (excluded.source_date, excluded.source_release_id) >= (t.source_date, t.source_release_id) then coalesce(excluded."${column}", t."${column}") else coalesce(t."${column}", excluded."${column}") end`,
      ),
      `"coh" = coalesce(t."coh", excluded."coh")`,
      `"ppon" = coalesce(t."ppon", excluded."ppon")`,
      `"source_release_id" = case when (excluded.source_date, excluded.source_release_id) >= (t.source_date, t.source_release_id) then excluded.source_release_id else t.source_release_id end`,
      `"source_date" = greatest(t.source_date, excluded.source_date)`,
      `"updated_at" = now()`,
    ],
  });
  await writeAliases(db, "supplier", supplierResolution.aliases);

  // --- 4. notices -----------------------------------------------------------------------------
  const noticeRows = releases.map((release) => {
    const buyerId = release.buyer ? (buyerResolution.entityOf.get(`${release.notice.id}|${release.buyer.partyId}`) ?? null) : null;
    return { ...release.notice, buyerId };
  });
  await bulkUpsert(db, notices, noticeRows, {
    columns: [
      "id", "releaseId", "ocid", "stage", "noticeType", "regime", "tags", "isUpdate", "title", "description", "status", "buyerId", "cpvMain", "cpvCodes",
      "cpvDivisions", "cpvGroups", "cpvClasses", "cpvText", "category", "valueAmount", "valueGross", "currency", "valuePlaceholder", "procedure",
      "procurementMethod", "competition", "aboveThreshold", "isFramework", "specialRegimes", "publishedAt", "deadlineAt", "enquiryDeadlineAt",
      "contractStart", "contractEnd", "futureNoticeAt", "engagementDeadlineAt", "regionCodes", "regions", "regionSource", "noticeUrl", "awardCriteria",
      "lots", "lotsCount", "smeSuitable", "vcseSuitable", "bidsCount", "suppliersCount", "effects",
    ],
    conflict: ["id"],
    chunkSize: 500,
  });
  summary.notices = noticeRows.length;

  // --- 5. awards ------------------------------------------------------------------------------
  const awardRows: Array<Record<string, unknown>> = [];
  for (const release of releases) {
    const buyerId = release.buyer ? (buyerResolution.entityOf.get(`${release.notice.id}|${release.buyer.partyId}`) ?? null) : null;
    for (const award of release.awards) {
      const supplierId = supplierResolution.entityOf.get(`${release.notice.id}|${award.supplierPartyId}`);
      if (!supplierId) continue;
      awardRows.push({ ...award, supplierId, buyerId, effectiveStatus: award.status });
    }
  }
  await bulkUpsert(db, awards, awardRows, {
    columns: [
      "id", "noticeId", "releaseId", "ocid", "awardRef", "contractRef", "lotKey", "lots", "supplierId", "supplierBasis", "buyerId", "title", "cpvMain", "cpvCodes",
      "cpvDivisions", "cpvGroups", "cpvClasses", "category", "valueAmount", "valueGross", "currency", "valueShared", "suppliersCount", "status",
      "effectiveStatus", "awardedAt", "signedAt", "contractStart", "contractEnd", "maxExtentEnd", "hasRenewal", "procedure", "competition",
      "aboveThreshold", "isFramework", "noticeType", "publishedAt", "regionCodes", "regions",
    ],
    conflict: ["id"],
    // effective_status is owned by the recompute step below once the row exists.
    update: [
      "noticeId", "releaseId", "ocid", "awardRef", "contractRef", "lotKey", "lots", "supplierId", "supplierBasis", "buyerId", "title", "cpvMain", "cpvCodes", "cpvDivisions",
      "cpvGroups", "cpvClasses", "category", "valueAmount", "valueGross", "currency", "valueShared", "suppliersCount", "status", "awardedAt", "signedAt",
      "contractStart", "contractEnd", "maxExtentEnd", "hasRenewal", "procedure", "competition", "aboveThreshold", "isFramework", "noticeType",
      "publishedAt", "regionCodes", "regions",
    ],
    chunkSize: 1000,
  });
  summary.awards = awardRows.length;
  // Awards a previous mapper version produced for these notices and the current one does not.
  const noticeIds = noticeRows.map((row) => row.id);
  const awardIds = awardRows.map((row) => String(row.id));
  await db.execute(sql`delete from awards where notice_id = any(${textArrayParam(noticeIds)}) and id <> all(${textArrayParam(awardIds)})`);

  // --- 6. contacts (internal) and CPV labels ------------------------------------------------
  const contactRows = new Map<string, Record<string, unknown>>();
  for (const release of releases) {
    for (const contact of release.contacts) {
      const supplierId = supplierResolution.entityOf.get(`${release.notice.id}|${contact.supplierPartyId}`);
      if (!supplierId) continue;
      const website = supplierRows.get(supplierId)?.website as string | null | undefined;
      const key = `${supplierId}|${contact.email}`;
      const current = contactRows.get(key);
      const firstSeenAt = current && String(current.firstSeenAt) < release.publishedAt ? current.firstSeenAt : release.publishedAt;
      const lastSeenAt = current && String(current.lastSeenAt) > release.publishedAt ? current.lastSeenAt : release.publishedAt;
      contactRows.set(key, {
        id: stableId("ct", key),
        supplierId,
        email: contact.email,
        emailDomain: contact.domain,
        kind: contact.kind,
        namePresent: contact.namePresent || Boolean(current?.namePresent),
        domainMatchesWebsite: website ? contact.domain === website || contact.domain.endsWith(`.${website}`) || website.endsWith(`.${contact.domain}`) : null,
        sourceReleaseId: release.releaseId,
        firstSeenAt,
        lastSeenAt,
      });
    }
  }
  await bulkUpsert(db, supplierContacts, [...contactRows.values()], {
    columns: ["id", "supplierId", "email", "emailDomain", "kind", "namePresent", "domainMatchesWebsite", "sourceReleaseId", "firstSeenAt", "lastSeenAt"],
    conflict: ["supplierId", "email"],
    update: ["kind", "emailDomain"],
    // first_ingested_at and the suppression fields are never touched by ingestion.
    setRaw: [
      `"name_present" = t.name_present or excluded.name_present`,
      `"domain_matches_website" = coalesce(excluded.domain_matches_website, t.domain_matches_website)`,
      `"first_seen_at" = least(t.first_seen_at, excluded.first_seen_at)`,
      `"last_seen_at" = greatest(t.last_seen_at, excluded.last_seen_at)`,
    ],
  });
  summary.contacts = contactRows.size;

  const labels = new Map<string, string>();
  for (const release of releases) for (const [code, label] of Object.entries(release.cpvLabels)) if (!labels.has(code)) labels.set(code, label);
  await bulkUpsert(db, cpvCodes, [...labels].map(([code, label]) => ({ code, label })), { columns: ["code", "label"], conflict: ["code"], update: [] });

  // --- 7. merges ------------------------------------------------------------------------------
  for (const merge of supplierResolution.merges) await mergeSuppliers(db, merge.from, merge.into);
  for (const merge of buyerResolution.merges) await mergeBuyers(db, merge.from, merge.into);

  // --- 8. recompute derived state for everything this batch touched ---------------------------
  const ocids = [...new Set(releases.map((release) => release.ocid))];
  summary.touchedOcids = ocids;
  for (const part of chunk(ocids, 2000)) await recomputeProcurements(db, part);

  const touchedSuppliers = new Set<string>(supplierIds);
  for (const merge of supplierResolution.merges) touchedSuppliers.add(merge.into);
  for (const part of chunk(ocids, 2000)) {
    const rows = await queryRows<{ supplier_id: string }>(db, sql`select distinct supplier_id from awards where ocid = any(${textArrayParam(part)})`);
    for (const row of rows) touchedSuppliers.add(row.supplier_id);
  }
  summary.touchedSupplierIds = [...touchedSuppliers];
  for (const part of chunk(summary.touchedSupplierIds, 2000)) await recomputeSupplierStats(db, part);

  const touchedBuyers = new Set<string>(buyerIds);
  for (const merge of buyerResolution.merges) touchedBuyers.add(merge.into);
  for (const part of chunk([...touchedBuyers], 2000)) await recomputeBuyerStats(db, part);

  return summary;
}

/** Folds supplier `from` into `into`. Every statement is safe to repeat. */
export async function mergeSuppliers(db: SqlExecutor, from: string, into: string): Promise<void> {
  if (from === into) return;
  await db.execute(sql`update procurement_aliases set entity_id = ${into} where kind = 'supplier' and entity_id = ${from}`);
  await db.execute(sql`update awards set supplier_id = ${into} where supplier_id = ${from}`);
  await db.execute(sql`
    update supplier_contacts c set supplier_id = ${into}
    where c.supplier_id = ${from} and not exists (select 1 from supplier_contacts d where d.supplier_id = ${into} and d.email = c.email)
  `);
  await db.execute(sql`delete from supplier_contacts where supplier_id = ${from}`);
  await db.execute(sql`
    update org_supplier_links l set supplier_id = ${into}
    where l.supplier_id = ${from} and not exists (select 1 from org_supplier_links m where m.supplier_id = ${into} and m.organization_id = l.organization_id)
  `);
  await db.execute(sql`delete from org_supplier_links where supplier_id = ${from}`);
  await db.execute(sql`delete from supplier_profiles where supplier_id = ${from}`);
  await db.execute(sql`
    update suppliers s set
      coh = coalesce(s.coh, f.coh), ppon = coalesce(s.ppon, f.ppon), removed_at = coalesce(s.removed_at, f.removed_at), updated_at = now()
    from suppliers f where s.id = ${into} and f.id = ${from}
  `);
  await db.execute(sql`update suppliers set merged_into = ${into}, awards_count = 0, total_value = 0, buyers_count = 0, updated_at = now() where id = ${from}`);
  // Rows merged into `from` earlier now point at the final row.
  await db.execute(sql`update suppliers set merged_into = ${into} where merged_into = ${from}`);
}

export async function mergeBuyers(db: SqlExecutor, from: string, into: string): Promise<void> {
  if (from === into) return;
  await db.execute(sql`update procurement_aliases set entity_id = ${into} where kind = 'buyer' and entity_id = ${from}`);
  await db.execute(sql`update notices set buyer_id = ${into} where buyer_id = ${from}`);
  await db.execute(sql`update awards set buyer_id = ${into} where buyer_id = ${from}`);
  await db.execute(sql`update buyers s set ppon = coalesce(s.ppon, f.ppon), updated_at = now() from buyers f where s.id = ${into} and f.id = ${from}`);
  await db.execute(sql`update buyers set merged_into = ${into}, notices_count = 0, awards_count = 0, awards_value = 0, updated_at = now() where id = ${from}`);
  await db.execute(sql`update buyers set merged_into = ${into} where merged_into = ${from}`);
}

/**
 * Derived flags for a set of procurements, computed from ALL stored rows of those ocids:
 *  - notices.is_latest: newest notice per (ocid, stage);
 *  - awards.is_current: newest version per (ocid, supplier, lots);
 *  - awards.effective_status: published status, overridden by later termination (UK11) or
 *    procurement-termination (UK12) notices of the same ocid.
 */
export async function recomputeProcurements(db: SqlExecutor, ocids: string[]): Promise<void> {
  if (ocids.length === 0) return;
  const list = textArrayParam(ocids);
  await db.execute(sql`
    with ranked as (
      select id, row_number() over (partition by ocid, stage order by published_at desc, release_id desc) as rn
      from notices where ocid = any(${list})
    )
    update notices n set is_latest = (r.rn = 1) from ranked r where n.id = r.id and n.is_latest is distinct from (r.rn = 1)
  `);
  // An award row is superseded by any LATER notice of the same procurement that names the same
  // supplier for the same lots, or for a set of lots that includes one of them: a contract
  // details notice (UK7) often rolls several per-lot awards (UK6) into one contract.
  await db.execute(sql`
    with flagged as (
      select a.id, not exists (
        select 1 from awards b
        where b.ocid = a.ocid and b.supplier_id = a.supplier_id and b.id <> a.id
          and (b.published_at, b.release_id) > (a.published_at, a.release_id)
          and (b.lot_key = a.lot_key or b.lots && a.lots)
      ) as current
      from awards a where a.ocid = any(${list})
    )
    update awards a set is_current = f.current from flagged f where a.id = f.id and a.is_current is distinct from f.current
  `);
  await db.execute(sql`
    with groups as (
      select ocid, count(*) as n from (select distinct ocid, supplier_id, lot_key from awards where ocid = any(${list})) g group by ocid
    ),
    resolved as (
      select a.id,
        case
          when a.status in ('cancelled', 'unsuccessful', 'terminated') then a.status
          when term.ended_at is not null then 'terminated'
          when canc.hit then 'cancelled'
          else a.status
        end as status,
        term.ended_at
      from awards a
      left join groups g on g.ocid = a.ocid
      left join lateral (
        select coalesce((n.effects->>'terminatedAt')::timestamptz, n.published_at) as ended_at
        from notices n
        where n.ocid = a.ocid and n.notice_type = 'UK11' and n.published_at >= a.published_at
          and (
            jsonb_exists(n.effects->'terminatedRefs', a.award_ref)
            or (a.contract_ref is not null and jsonb_exists(n.effects->'terminatedRefs', a.contract_ref))
            or coalesce(g.n, 1) <= 1
          )
        order by n.published_at desc limit 1
      ) term on true
      left join lateral (
        select true as hit
        from notices n
        where n.ocid = a.ocid and n.notice_type = 'UK12' and n.published_at >= a.published_at
          and (n.effects->>'cancelledLots' = 'all' or (jsonb_typeof(n.effects->'cancelledLots') = 'array' and jsonb_exists_any(n.effects->'cancelledLots', a.lots)))
        limit 1
      ) canc on true
      where a.ocid = any(${list})
    )
    update awards a set effective_status = r.status, ended_early_at = r.ended_at
    from resolved r
    where a.id = r.id and (a.effective_status is distinct from r.status or a.ended_early_at is distinct from r.ended_at)
  `);
}

/** Awards that count as wins: everything published except cancelled / unsuccessful ones. */
export const WON_STATUSES_SQL = sql`('pending', 'active', 'terminated')`;

/**
 * SQL for "contracts": current, counted award rows rolled up per procurement (ocid), so a
 * framework awarded in twenty lots is one contract, not twenty. The value is attributed to
 * the supplier only when it is theirs alone: never for shared awards or framework ceilings,
 * and a figure repeated on every lot is counted once.
 * Expects `a` to be the awards alias; group by a.ocid (plus whatever else the caller needs).
 */
export const CONTRACT_VALUE_SQL = sql`
  case
    when bool_or(a.value_shared or a.is_framework or coalesce(a.currency, 'GBP') <> 'GBP') then null
    when count(distinct a.value_amount) = 1 then max(a.value_amount)
    else sum(a.value_amount)
  end`;
export const AWARD_DATE_SQL = sql`least(coalesce(a.awarded_at, a.published_at), a.published_at)`;

export async function recomputeSupplierStats(db: SqlExecutor, supplierIds: string[]): Promise<void> {
  if (supplierIds.length === 0) return;
  await db.execute(sql`
    update suppliers s set
      awards_count = coalesce(x.n, 0),
      total_value = coalesce(x.total, 0),
      buyers_count = coalesce(x.buyers, 0),
      first_award_at = x.first_at,
      last_award_at = x.last_at
    from (
      select ids.id, agg.n, agg.total, agg.buyers, agg.first_at, agg.last_at
      from unnest(${textArrayParam(supplierIds)}) as ids(id)
      left join lateral (
        select count(*) as n, sum(c.value) filter (where c.value < 1000000000) as total, count(distinct c.buyer_id) as buyers,
               min(c.first_at) as first_at, max(c.last_at) as last_at
        from (
          select a.ocid, max(a.buyer_id) as buyer_id, ${CONTRACT_VALUE_SQL} as value, min(${AWARD_DATE_SQL}) as first_at, max(${AWARD_DATE_SQL}) as last_at
          from awards a
          where a.supplier_id = ids.id and a.is_current and a.effective_status in ${WON_STATUSES_SQL}
          group by a.ocid
        ) c
      ) agg on true
    ) x
    where s.id = x.id and s.merged_into is null
      and (s.awards_count, s.total_value, s.buyers_count, s.first_award_at, s.last_award_at)
          is distinct from (coalesce(x.n, 0)::int, coalesce(x.total, 0)::numeric(18,2), coalesce(x.buyers, 0)::int, x.first_at, x.last_at)
  `);
}

export async function recomputeBuyerStats(db: SqlExecutor, buyerIds: string[]): Promise<void> {
  if (buyerIds.length === 0) return;
  await db.execute(sql`
    update buyers b set
      notices_count = coalesce(x.notices, 0),
      last_notice_at = x.last_at,
      awards_count = coalesce(x.awards, 0),
      awards_value = coalesce(x.total, 0)
    from (
      select ids.id, n.notices, n.last_at, c.awards, c.total
      from unnest(${textArrayParam(buyerIds)}) as ids(id)
      left join lateral (
        select count(distinct ocid) as notices, max(published_at) as last_at from notices where buyer_id = ids.id
      ) n on true
      left join lateral (
        select count(*) as awards, sum(k.value) filter (where k.value < 1000000000) as total
        from (
          select a.ocid, a.supplier_id, ${CONTRACT_VALUE_SQL} as value
          from awards a
          where a.buyer_id = ids.id and a.is_current and a.effective_status in ${WON_STATUSES_SQL}
          group by a.ocid, a.supplier_id
        ) k
      ) c on true
    ) x
    where b.id = x.id and b.merged_into is null
  `);
}
