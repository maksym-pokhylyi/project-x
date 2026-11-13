import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { specFromManualProfile } from "@/features/procurement/domain/profile";
import { getBuyerBySlug, getBuyerCompetitionMix, getBuyersForSupplier } from "@/features/procurement/queries/buyers";
import { getBuyerContracts, getEndingSoon, getOwnRenewals, getSupplierContracts } from "@/features/procurement/queries/contracts";
import { searchTrades } from "@/features/procurement/queries/cpv";
import { getBuyerNotices, getEarlySignals, getMatchesForSpec, getSupplierMatches } from "@/features/procurement/queries/matches";
import { getTender, resolveOcid } from "@/features/procurement/queries/notices";
import { UNPUBLISHED_SUPPLIER_LABEL } from "@/features/procurement/queries/shared";
import { countPublicSuppliers, getSupplierBySlug, listPublicSupplierSlugs, searchSuppliers } from "@/features/procurement/queries/suppliers";
import { sitemapChunkXml, sitemapIndexXml } from "@/features/procurement/sitemaps";
import { resetDatabase } from "../helpers/db";
import { contractRelease, ingest, NOW, planningRelease, tenderRelease } from "./helpers/factory";
import { resetProcurement } from "./helpers/schema";

/**
 * Query functions on a small, hand-built market, written through the real pipeline
 * (mapRelease -> upsertBatch -> profile builder).
 *
 *   Acme Grounds Ltd (Yorkshire) has two grounds-maintenance contracts: Leeds and York.
 *   Around it: rivals whose contracts end at various times, tenders that should and
 *   should not match, an early notice, an unrelated software trade.
 */
const LEEDS = { name: "Leeds City Council", ppon: "PLDS-1111-AAAA", region: "UKE42" };
const YORK = { name: "City of York Council", ppon: "PYRK-2222-BBBB", region: "UKE21" };
const BRISTOL = { name: "Bristol City Council", ppon: "PBRS-3333-CCCC", region: "UKK11" };
const KENT = { name: "Kent County Council", ppon: "PKNT-4444-DDDD", region: "UKJ4" };
const GROUNDS = ["77314000"];

const ACME = { name: "Acme Grounds Ltd", coh: "01111111", region: "UKE42", email: "tenders@acmegrounds.co.uk" };
const SLUG = "acme-grounds-ltd-01111111";

const T = {
  leeds: "ocds-h6vhtk-q00001",
  bristol: "ocds-h6vhtk-q00002",
  trees: "ocds-h6vhtk-q00003",
  closed: "ocds-h6vhtk-q00004",
  cancelled: "ocds-h6vhtk-q00005",
  software: "ocds-h6vhtk-q00006",
  updated: "ocds-h6vhtk-q00007",
  planning: "ocds-h6vhtk-q00008",
  planningThenTender: "ocds-h6vhtk-q00009",
};

let acmeId: string;

beforeAll(async () => {
  await resetDatabase();
  await resetProcurement();
  await ingest([
    // --- Acme's own history -----------------------------------------------------------------
    contractRelease({ ocid: "ocds-h6vhtk-a00001", title: "Grounds Maintenance Services", buyer: LEEDS, suppliers: [ACME], cpv: GROUNDS, value: 120_000, signedDaysAgo: 60, endsInDays: 300 }),
    contractRelease({ ocid: "ocds-h6vhtk-a00002", title: "Grounds Maintenance for Parks", buyer: YORK, suppliers: [ACME], cpv: GROUNDS, value: 80_000, signedDaysAgo: 200, endsInDays: 100 }),
    // --- other suppliers in the trade ---------------------------------------------------------
    contractRelease({
      ocid: "ocds-h6vhtk-r00001",
      title: "Cemetery Grounds Maintenance",
      buyer: LEEDS,
      suppliers: [{ name: "Rival Landscapes Ltd", coh: "02222222", region: "UKE42" }],
      cpv: GROUNDS,
      value: 90_000,
      signedDaysAgo: 240,
      endsInDays: 120,
      procedure: "Below threshold - without competition",
      method: "direct",
    }),
    contractRelease({
      ocid: "ocds-h6vhtk-r00002",
      title: "Estate Grounds Maintenance",
      buyer: BRISTOL,
      suppliers: [{ name: "Southern Gardens Ltd", coh: "03333333", region: "UKK11" }],
      cpv: GROUNDS,
      regions: ["UKK"],
      value: 70_000,
      signedDaysAgo: 300,
      endsInDays: 60,
      procedure: "Below threshold - limited competition",
      method: "limited",
    }),
    contractRelease({ ocid: "ocds-h6vhtk-r00003", title: "Verge Mowing", buyer: YORK, suppliers: [{ name: "Old Mowers Ltd", coh: "04444444" }], cpv: GROUNDS, signedDaysAgo: 400, endsInDays: -10 }),
    contractRelease({ ocid: "ocds-h6vhtk-r00004", title: "Parks Grounds Maintenance Long Term", buyer: YORK, suppliers: [{ name: "Far Future Ltd", coh: "05555555" }], cpv: GROUNDS, signedDaysAgo: 30, endsInDays: 500 }),
    // A sole trader: no identifier, no company suffix. In the data, never on a public page.
    contractRelease({ ocid: "ocds-h6vhtk-r00005", title: "Grass Cutting Rounds", buyer: LEEDS, suppliers: [{ name: "John Smith Gardening" }], cpv: GROUNDS, value: 15_000, signedDaysAgo: 100, endsInDays: 90 }),
    // An unrelated trade.
    contractRelease({ ocid: "ocds-h6vhtk-r00006", title: "Payroll System Support", buyer: KENT, suppliers: [{ name: "Code Smiths Ltd", coh: "06666666", region: "UKJ4" }], cpv: ["72212000"], regions: ["UKJ"], endsInDays: 80 }),
    // --- tenders ----------------------------------------------------------------------------
    tenderRelease({ ocid: T.leeds, title: "Grounds Maintenance and Grass Cutting 2027", buyer: LEEDS, cpv: GROUNDS, regions: ["UKE"], value: 150_000, deadlineInDays: 20, aboveThreshold: false }),
    tenderRelease({ ocid: T.bristol, title: "Parks Grounds Maintenance", buyer: BRISTOL, cpv: GROUNDS, regions: ["UKK"], value: 100_000, deadlineInDays: 10 }),
    tenderRelease({ ocid: T.trees, title: "Tree Surgery Framework", buyer: KENT, cpv: ["77340000"], regions: ["UKE"], value: 60_000, deadlineInDays: 15 }),
    tenderRelease({ ocid: T.closed, title: "Grounds Maintenance (closed yesterday)", buyer: LEEDS, cpv: GROUNDS, deadlineInDays: -1 }),
    tenderRelease({ ocid: T.cancelled, id: "910001-2026", title: "Grounds Maintenance (cancelled)", buyer: YORK, cpv: GROUNDS, deadlineInDays: 25, publishedDaysAgo: 9 }),
    tenderRelease({ ocid: T.cancelled, id: "910002-2026", title: "Grounds Maintenance (cancelled)", buyer: YORK, cpv: GROUNDS, deadlineInDays: 25, publishedDaysAgo: 2, tag: ["tenderCancellation"], noticeType: "UK12", status: "cancelled" }),
    tenderRelease({ ocid: T.software, title: "Payroll Software", buyer: KENT, cpv: ["48450000"], regions: ["UKE"], deadlineInDays: 12 }),
    tenderRelease({ ocid: T.updated, id: "920001-2026", title: "Sports Pitch Grounds Maintenance", buyer: YORK, cpv: GROUNDS, deadlineInDays: 8, publishedDaysAgo: 12 }),
    tenderRelease({ ocid: T.updated, id: "920002-2026", title: "Sports Pitch Grounds Maintenance (deadline extended)", buyer: YORK, cpv: GROUNDS, deadlineInDays: 30, publishedDaysAgo: 1, tag: ["tenderUpdate"] }),
    // --- early notices ----------------------------------------------------------------------
    planningRelease({ ocid: T.planning, title: "Grounds Maintenance Market Engagement", buyer: YORK, cpv: GROUNDS }),
    planningRelease({ ocid: T.planningThenTender, id: "930001-2026", title: "Highway Verges Grounds Maintenance", buyer: LEEDS, cpv: GROUNDS, publishedDaysAgo: 40 }),
    tenderRelease({ ocid: T.planningThenTender, id: "930002-2026", title: "Highway Verges Grounds Maintenance", buyer: LEEDS, cpv: GROUNDS, deadlineInDays: 40, value: 2_000_000, publishedDaysAgo: 3 }),
  ]);
  const [row] = await db.execute<{ id: string }>(sql`select id from suppliers where coh = '01111111'`);
  acmeId = row!.id;
});

describe("getSupplierMatches", () => {
  it("returns live tenders in the supplier's trade, best first, each with a reason", async () => {
    const { items, total } = await getSupplierMatches(acmeId, { now: NOW });
    const ocids = items.map((item) => item.ocid);
    expect(total).toBe(items.length);
    // Same trade, same region, same buyer, right size: first.
    expect(ocids[0]).toBe(T.leeds);
    expect(items[0]).toMatchObject({
      title: "Grounds Maintenance and Grass Cutting 2027",
      buyerName: "Leeds City Council",
      valueAmount: 150_000,
      aboveThreshold: false,
      reasonSource: "rule",
      reason: "From Leeds City Council, which awarded you a £120k contract in 2026",
      noticeUrl: expect.stringContaining("https://www.find-tender.service.gov.uk/Notice/"),
    });
    expect(items[0]!.breakdown).toMatchObject({ regionMatch: "local", cpvPrefix: "77314" });
    expect(items[0]!.score).toBeGreaterThan(0.8);
    expect(ocids).toEqual(expect.arrayContaining([T.bristol, T.updated, T.planningThenTender, T.trees]));
    // Closed yesterday, cancelled by a UK12, or another trade: never a match.
    for (const excluded of [T.closed, T.cancelled, T.software]) expect(ocids).not.toContain(excluded);
    // One row per procurement: the updated notice replaces the original.
    expect(items.filter((item) => item.ocid === T.updated)).toHaveLength(1);
    expect(items.find((item) => item.ocid === T.updated)!.title).toBe("Sports Pitch Grounds Maintenance (deadline extended)");
    // Same trade in a region the supplier has never worked in ranks below local work.
    const bristol = items.find((item) => item.ocid === T.bristol)!;
    expect(bristol.breakdown.regionMatch).toBe("elsewhere");
    expect(bristol.score).toBeLessThan(items.find((item) => item.ocid === T.updated)!.score);
    expect(bristol.reason).toBe("Same category as your £120k award from Leeds City Council");
    // A neighbouring category ranks below the supplier's own line of work.
    expect(items.find((item) => item.ocid === T.trees)!.score).toBeLessThan(items[0]!.score);
    // Scores are sorted.
    expect([...items].sort((a, b) => b.score - a.score).map((item) => item.ocid)).toEqual(ocids);
  });

  it("applies filters, paging and exclusions", async () => {
    const southWest = await getSupplierMatches(acmeId, { now: NOW, filters: { region: "UKK" } });
    expect(southWest.items.map((item) => item.ocid)).toEqual([T.bristol]);
    const belowThreshold = await getSupplierMatches(acmeId, { now: NOW, filters: { kind: "below_threshold" } });
    expect(belowThreshold.items.map((item) => item.ocid)).toEqual([T.leeds]);
    const large = await getSupplierMatches(acmeId, { now: NOW, filters: { valueMin: 1_000_000 } });
    expect(large.items.map((item) => item.ocid)).toEqual([T.planningThenTender]);
    const withoutLeeds = await getSupplierMatches(acmeId, { now: NOW, excludeOcids: [T.leeds] });
    expect(withoutLeeds.items.map((item) => item.ocid)).not.toContain(T.leeds);
    const page = await getSupplierMatches(acmeId, { now: NOW, limit: 2, offset: 1 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(5);
    expect((await getSupplierMatches("sup_does_not_exist", { now: NOW })).items).toEqual([]);
  });

  it("uses a cached model-written reason when there is one", async () => {
    await db.execute(sql`insert into match_reasons (profile_key, ocid, reason, model) values (${`s:${acmeId}`}, ${T.leeds}, 'Leeds is re-tendering grounds work like your current contract with them.', 'test/model')`);
    const { items } = await getSupplierMatches(acmeId, { now: NOW, limit: 1 });
    expect(items[0]).toMatchObject({ reasonSource: "ai", reason: "Leeds is re-tendering grounds work like your current contract with them." });
    await db.execute(sql`delete from match_reasons`);
  });

  it("matches a manually described radar the same way", async () => {
    const spec = specFromManualProfile({ id: "00000000-0000-4000-8000-000000000001", name: "New Start Gardens", cpvCodes: GROUNDS, keywords: ["sports pitch"], regions: ["UKK"], valueMin: 50_000, valueMax: 250_000 });
    const { items } = await getMatchesForSpec(spec, { now: NOW });
    // Its region is the South West: the Bristol tender comes first.
    expect(items[0]!.ocid).toBe(T.bristol);
    expect(items[0]!.reason).toBe("Matches your trade: label of 77314000");
    expect(items.find((item) => item.ocid === T.updated)!.reason).toBe('Matches your trade (label of 77314000) and mentions "sports pitch"');
    expect(items.map((item) => item.ocid)).not.toContain(T.software);
  });
});

describe("getEndingSoon and getOwnRenewals", () => {
  it("lists other suppliers' contracts in the trade that end within the window, nearby first", async () => {
    const { items, total } = await getEndingSoon(acmeId, 9, { now: NOW });
    expect(total).toBe(3);
    expect(items.map((item) => item.title)).toEqual(["Grass Cutting Rounds", "Cemetery Grounds Maintenance", "Estate Grounds Maintenance"]);
    expect(items.map((item) => item.sameRegion)).toEqual([true, true, false]);
    expect(items[1]).toMatchObject({ supplierName: "Rival Landscapes Ltd", supplierSlug: "rival-landscapes-ltd-02222222", buyerName: "Leeds City Council", valueAmount: 90_000, competition: "direct", monthsLeft: 3 });
    expect(items[1]!.contractEnd?.slice(0, 10)).toBe("2027-03-13");
    // A possible sole trader is never named, but the source notice is still linked.
    expect(items[0]).toMatchObject({ supplierName: null, supplierSlug: null, supplierLabel: UNPUBLISHED_SUPPLIER_LABEL });
    expect(items[0]!.noticeUrl).toContain("find-tender.service.gov.uk/Notice/");
    // Not its own contracts, nothing already ended, nothing beyond the window, nothing from another trade.
    for (const title of ["Grounds Maintenance for Parks", "Verge Mowing", "Parks Grounds Maintenance Long Term", "Payroll System Support"]) {
      expect(items.map((item) => item.title)).not.toContain(title);
    }
    expect((await getEndingSoon(acmeId, 3, { now: NOW })).items.map((item) => item.title)).toEqual(["Grass Cutting Rounds", "Estate Grounds Maintenance"]);
    expect((await getEndingSoon(acmeId, 9, { now: NOW, region: "UKK" })).items.map((item) => item.title)).toEqual(["Estate Grounds Maintenance"]);
  });

  it("lists the supplier's own contracts up for renewal separately", async () => {
    const renewals = await getOwnRenewals(acmeId, 12, NOW);
    expect(renewals.map((contract) => contract.title)).toEqual(["Grounds Maintenance for Parks", "Grounds Maintenance Services"]);
    expect((await getOwnRenewals(acmeId, 6, NOW)).map((contract) => contract.title)).toEqual(["Grounds Maintenance for Parks"]);
  });

  it("stops listing a contract once a termination notice is published for it", async () => {
    const before = await getEndingSoon(acmeId, 9, { now: NOW });
    expect(before.items.map((item) => item.title)).toContain("Estate Grounds Maintenance");
    await ingest([
      {
        id: "940001-2026",
        ocid: "ocds-h6vhtk-r00002",
        date: NOW.toISOString(),
        tag: ["contractTermination"],
        parties: [],
        tender: { title: "Estate Grounds Maintenance", legalBasis: { scheme: "UKPGA", id: "2023/54" } },
        contracts: [{ id: "1", awardID: "1", status: "terminated", implementation: { endDate: NOW.toISOString() }, documents: [{ id: "940001-2026", documentType: "contractTerminationNotice", noticeType: "UK11" }] }],
      },
    ]);
    const after = await getEndingSoon(acmeId, 9, { now: NOW });
    expect(after.items.map((item) => item.title)).toEqual(["Grass Cutting Rounds", "Cemetery Grounds Maintenance"]);
    // It remains part of the incumbent's history.
    const [southern] = await db.execute<{ awards_count: number }>(sql`select awards_count from suppliers where coh = '03333333'`);
    expect(southern!.awards_count).toBe(1);
  });
});

describe("getBuyersForSupplier", () => {
  it("ranks buyers by awards in the supplier's trade and shows how they award", async () => {
    const { items, total } = await getBuyersForSupplier(acmeId, { now: NOW });
    expect(total).toBe(3);
    // Nearby buyers first; among those, most awards, then most value. York and Leeds both awarded three.
    expect(items.map((item) => item.name)).toEqual(["City of York Council", "Leeds City Council", "Bristol City Council"]);
    // York: Acme's own contract, Far Future's and one that ended recently — all inside 24 months.
    expect(items[0]).toMatchObject({ awards: 3, withoutOpenCompetition: 0, ownAwards: 1, sameRegion: true, totalValue: 320_000 });
    expect(items[1]).toMatchObject({ awards: 3, direct: 1, limited: 0, open: 2, withoutOpenCompetition: 1, ownAwards: 1, sameRegion: true, totalValue: 225_000, slug: expect.stringMatching(/^leeds-city-council-/) });
    expect(items[1]!.shareWithoutOpen).toBeCloseTo(1 / 3, 5);
    expect(items[2]).toMatchObject({ awards: 1, limited: 1, shareWithoutOpen: 1, sameRegion: false });
    // The software buyer is not in this trade.
    expect(items.map((item) => item.name)).not.toContain("Kent County Council");
    expect((await getBuyersForSupplier(acmeId, { now: NOW, months: 6 })).items.find((item) => item.name === "City of York Council")!.awards).toBe(1);
  });

  it("serves the buyer page: record, competition mix, notices and contracts", async () => {
    const [leeds] = await db.execute<{ slug: string; id: string }>(sql`select slug, id from buyers where ppon = 'PLDS-1111-AAAA'`);
    const buyer = await getBuyerBySlug(leeds!.slug);
    expect(buyer).toMatchObject({ name: "Leeds City Council", region: "UKE", buyerType: "publicAuthoritySubCentralGovernment", awardsCount: 3 });
    expect(await getBuyerCompetitionMix(leeds!.id, 24, NOW)).toMatchObject({ awards: 3, direct: 1, open: 2, belowThreshold: 3 });
    const notices = await getBuyerNotices(leeds!.id, NOW);
    expect(notices.live.map((notice) => notice.ocid).sort()).toEqual([T.leeds, T.planningThenTender].sort());
    const contracts = await getBuyerContracts(leeds!.id);
    expect(contracts.total).toBe(3);
    expect(contracts.items.map((contract) => contract.supplierLabel)).toEqual(expect.arrayContaining(["Acme Grounds Ltd", "Rival Landscapes Ltd", UNPUBLISHED_SUPPLIER_LABEL]));
    expect(await getBuyerBySlug("no-such-buyer")).toBeNull();
  });
});

describe("getEarlySignals", () => {
  it("returns planning-stage notices that have not reached a tender", async () => {
    const { items } = await getEarlySignals(acmeId, { now: NOW });
    expect(items.map((item) => item.ocid)).toEqual([T.planning]);
    expect(items[0]).toMatchObject({ stage: "planning", noticeType: "UK2", deadlineAt: null });
    expect(items[0]!.futureNoticeAt?.slice(0, 10)).toBe("2026-12-28");
  });
});

describe("searchSuppliers and supplier records", () => {
  it("finds suppliers by name, tolerating typos and partial names", async () => {
    expect((await searchSuppliers("acme grounds"))[0]).toMatchObject({ name: "Acme Grounds Ltd", companyNumber: "01111111", awardsCount: 2, slug: SLUG, isPublic: true });
    expect((await searchSuppliers("Acme Gronds Limited"))[0]?.name).toBe("Acme Grounds Ltd");
    expect((await searchSuppliers("rival"))[0]?.name).toBe("Rival Landscapes Ltd");
    expect(await searchSuppliers("zzzz qqqq")).toEqual([]);
    expect(await searchSuppliers("a")).toEqual([]);
    expect(await searchSuppliers("   ")).toEqual([]);
    // SQL wildcards in the query are literals.
    expect(await searchSuppliers("%%%")).toEqual([]);
  });

  it("finds a supplier by Companies House number, with or without the leading zero", async () => {
    expect((await searchSuppliers("01111111")).map((hit) => hit.name)).toEqual(["Acme Grounds Ltd"]);
    expect((await searchSuppliers("1111111")).map((hit) => hit.name)).toEqual(["Acme Grounds Ltd"]);
    expect(await searchSuppliers("09999999")).toEqual([]);
  });

  it("keeps possible sole traders out of public search, pages and sitemaps", async () => {
    expect(await searchSuppliers("john smith gardening")).toEqual([]);
    const inApp = await searchSuppliers("john smith gardening", { includeUnpublished: true });
    expect(inApp[0]).toMatchObject({ name: "John Smith Gardening", isPublic: false });
    const record = await getSupplierBySlug(inApp[0]!.slug);
    expect(record).toMatchObject({ isPublic: false, legalForm: "unknown" });
    const slugs = (await listPublicSupplierSlugs(100, 0)).map((entry) => entry.slug);
    expect(slugs).toContain(SLUG);
    expect(slugs).not.toContain(inApp[0]!.slug);
    expect(await countPublicSuppliers()).toBe(slugs.length);
  });

  it("returns the public record with its profile and contracts", async () => {
    const supplier = await getSupplierBySlug(SLUG);
    expect(supplier).toMatchObject({ id: acmeId, name: "Acme Grounds Ltd", companyNumber: "01111111", legalForm: "ltd", awardsCount: 2, totalValue: 200_000, buyersCount: 2, isPublic: true, region: "UKE" });
    expect(supplier!.profile).toMatchObject({ cpvDivisions: ["77"], regions: ["UKE"] });
    expect(supplier!.profile!.summary).toBe("Acme Grounds Ltd is named in 2 published public contract awards worth £200k from 2 buyers, mostly in grounds, forestry and horticultural services (Yorkshire and the Humber).");
    // Company-level fields only: nothing from supplier_contacts can surface here.
    expect(JSON.stringify(supplier)).not.toMatch(/@|tenders@acmegrounds/);
    const contracts = await getSupplierContracts(acmeId);
    expect(contracts.total).toBe(2);
    expect(contracts.items.map((contract) => [contract.title, contract.buyerName, contract.valueAmount])).toEqual([
      ["Grounds Maintenance Services", "Leeds City Council", 120_000],
      ["Grounds Maintenance for Parks", "City of York Council", 80_000],
    ]);
    expect(await getSupplierBySlug("no-such-supplier")).toBeNull();
  });
});

describe("getTender", () => {
  it("resolves a procurement by ocid or by Find a Tender notice id and returns the newest tender notice", async () => {
    expect(await resolveOcid("920001-2026")).toBe(T.updated);
    expect(await resolveOcid("not an id")).toBeNull();
    const tender = await getTender("920001-2026", NOW);
    expect(tender).toMatchObject({ ocid: T.updated, title: "Sports Pitch Grounds Maintenance (deadline extended)", isLive: true, buyerName: "City of York Council", procedure: "Open procedure", competition: "open" });
    expect(tender!.history.map((entry) => entry.releaseId)).toEqual(["920002-2026", "920001-2026"]);
    expect(tender!.cpv).toEqual([{ code: "77314000", label: "Label of 77314000" }]);
    expect(tender!.noticeUrl).toBe("https://www.find-tender.service.gov.uk/Notice/920002-2026");
  });

  it("shows closed, cancelled and awarded procurements as not live", async () => {
    expect(await getTender(T.closed, NOW)).toMatchObject({ isLive: false, stage: "tender" });
    expect(await getTender(T.cancelled, NOW)).toMatchObject({ isLive: false, noticeType: "UK12", status: "cancelled" });
    const awarded = await getTender("ocds-h6vhtk-r00001", NOW);
    expect(awarded).toMatchObject({ isLive: false, stage: "award" });
    expect(awarded!.winners).toEqual([{ name: "Rival Landscapes Ltd", slug: "rival-landscapes-ltd-02222222", valueAmount: 90_000 }]);
    // A sole trader's name is not published on the tender page either.
    expect((await getTender("ocds-h6vhtk-r00005", NOW))!.winners).toEqual([{ name: UNPUBLISHED_SUPPLIER_LABEL, slug: null, valueAmount: 15_000 }]);
    expect(await getTender("ocds-h6vhtk-zzzzzz", NOW)).toBeNull();
  });
});

describe("trade picker and sitemaps", () => {
  it("searches trades by plain-English name and official label", async () => {
    const byName = await searchTrades("grounds");
    expect(byName[0]).toEqual({ code: "77000000", label: "Grounds, forestry and horticultural services" });
    expect((await searchTrades("label of 7731")).map((option) => option.code)).toContain("77314000");
    expect((await searchTrades("")).length).toBeGreaterThan(40);
  });

  it("lists open tenders always, and supplier/buyer pages only when indexing is switched on", async () => {
    const original = process.env.PUBLIC_DATA_PAGES_INDEXABLE;
    try {
      delete process.env.PUBLIC_DATA_PAGES_INDEXABLE;
      const index = await sitemapIndexXml();
      expect(index).toContain("/sitemaps/tenders-0.xml");
      expect(index).not.toContain("suppliers-");
      expect(index).not.toContain("buyers-");
      expect(await sitemapChunkXml("suppliers-0.xml")).toBeNull();
      expect(await sitemapChunkXml("buyers-0.xml")).toBeNull();
      expect(await sitemapChunkXml("../../etc/passwd")).toBeNull();

      process.env.PUBLIC_DATA_PAGES_INDEXABLE = "true";
      expect(await sitemapIndexXml()).toContain("/sitemaps/suppliers-0.xml");
      const suppliers = await sitemapChunkXml("suppliers-0.xml");
      expect(suppliers).toContain(`/suppliers/${SLUG}</loc>`);
      expect(suppliers).not.toContain("john-smith-gardening");
      expect(await sitemapChunkXml("buyers-0.xml")).toContain("/buyers/leeds-city-council-");
      expect(await sitemapChunkXml("suppliers-7.xml")).toBeNull();
    } finally {
      if (original === undefined) delete process.env.PUBLIC_DATA_PAGES_INDEXABLE;
      else process.env.PUBLIC_DATA_PAGES_INDEXABLE = original;
    }
  });
});
