import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
// A UK representative is appointed here, so named addresses may be listed. The state
// without one (generic mailboxes only) is in representative.test.ts.
vi.mock("@/config/site", async () => (await import("./mocks/site")).siteModule(true));

import { db } from "@/db";
import { orgSupplierLinks, outreachAudit, outreachCampaigns, outreachProspects, suppliers } from "@/db/schema";
import { outreachConfig } from "@/features/outreach/config";
import { buildSelection, createCampaign, previewSegment } from "@/features/outreach/server/builder";
import { addSuppressionEntry } from "@/features/outreach/server/suppression-store";
import { ConflictError, ValidationError } from "@/lib/errors";
import { createTestUser, type TestUser } from "../helpers/auth";
import { ingest } from "../procurement/helpers/factory";
import { award, count, DAY_MS, daysAgo, FIVE_ELIGIBLE, NOW, resetOutreach, seed, segment, signInFounder } from "./helpers";

/**
 * The list builder against a real database: who is listed, who is left out and under
 * which reason, the cool-off rule and one prospect per company. All data is fictional.
 */
const supplierId = async (name: string) => {
  const [row] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, name));
  return row!.id;
};

let founder: TestUser;

describe("outreach builder", () => {
  beforeEach(async () => {
    await resetOutreach();
    founder = await signInFounder();
  });

  it("lists the companies the legal gate allows and counts everyone else by reason", async () => {
    await seed([
      // on the list
      { company: "Acme Grounds Ltd", coh: "01111111", email: "tenders@acmegrounds.example", publishedDaysAgo: 2, value: 120_000 },
      { company: "Kestrel Works Ltd", coh: "02020202", email: "info@kestrelworks.example", website: "https://www.kestrelworks.example", publishedDaysAgo: 3 },
      { company: "Dale Facilities LLP", coh: "OC444444", email: "enquiries@dalefacilities.example", publishedDaysAgo: 4 },
      // not eligible under outreachEligibility, each for a different reason
      { company: "Sole Trader Gardening", email: "info@soletrader.example" }, // no Companies House number
      { company: "Ivy Works CIC", coh: "08888888", email: "hello@ivyworks.example" }, // legal form not on the allow-list
      { company: "Larch Services", coh: "09999999", email: "office@larchservices.example" }, // company number but no Ltd/PLC suffix in the name
      { company: "Webmail Builders Ltd", coh: "07070707", email: "office@webmailbuilders.example" }, // turned into a webmail address below
      // the builder's own rules
      { company: "Juniper Ltd", coh: "06060606", email: "info@not-juniper.example", website: "https://juniper.example" }, // address not on the website's domain
      { company: "Heath Roofing Ltd", coh: "05050505", email: "sam.taylor@heathroofing.example" }, // named address, generic-only segment
      { company: "Fenwick Builders Ltd", coh: "04040404", email: "info@fenwick.example", scale: "large" }, // not an SME
      // outside the segment altogether: too old, so not even a candidate
      { company: "Old Award Ltd", coh: "03030303", email: "info@oldaward.example", publishedDaysAgo: 45 },
    ]);
    await db.execute(sql`update supplier_contacts set kind = 'freemail' where email = 'office@webmailbuilders.example'`);

    const preview = await previewSegment(segment(), NOW);
    expect(preview.rows.map((row) => row.company)).toEqual(["Acme Grounds Ltd", "Kestrel Works Ltd", "Dale Facilities LLP"]);
    expect(preview.summary).toMatchObject({ companiesMatched: 10, companiesWithoutAddress: 0, addressesConsidered: 10, eligibleCompanies: 3, listed: 3, listedGeneric: 3, listedNamed: 0 });
    expect(preview.summary.excluded).toEqual({
      supplier_removed: 0,
      suppressed: 0,
      not_eligible: 4,
      domain_mismatch: 1,
      named_not_selected: 1,
      not_sme: 1,
      already_user: 0,
      cool_off: 0,
      duplicate_address: 0,
      duplicate_company: 0,
      over_batch: 0,
    });
    // The reasons are the legal gate's own (src/features/procurement/domain/outreach.ts), not a re-implementation.
    expect(preview.summary.notEligibleByReason).toEqual({ no_company_number: 1, legal_form_not_allowed: 1, name_suffix_missing: 1, freemail_domain: 1 });

    // What the preview shows about a company — and what it does not.
    expect(preview.rows[0]).toMatchObject({
      company: "Acme Grounds Ltd",
      legalForm: "Ltd",
      companyNumber: "01111111",
      town: "Supplierville",
      award: { title: "Grounds Maintenance Services", buyer: "Leeds City Council", value: "£120,000", date: "11 November 2026" },
      emailKind: "generic",
      contactBy: null,
      domainCheck: "unknown",
    });
    expect(preview.rows[1]!.domainCheck).toBe("matches");
    expect(preview.rows[2]!.legalForm).toBe("LLP");
    expect(JSON.stringify(preview)).not.toContain("@"); // no address anywhere in a preview

    // Looking stores nothing.
    expect(await count("outreach_campaigns")).toBe(0);
    expect(await count("outreach_prospects")).toBe(0);
    expect(await count("outreach_audit")).toBe(0);
  });

  it("applies the segment: trade, region, value band, window and batch size", async () => {
    await seed([
      ...FIVE_ELIGIBLE,
      { company: "Welsh Grounds Ltd", coh: "06161616", email: "info@welshgrounds.example", region: "UKL14", publishedDaysAgo: 7, value: 30_000 },
      { company: "No Figure Ltd", coh: "06262626", email: "info@nofigure.example", publishedDaysAgo: 8, value: null },
    ]);
    const names = async (overrides: Parameters<typeof segment>[0]) => (await previewSegment(segment(overrides), NOW)).rows.map((row) => row.company);

    expect(await names({})).toEqual(["Acme Grounds Ltd", "Brightway Cleaning Ltd", "Castle Roofing Ltd", "Dale Facilities LLP", "Elm Care Ltd", "Welsh Grounds Ltd", "No Figure Ltd"]);
    expect(await names({ cpvDivisions: ["45"] })).toEqual(["Castle Roofing Ltd"]);
    expect(await names({ cpvDivisions: ["85"], cpvGroups: ["909"] })).toEqual(["Brightway Cleaning Ltd", "Elm Care Ltd"]);
    expect(await names({ regions: ["UKL"] })).toEqual(["Welsh Grounds Ltd"]);
    expect(await names({ publishedWithinDays: 3 })).toEqual(["Acme Grounds Ltd", "Brightway Cleaning Ltd"]);
    // A value band leaves out awards without a figure of their own.
    expect(await names({ valueMin: 10_000, valueMax: 50_000 })).toEqual(["Welsh Grounds Ltd"]);
    expect(await names({ valueMin: 100_000 })).not.toContain("No Figure Ltd");

    const cut = await previewSegment(segment({ batchSize: 2 }), NOW);
    expect(cut.rows.map((row) => row.company)).toEqual(["Acme Grounds Ltd", "Brightway Cleaning Ltd"]); // newest awards first
    expect(cut.summary).toMatchObject({ eligibleCompanies: 7, listed: 2 });
    expect(cut.summary.excluded.over_batch).toBe(5);
  });

  it("named addresses: only when asked for, only inside their one-month window, with a contact-by date", async () => {
    await seed([
      { company: "Acme Grounds Ltd", coh: "01111111", email: "tenders@acmegrounds.example", publishedDaysAgo: 2 },
      { company: "Heath Roofing Ltd", coh: "05050505", email: "sam.taylor@heathroofing.example", publishedDaysAgo: 3 },
      { company: "Moor Cleaning Ltd", coh: "05151515", email: "info@moorcleaning.example", contactName: "Jo Example", publishedDaysAgo: 4 }, // a role mailbox published with a person's name
      { company: "Stale Named Ltd", coh: "05252525", email: "alex.morgan@stalenamed.example", publishedDaysAgo: 5 },
    ]);
    await db.execute(sql`update supplier_contacts set first_ingested_at = ${daysAgo(31).toISOString()}::timestamptz where email = 'alex.morgan@stalenamed.example'`);

    const generic = await previewSegment(segment(), NOW);
    expect(generic.rows.map((row) => row.company)).toEqual(["Acme Grounds Ltd"]);
    expect(generic.summary.excluded.named_not_selected).toBe(2);
    expect(generic.summary.notEligibleByReason).toEqual({ named_address_past_one_month: 1 });

    const withNamed = await previewSegment(segment({ mailbox: "generic_and_named" }), NOW);
    expect(withNamed.rows.map((row) => [row.company, row.emailKind])).toEqual([
      ["Acme Grounds Ltd", "generic"],
      ["Heath Roofing Ltd", "named"],
      ["Moor Cleaning Ltd", "named"],
    ]);
    // First stored one day before NOW: first contact is allowed for 30 days from then.
    expect(withNamed.rows[1]!.contactBy).toBe(new Date(daysAgo(1).getTime() + 30 * DAY_MS).toISOString());
    expect(withNamed.summary).toMatchObject({ listedGeneric: 1, listedNamed: 2 });
    expect(withNamed.summary.notEligibleByReason).toEqual({ named_address_past_one_month: 1 });
  });

  it("one prospect per company: the generic mailbox is chosen, extra addresses are counted", async () => {
    await seed([
      { company: "Brightway Cleaning Ltd", coh: "02222222", email: "jane.doe@brightway.example", publishedDaysAgo: 2 },
      { company: "Brightway Cleaning Ltd", coh: "02222222", email: "info@brightway.example", publishedDaysAgo: 9, title: "Window Cleaning" },
      { company: "Brightway Cleaning Ltd", coh: "02222222", email: "tenders@brightway.example", publishedDaysAgo: 12, title: "Deep Cleaning" },
    ]);
    const preview = await previewSegment(segment({ mailbox: "generic_and_named" }), NOW);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({ company: "Brightway Cleaning Ltd", emailKind: "generic", award: { title: "Grounds Maintenance Services" } }); // the newest award, a generic mailbox
    expect(preview.summary).toMatchObject({ companiesMatched: 1, addressesConsidered: 3, listed: 1 });
    expect(preview.summary.excluded.duplicate_company).toBe(2);

    const created = await createCampaign({ name: "One per company", segment: segment({ mailbox: "generic_and_named" }), templateVariant: "s1" }, NOW);
    const prospects = await db.select().from(outreachProspects).where(eq(outreachProspects.campaignId, created.campaignId));
    expect(prospects).toHaveLength(1);
    // Between two generic mailboxes the one seen most recently wins.
    expect(prospects[0]!.email).toBe("info@brightway.example");
  });

  it("an address shared by several companies is used once per list", async () => {
    await seed([
      { company: "Maple North Ltd", coh: "06363636", email: "enquiries@maplegroup.example", publishedDaysAgo: 2 },
      { company: "Maple South Ltd", coh: "06464646", email: "enquiries@maplegroup.example", publishedDaysAgo: 3 },
    ]);
    const preview = await previewSegment(segment(), NOW);
    expect(preview.rows.map((row) => row.company)).toEqual(["Maple North Ltd"]);
    expect(preview.summary.excluded.duplicate_address).toBe(1);
  });

  it("leaves out suppressed addresses and domains, users, and removed or merged companies", async () => {
    await seed([
      ...FIVE_ELIGIBLE,
      { company: "Removed Ltd", coh: "06565656", email: "info@removed.example", publishedDaysAgo: 7 },
      { company: "User Address Ltd", coh: "06666666", email: "info@useraddress.example", publishedDaysAgo: 8 },
      { company: "User Domain Ltd", coh: "06767676", email: "tenders@userdomain.example", publishedDaysAgo: 9 },
    ]);
    await addSuppressionEntry({ kind: "email", value: "tenders@acmegrounds.example", domain: "acmegrounds.example" }, { reason: "optout", source: "admin" });
    await addSuppressionEntry({ kind: "domain", value: "brightway.example" }, { reason: "complaint", source: "admin" });
    await db.update(suppliers).set({ removedAt: NOW }).where(eq(suppliers.name, "Removed Ltd"));
    // "Already a user": a workspace claimed the company, an account has the address, or an account is on the same company domain.
    const claimer = await createTestUser({ email: "owner@elsewhere.example" });
    await db.insert(orgSupplierLinks).values({ organizationId: claimer.organizationId, supplierId: await supplierId("Castle Roofing Ltd"), createdBy: claimer.id });
    await createTestUser({ email: "info@useraddress.example" });
    await createTestUser({ email: "someone.else@userdomain.example" });

    const preview = await previewSegment(segment(), NOW);
    expect(preview.rows.map((row) => row.company)).toEqual(["Dale Facilities LLP", "Elm Care Ltd"]);
    expect(preview.summary.excluded).toMatchObject({ suppressed: 2, supplier_removed: 1, already_user: 3 });
  });

  it("cool-off: an address is never listed twice inside the window, across campaigns", async () => {
    await seed(FIVE_ELIGIBLE);
    const first = await createCampaign({ name: "First batch", segment: segment({ batchSize: 2 }), templateVariant: "s1" }, NOW);
    expect(first.listed).toBe(2);

    // The next list takes the next companies — never the same two.
    const second = await previewSegment(segment(), NOW);
    expect(second.rows.map((row) => row.company)).toEqual(["Castle Roofing Ltd", "Dale Facilities LLP", "Elm Care Ltd"]);
    expect(second.summary.excluded.cool_off).toBe(2);
    const next = await createCampaign({ name: "Second batch", segment: segment(), templateVariant: "s3" }, NOW);
    expect(next.listed).toBe(3);

    // Every address is on exactly one list.
    const emails = (await db.select({ email: outreachProspects.email }).from(outreachProspects)).map((row) => row.email);
    expect(emails).toHaveLength(5);
    expect(new Set(emails).size).toBe(5);
    await expect(createCampaign({ name: "Third batch", segment: segment(), templateVariant: "s1" }, NOW)).rejects.toBeInstanceOf(ConflictError);

    // Just inside the window nobody is free; just outside it everyone is.
    const days = outreachConfig.coolOffDays;
    expect(days).toBe(180);
    await db.update(outreachProspects).set({ createdAt: daysAgo(days - 1) });
    const inside = await buildSelection(segment(), NOW);
    expect(inside.summary).toMatchObject({ listed: 0, addressesConsidered: 5 });
    expect(inside.summary.excluded.cool_off).toBe(5);
    await db.update(outreachProspects).set({ createdAt: daysAgo(days + 1) });
    expect((await buildSelection(segment(), NOW)).summary).toMatchObject({ listed: 5 });
  });

  it("cool-off counts from the day a letter was sent, and covers the company as well as the address", async () => {
    await seed([
      { company: "Brightway Cleaning Ltd", coh: "02222222", email: "info@brightway.example", publishedDaysAgo: 2 },
      { company: "Brightway Cleaning Ltd", coh: "02222222", email: "tenders@brightway.example", publishedDaysAgo: 9, title: "Window Cleaning" },
    ]);
    await createCampaign({ name: "Brightway", segment: segment(), templateVariant: "s1" }, NOW);
    // Listed 200 days ago, sent 100 days ago: still inside the window.
    await db.update(outreachProspects).set({ createdAt: daysAgo(200), sentAt: daysAgo(100), status: "sent" });
    const sent = await buildSelection(segment(), NOW);
    // The other address of the same company is not a way round the rule.
    expect(sent.summary).toMatchObject({ listed: 0 });
    expect(sent.summary.excluded.cool_off).toBe(2);
    await db.update(outreachProspects).set({ sentAt: daysAgo(181) });
    expect((await buildSelection(segment(), NOW)).summary.listed).toBe(1);
  });

  it("cool-off survives the erasure of the address (its fingerprint is kept)", async () => {
    await seed([
      { company: "Maple North Ltd", coh: "06363636", email: "enquiries@maplegroup.example", publishedDaysAgo: 2 },
      { company: "Maple South Ltd", coh: "06464646", email: "enquiries@maplegroup.example", publishedDaysAgo: 3 },
    ]);
    await createCampaign({ name: "Maple", segment: segment(), templateVariant: "s1" }, NOW);
    await db.update(outreachProspects).set({ email: null, erasedAt: NOW });
    // Maple South shares the erased address: still not listable.
    const again = await buildSelection(segment(), NOW);
    expect(again.summary).toMatchObject({ listed: 0 });
    expect(again.summary.excluded.cool_off).toBe(2);
  });

  it("a prospect that was skipped before anything was exported does not block its company", async () => {
    await seed(FIVE_ELIGIBLE.slice(0, 1));
    await createCampaign({ name: "Skipped", segment: segment(), templateVariant: "s1" }, NOW);
    await db.update(outreachProspects).set({ status: "skipped", skippedReason: "contact_window_expired" });
    expect((await buildSelection(segment(), NOW)).summary.listed).toBe(1);
    // Once it has been exported it counts, whatever its status became.
    await db.update(outreachProspects).set({ exportedAt: NOW });
    expect((await buildSelection(segment(), NOW)).summary.excluded.cool_off).toBe(1);
  });

  it("creates a campaign: prospects, unguessable unique codes, snapshots and an audit entry without addresses", async () => {
    await seed([...FIVE_ELIGIBLE, { company: "HEATH ROOFING LIMITED", coh: "05050505", email: "sam.taylor@heathroofing.example", publishedDaysAgo: 7, value: null }]);
    const created = await createCampaign({ name: "  Test week   A ", segment: segment({ mailbox: "generic_and_named" }), templateVariant: "s3", notes: " first cohort " }, NOW);
    expect(created.listed).toBe(6);

    const [campaign] = await db.select().from(outreachCampaigns).where(eq(outreachCampaigns.id, created.campaignId));
    expect(campaign).toMatchObject({ name: "Test week A", templateKey: "award_page_v1", templateVariant: "s3", createdBy: founder.id, notes: "first cohort", exportedAt: null });
    expect(campaign!.segment).toEqual(segment({ mailbox: "generic_and_named" }));
    expect(campaign!.buildSummary).toMatchObject({ listed: 6, listedGeneric: 5, listedNamed: 1, addressesConsidered: 6 });

    const prospects = await db.select().from(outreachProspects).where(eq(outreachProspects.campaignId, created.campaignId));
    expect(prospects).toHaveLength(6);
    // Codes: 10 base62 characters, all different.
    for (const prospect of prospects) expect(prospect.refCode).toMatch(/^[0-9A-Za-z]{10}$/);
    expect(new Set(prospects.map((prospect) => prospect.refCode)).size).toBe(6);
    expect(prospects.every((prospect) => prospect.status === "listed" && prospect.sentAt === null && prospect.exportedAt === null)).toBe(true);

    const acme = prospects.find((prospect) => prospect.email === "tenders@acmegrounds.example")!;
    expect(acme).toMatchObject({ emailKind: "generic", eligibility: { personalData: false, contactBy: null, reasons: [] } });
    expect(acme.emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(acme.mergeFields).toEqual({
      company: "Acme Grounds Ltd",
      companyShort: "Acme Grounds",
      awardTitle: "Grounds Maintenance Services",
      buyer: "Leeds City Council",
      value: "£120,000",
      noticeDate: "11 November 2026",
      noticeId: expect.stringMatching(/^\d+-2026$/),
      supplierSlug: "acme-grounds-ltd-01111111",
    });
    const heath = prospects.find((prospect) => prospect.emailKind === "named")!;
    expect(heath.email).toBe("sam.taylor@heathroofing.example");
    expect(heath.eligibility).toMatchObject({ personalData: true, contactBy: new Date(daysAgo(1).getTime() + 30 * DAY_MS).toISOString() });
    // A name published in capitals is written in ordinary case; no value, so the letter will not state one.
    expect(heath.mergeFields).toMatchObject({ company: "Heath Roofing Limited", companyShort: "Heath Roofing", value: null });

    const audit = await db.select().from(outreachAudit);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: founder.id, action: "campaign.created", campaignId: created.campaignId, count: 6 });
    expect(JSON.stringify(audit)).not.toContain("@");
  });

  it("codes stay unique across campaigns, and the database refuses a duplicate", async () => {
    await seed(FIVE_ELIGIBLE);
    await createCampaign({ name: "Batch one", segment: segment({ batchSize: 3 }), templateVariant: "s1" }, NOW);
    await createCampaign({ name: "Batch two", segment: segment({ batchSize: 3 }), templateVariant: "s1" }, NOW);
    const prospects = await db.select().from(outreachProspects);
    expect(prospects).toHaveLength(5);
    expect(new Set(prospects.map((prospect) => prospect.refCode)).size).toBe(5);
    const [one, two] = prospects;
    await expect(db.update(outreachProspects).set({ refCode: one!.refCode }).where(eq(outreachProspects.id, two!.id))).rejects.toThrow();
    // …and a second prospect for the same company on the same list.
    await expect(
      db.insert(outreachProspects).values({ campaignId: one!.campaignId, supplierId: one!.supplierId, email: "other@acmegrounds.example", emailKind: "generic", refCode: "ZZZZZZZZZZ", eligibility: { personalData: false, contactBy: null, reasons: [] } }),
    ).rejects.toThrow();
  });

  it("validates what it is given", async () => {
    await seed(FIVE_ELIGIBLE);
    const ok = { name: "Valid", segment: segment(), templateVariant: "s1" };
    await expect(createCampaign({ ...ok, name: "x" }, NOW)).rejects.toBeInstanceOf(ValidationError);
    await expect(createCampaign({ ...ok, templateVariant: "s9" }, NOW)).rejects.toBeInstanceOf(ValidationError);
    await expect(createCampaign({ ...ok, segment: { ...segment(), batchSize: 401 } }, NOW)).rejects.toBeInstanceOf(ValidationError);
    await expect(createCampaign({ ...ok, segment: { ...segment(), mailbox: "everyone" } }, NOW)).rejects.toBeInstanceOf(ValidationError);
    await expect(createCampaign({ ...ok, segment: null }, NOW)).rejects.toBeInstanceOf(ValidationError);
    expect(await count("outreach_campaigns")).toBe(0);
  });

  it("a later notice does not bring a suppressed address back (suppression is by address, not by contact row)", async () => {
    await seed([{ company: "Acme Grounds Ltd", coh: "01111111", email: "tenders@acmegrounds.example", publishedDaysAgo: 20 }]);
    await addSuppressionEntry({ kind: "email", value: "tenders@acmegrounds.example", domain: "acmegrounds.example" }, { reason: "optout", source: "optout_link" });
    expect((await buildSelection(segment(), NOW)).summary.excluded.suppressed).toBe(1);

    // The same address is published again: in a new notice of the same company, and for a sister company (a NEW contact row).
    await ingest([
      award({ company: "Acme Grounds Ltd", coh: "01111111", email: "tenders@acmegrounds.example", publishedDaysAgo: 1, title: "Parks Maintenance" }),
      award({ company: "Acme Grounds North Ltd", coh: "01212121", email: "tenders@acmegrounds.example", publishedDaysAgo: 1 }),
    ]);
    const rows = (await db.execute(sql`select supplier_id, suppressed_at from supplier_contacts where email = 'tenders@acmegrounds.example' order by suppressed_at nulls last`)) as unknown as Array<{ suppressed_at: unknown }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]!.suppressed_at).not.toBeNull(); // ingestion never clears the stamp
    expect(rows[1]!.suppressed_at).toBeNull(); // the new row has none — and it does not matter:

    const selection = await buildSelection(segment(), NOW);
    expect(selection.prospects).toEqual([]);
    expect(selection.summary.excluded.suppressed).toBe(2);
    await expect(createCampaign({ name: "Nobody", segment: segment(), templateVariant: "s1" }, NOW)).rejects.toBeInstanceOf(ConflictError);
    // Creating a campaign also stamps the new row from the list.
    const stamped = (await db.execute(sql`select count(*)::int as n from supplier_contacts where email = 'tenders@acmegrounds.example' and suppressed_at is not null`)) as unknown as Array<{ n: number }>;
    expect(stamped[0]!.n).toBe(1); // the transaction was rolled back with the refusal; maintenance stamps it (see suppressions.test.ts)
  });
});
