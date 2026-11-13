import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { db } from "@/db";
import { procurementConfig } from "@/features/procurement/config";
import { specFromManualProfile } from "@/features/procurement/domain/profile";
import { loadSupplierPage, loadSupplierWins, loadTenderPage } from "@/features/procurement/public-data";
import { getBuyerBySlug, getBuyerCompetitionMix, getBuyersForSupplier } from "@/features/procurement/queries/buyers";
import { getBuyerContracts, getEndingSoon, getOwnRenewals, getSimilarAwardsFromBuyer, getSupplierContracts } from "@/features/procurement/queries/contracts";
import { searchTrades } from "@/features/procurement/queries/cpv";
import { getBuyerNotices, getEarlySignals, getMatchForNotice, getMatchesForSpec, getSupplierMatches } from "@/features/procurement/queries/matches";
import { getTender, resolveOcid } from "@/features/procurement/queries/notices";
import { getSupplierSpec, UNPUBLISHED_SUPPLIER_LABEL } from "@/features/procurement/queries/shared";
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
  it("returns the STRONG matches by default: the supplier's own line of work, where it works, best first", async () => {
    const { items, total, strong, wider } = await getSupplierMatches(acmeId, { now: NOW });
    const ocids = items.map((item) => item.ocid);
    // Three tenders are grounds maintenance in Yorkshire, from buyers that have awarded Acme a contract.
    expect({ total, strong, wider }).toEqual({ total: 3, strong: 3, wider: 2 });
    expect([...ocids].sort()).toEqual([T.leeds, T.updated, T.planningThenTender].sort());
    expect(items.every((item) => item.tier === "strong")).toBe(true);
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
    // The counted facts behind the chips: Acme's two contracts, one of them from this buyer, both the same work.
    expect(items[0]!.facts).toMatchObject({ wins: 2, buyerWins: 1, newBuyer: false, sameWorkWins: 2 });
    expect(items[0]!.facts.buyerContracts).toEqual([{ title: "Grounds Maintenance Services", valueAmount: 120_000, year: "2026" }]);
    // Closed yesterday, cancelled by a UK12, or another trade: never a match, in any tier.
    const all = await getSupplierMatches(acmeId, { now: NOW, tier: "all" });
    for (const excluded of [T.closed, T.cancelled, T.software]) expect(all.items.map((item) => item.ocid)).not.toContain(excluded);
    // One row per procurement: the updated notice replaces the original.
    expect(items.filter((item) => item.ocid === T.updated)).toHaveLength(1);
    expect(items.find((item) => item.ocid === T.updated)!.title).toBe("Sports Pitch Grounds Maintenance (deadline extended)");
    // Scores are sorted.
    expect([...items].sort((a, b) => b.score - a.score).map((item) => item.ocid)).toEqual(ocids);
  });

  it("lists the wider matches after the strong ones when asked for every tier", async () => {
    const { items, total, strong, wider } = await getSupplierMatches(acmeId, { now: NOW, tier: "all" });
    expect({ total, strong, wider }).toEqual({ total: 5, strong: 3, wider: 2 });
    expect(items.map((item) => item.tier)).toEqual(["strong", "strong", "strong", "wider", "wider"]);
    // Each tier in its own order of relevance.
    for (const tier of ["strong", "wider"] as const) {
      const scores = items.filter((item) => item.tier === tier).map((item) => item.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    }
    // The same work in a region the supplier has never worked in: wider, however well the category fits.
    const bristol = items.find((item) => item.ocid === T.bristol)!;
    expect(bristol).toMatchObject({ tier: "wider", reason: "Same category as your £120k award from Leeds City Council" });
    expect(bristol.breakdown).toMatchObject({ regionMatch: "elsewhere", cpvPrefix: "77314" });
    expect(bristol.facts).toMatchObject({ buyerWins: 0, newBuyer: true, sameWorkWins: 2 });
    // A neighbouring category from a buyer it has never won from: wider, and below its own line of work.
    const trees = items.find((item) => item.ocid === T.trees)!;
    expect(trees.tier).toBe("wider");
    expect(trees.score).toBeLessThan(items[0]!.score);
    expect(trees.facts).toMatchObject({ sameWorkWins: 0 });

    // One tender on its own (the tender page), whatever its tier; null when it is no match at all.
    const spec = (await getSupplierSpec(acmeId))!;
    expect(await getMatchForNotice(spec, T.bristol, NOW)).toMatchObject({ ocid: T.bristol, tier: "wider" });
    expect(await getMatchForNotice(spec, T.leeds, NOW)).toMatchObject({ ocid: T.leeds, tier: "strong" });
    expect(await getMatchForNotice(spec, T.software, NOW)).toBeNull();
  });

  it("applies filters, paging and exclusions", async () => {
    // Counts are of the requested tier, after the filters.
    expect(await getSupplierMatches(acmeId, { now: NOW, filters: { region: "UKK" } })).toMatchObject({ items: [], total: 0, strong: 0, wider: 1 });
    const southWest = await getSupplierMatches(acmeId, { now: NOW, tier: "all", filters: { region: "UKK" } });
    expect(southWest.items.map((item) => item.ocid)).toEqual([T.bristol]);
    const belowThreshold = await getSupplierMatches(acmeId, { now: NOW, filters: { kind: "below_threshold" } });
    expect(belowThreshold.items.map((item) => item.ocid)).toEqual([T.leeds]);
    const large = await getSupplierMatches(acmeId, { now: NOW, filters: { valueMin: 1_000_000 } });
    expect(large.items.map((item) => item.ocid)).toEqual([T.planningThenTender]);
    const closingSoon = await getSupplierMatches(acmeId, { now: NOW, filters: { closingWithinDays: 25 } });
    expect(closingSoon.items.map((item) => item.ocid)).toEqual([T.leeds]);
    const withoutLeeds = await getSupplierMatches(acmeId, { now: NOW, excludeOcids: [T.leeds] });
    expect(withoutLeeds.items.map((item) => item.ocid)).not.toContain(T.leeds);
    expect(withoutLeeds).toMatchObject({ total: 2, strong: 2 });
    // Soonest deadline first, on request.
    expect((await getSupplierMatches(acmeId, { now: NOW, order: "deadline" })).items.map((item) => item.ocid)).toEqual([T.leeds, T.updated, T.planningThenTender]);
    const page = await getSupplierMatches(acmeId, { now: NOW, tier: "all", limit: 2, offset: 2 });
    expect(page.items.map((item) => item.tier)).toEqual(["strong", "wider"]);
    expect(page.total).toBe(5);
    // A count alone.
    expect(await getSupplierMatches(acmeId, { now: NOW, limit: 0 })).toMatchObject({ items: [], total: 3, strong: 3, wider: 2 });
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
    // A hand-picked trade is the radar's own line of work: in its region that is a strong match.
    const strong = await getMatchesForSpec(spec, { now: NOW });
    expect(strong.items.map((item) => item.ocid)).toEqual([T.bristol]);
    expect(strong.items[0]).toMatchObject({ tier: "strong", reason: "Matches your trade: label of 77314000" });
    expect(strong.items[0]!.facts).toMatchObject({ wins: 0, buyerWins: 0, newBuyer: false, trade: expect.any(String) });
    // The same trade elsewhere in the country is a wider match.
    const { items } = await getMatchesForSpec(spec, { now: NOW, tier: "all" });
    expect(items[0]!.ocid).toBe(T.bristol);
    expect(items.find((item) => item.ocid === T.updated)).toMatchObject({ tier: "wider", reason: 'Matches your trade (label of 77314000) and mentions "sports pitch"' });
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
    // The switch is PUBLIC_DATA_PAGES_INDEXABLE, validated once in src/env.ts and read through the module's config.
    const indexable = vi.spyOn(procurementConfig, "publicDataPagesIndexable", "get");
    try {
      indexable.mockReturnValue(false);
      const index = await sitemapIndexXml();
      expect(index).toContain("/sitemaps/tenders-0.xml");
      expect(index).not.toContain("suppliers-");
      expect(index).not.toContain("buyers-");
      expect(await sitemapChunkXml("suppliers-0.xml")).toBeNull();
      expect(await sitemapChunkXml("buyers-0.xml")).toBeNull();
      expect(await sitemapChunkXml("../../etc/passwd")).toBeNull();

      indexable.mockReturnValue(true);
      expect(await sitemapIndexXml()).toContain("/sitemaps/suppliers-0.xml");
      const suppliers = await sitemapChunkXml("suppliers-0.xml");
      expect(suppliers).toContain(`/suppliers/${SLUG}</loc>`);
      expect(suppliers).not.toContain("john-smith-gardening");
      expect(await sitemapChunkXml("buyers-0.xml")).toContain("/buyers/leeds-city-council-");
      expect(await sitemapChunkXml("suppliers-7.xml")).toBeNull();
    } finally {
      indexable.mockRestore();
    }
  });
});

describe("the tender page's and the radar's extra reads", () => {
  it("finds who won similar work from the same buyer, newest first, never naming a possible sole trader", async () => {
    const [leeds] = await db.execute<{ id: string }>(sql`select id from buyers where ppon = 'PLDS-1111-AAAA'`);
    const similar = await getSimilarAwardsFromBuyer(leeds!.id, GROUNDS, { now: NOW });
    expect(similar.map((contract) => [contract.supplierLabel, contract.title, contract.valueAmount])).toEqual([
      ["Acme Grounds Ltd", "Grounds Maintenance Services", 120_000],
      [UNPUBLISHED_SUPPLIER_LABEL, "Grass Cutting Rounds", 15_000],
      ["Rival Landscapes Ltd", "Cemetery Grounds Maintenance", 90_000],
    ]);
    // The tender's own procurement is left out; a category stated no deeper than its group still finds the trade.
    expect((await getSimilarAwardsFromBuyer(leeds!.id, GROUNDS, { now: NOW, excludeOcid: "ocds-h6vhtk-a00001" })).map((contract) => contract.title)).toEqual(["Grass Cutting Rounds", "Cemetery Grounds Maintenance"]);
    expect(await getSimilarAwardsFromBuyer(leeds!.id, ["77300000"], { now: NOW })).toHaveLength(3);
    expect(await getSimilarAwardsFromBuyer(leeds!.id, GROUNDS, { now: NOW, limit: 1 })).toHaveLength(1);
    // Another trade, or nothing to go on: nothing, and the section is left out.
    expect(await getSimilarAwardsFromBuyer(leeds!.id, ["72212000"], { now: NOW })).toEqual([]);
    expect(await getSimilarAwardsFromBuyer(leeds!.id, [], { now: NOW })).toEqual([]);
  });

  it("gives each buyer in the trade its median value, its share to small firms and its open tenders, in the order asked for", async () => {
    const { items } = await getBuyersForSupplier(acmeId, { now: NOW });
    const leeds = items.find((item) => item.name === "Leeds City Council")!;
    // Three contracts of £120,000, £90,000 and £15,000; every supplier's size was published as small or medium.
    expect(leeds).toMatchObject({ medianValue: 90_000, smeAwards: 3, sizedAwards: 3, openTenders: 2, ownAwards: 1 });
    expect(items.find((item) => item.name === "City of York Council")).toMatchObject({ openTenders: 1 });
    expect((await getBuyersForSupplier(acmeId, { now: NOW, sort: "open" })).items[0]).toMatchObject({ name: "Leeds City Council", openTenders: 2 });
    const byMedian = (await getBuyersForSupplier(acmeId, { now: NOW, sort: "median" })).items.map((item) => item.medianValue ?? 0);
    expect([...byMedian].sort((a, b) => b - a)).toEqual(byMedian);
    expect((await getBuyersForSupplier(acmeId, { now: NOW, region: "UKK" })).items.map((item) => item.name)).toEqual(["Bristol City Council"]);
  });

  it("narrows rival contracts by value and lists them by end date", async () => {
    expect((await getEndingSoon(acmeId, 12, { now: NOW, order: "end" })).items.map((item) => item.title)).toEqual(["Grass Cutting Rounds", "Cemetery Grounds Maintenance"]);
    expect((await getEndingSoon(acmeId, 12, { now: NOW, valueMin: 80_000 })).items.map((item) => item.title)).toEqual(["Cemetery Grounds Maintenance"]);
    expect((await getEndingSoon(acmeId, 12, { now: NOW, valueMax: 80_000 })).items.map((item) => item.title)).toEqual(["Grass Cutting Rounds"]);
    expect(await getEndingSoon(acmeId, 12, { now: NOW, limit: 0 })).toMatchObject({ items: [], total: 2 });
  });

  it("says whether a tender's value is stated with or without VAT", async () => {
    expect(await getTender(T.leeds, NOW)).toMatchObject({ valueAmount: 150_000, valueBasis: "net", lotsCount: 1 });
  });
});

describe("what a public page loads", () => {
  it("loads three items per block and the totals, and nothing for a supplier without a public page", async () => {
    const page = (await loadSupplierPage(SLUG))!;
    expect(page.supplier).toMatchObject({ id: acmeId, name: "Acme Grounds Ltd", awardsCount: 2 });
    expect(page.contracts).toMatchObject({ total: 2 });
    // Open tenders are the STRONG matches: the three best, shown soonest deadline first.
    expect(page.matches.total).toBe(3);
    expect(page.matches.items.map((item) => item.ocid)).toEqual([T.leeds, T.updated, T.planningThenTender]);
    expect(page.matches.items.every((item) => item.tier === "strong")).toBe(true);
    for (const block of [page.matches, page.endingSoon, page.buyers]) expect(block.items.length).toBeLessThanOrEqual(procurementConfig.publicBlockItems);
    expect(page.buyers.total).toBe(3);
    expect(page.endingSoon.total).toBe(2);
    expect(page).toHaveProperty("updatedAt");
    // Company-level data only, in everything the page is given.
    expect(JSON.stringify(page)).not.toMatch(/@|John Smith/);

    expect(await loadSupplierWins(acmeId, 1)).toMatchObject({ total: 2, items: [{ title: "Grounds Maintenance Services" }, { title: "Grounds Maintenance for Parks" }] });
    expect((await loadSupplierWins(acmeId, 2)).items).toEqual([]);

    const [john] = await searchSuppliers("john smith gardening", { includeUnpublished: true });
    expect(await loadSupplierPage(john!.slug)).toMatchObject({ supplier: { isPublic: false }, contracts: { items: [], total: 0 }, matches: { items: [], total: 0 }, endingSoon: { total: 0 }, buyers: { total: 0 } });
    expect(await loadSupplierPage("no-such-supplier")).toBeNull();
    expect(await loadTenderPage(T.leeds)).toMatchObject({ ocid: T.leeds });
    expect(await loadTenderPage("ocds-h6vhtk-zzzzzz")).toBeNull();
  });
});
