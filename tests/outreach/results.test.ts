import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
// A UK representative is appointed here, so the list can hold a named address.
vi.mock("@/config/site", async () => (await import("./mocks/site")).siteModule(true));

import { db } from "@/db";
import { orgSupplierLinks, pageVisits, subscriptions, suppliers } from "@/db/schema";
import { createCampaign } from "@/features/outreach/server/builder";
import { exportCampaignCsv, getCampaign, markProspectsSent } from "@/features/outreach/server/campaigns";
import { confirmOptOut } from "@/features/outreach/server/optout";
import { getOutreachResults } from "@/features/outreach/server/results";
import { addSuppressionEntry } from "@/features/outreach/server/suppression-store";
import { actAs, createTestUser, type TestUser } from "../helpers/auth";
import { bidDeskInstalled, DAY_MS, FIVE_ELIGIBLE, NOW, prospectOf, recordPurchase, resetOutreach, seed, segment, signInFounder, withBidDeskTables, type AwardSpec } from "./helpers";

/**
 * What came of the letters, measured from the tables: sent -> opened their page -> claimed
 * it -> started a bid check, and who opted out. All data is fictional.
 */
const NAMED: AwardSpec = { company: "Heath Roofing Ltd", coh: "05050505", email: "sam.taylor@heathroofing.example", publishedDaysAgo: 7, cpv: ["45261210"], title: "Roof Repairs Phase 2" };
const TODAY = NOW.toISOString().slice(0, 10);
const at = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

let founder: TestUser;
let campaignId: string;
/** The workspace that claims Acme after opening its page. */
let acmeOwner: TestUser;

const supplierId = async (name: string) => (await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, name)))[0]!.id;

async function visit(company: string, when: Date, options: { bot?: boolean; pageType?: string } = {}): Promise<void> {
  const prospect = await prospectOf(company);
  await db.insert(pageVisits).values({ pageType: options.pageType ?? "supplier", entityId: await supplierId(company), refCode: prospect.refCode, isBot: options.bot ?? false, createdAt: when });
}

async function claim(company: string, when: Date, owner?: TestUser): Promise<TestUser> {
  const user = owner ?? (await createTestUser());
  await db.insert(orgSupplierLinks).values({ organizationId: user.organizationId, supplierId: await supplierId(company), createdBy: user.id, createdAt: when });
  return user;
}

/**
 * Six companies on one list. Acme, Brightway, Castle and Heath (a named address) were
 * written to on the fixture day; Dale was exported only; Elm never left the tool.
 */
async function scenario(): Promise<void> {
  await seed([...FIVE_ELIGIBLE, NAMED]);
  campaignId = (await createCampaign({ name: "Week one", segment: segment({ mailbox: "generic_and_named" }), templateVariant: "s1" }, NOW)).campaignId;
  const ids = await Promise.all(["Acme Grounds Ltd", "Brightway Cleaning Ltd", "Castle Roofing Ltd", "Heath Roofing Ltd", "Dale Facilities LLP"].map(async (company) => (await prospectOf(company)).id));
  await db.execute(sql`update outreach_prospects set status = 'exported', exported_at = ${NOW.toISOString()}::timestamptz where id = any(${`{${ids.join(",")}}`}::uuid[])`);
  await markProspectsSent({ campaignId, sentOn: TODAY, prospectIds: ids.slice(0, 4) }, NOW);

  // Opened their page:
  await visit("Acme Grounds Ltd", new Date(`${TODAY}T00:30:00Z`)); // the day of sending, before the letter's own timestamp
  await visit("Acme Grounds Ltd", at(2)); // a second look is the same company
  await visit("Heath Roofing Ltd", at(1));
  // …and what does not count as that:
  await visit("Brightway Cleaning Ltd", at(1), { bot: true }); // a declared crawler
  await visit("Brightway Cleaning Ltd", at(1), { pageType: "tender" }); // the code on some other page
  await visit("Castle Roofing Ltd", at(-1)); // the day before sending: the founder's own check
  await visit("Dale Facilities LLP", at(1)); // opened, but the batch was never marked as sent

  // Claimed their page:
  acmeOwner = await claim("Acme Grounds Ltd", at(1)); // after opening it
  await claim("Heath Roofing Ltd", at(0.5)); // before its first visit: not because of the letter
  await claim("Castle Roofing Ltd", at(1)); // never opened through the link
  actAs(founder);
}

describe("outreach results", () => {
  beforeEach(async () => {
    await resetOutreach();
    founder = await signInFounder();
    await scenario();
  });

  it("counts companies at each step, each once, and only what the letter can explain", async () => {
    const results = await getOutreachResults(campaignId, at(3));
    expect(results.counts).toMatchObject({ sent: 4, visited: 2, claimed: 1, optedOut: 0, bounced: 0, complaints: 0, cardPayments: 0 });
    expect(results.counts.lastSentAt).toEqual(new Date(`${TODAY}T12:00:00.000Z`));
    expect(results.totals).toEqual({ prospects: 6, listed: 1, exported: 1, skipped: 0, optedOutBeforeSending: 0 });
    expect(results.visitedNotMarkedSent).toBe(1); // Dale: a hint to mark the batch
    expect(results.byKind).toEqual({ generic: { sent: 3, visited: 1, claimed: 1 }, named: { sent: 1, visited: 1, claimed: 0 } });

    // The campaign page shows every look at a company's page through its link, whenever it was.
    const detail = await getCampaign(campaignId, at(3));
    expect(Object.fromEntries(detail.prospects.map((prospect) => [prospect.company, prospect.visits]))).toEqual({
      "Acme Grounds Ltd": 2,
      "Heath Roofing Ltd": 1,
      "Brightway Cleaning Ltd": 0, // a crawler, and the code on another kind of page
      "Castle Roofing Ltd": 1, // the day before sending: shown here, not a step of the funnel
      "Dale Facilities LLP": 1,
      "Elm Care Ltd": 0,
    });
  });

  it("gives counts, not percentages or a verdict, for a handful of letters", async () => {
    const { reading } = await getOutreachResults(campaignId, at(30));
    expect(reading).toMatchObject({ verdict: "too_early", headline: "Too few e-mails to judge: 4 sent", judged: false });
    expect(reading.lines.map((line) => [line.key, line.value, line.state])).toEqual([
      ["visits", "2 of 4", "not_judged"],
      ["claims", "1 of 4", "not_judged"],
      ["packs", (await bidDeskInstalled()) ? "0 of 4" : "—", (await bidDeskInstalled()) ? "not_judged" : "unknown"],
      ["cardPayments", "0 of 4", "not_judged"],
    ]);
    expect(JSON.stringify(reading)).not.toContain("%");
  });

  it("opt-outs, bounces and complaints are counted against the letters that were sent", async () => {
    await confirmOptOut((await prospectOf("Brightway Cleaning Ltd")).refCode);
    await addSuppressionEntry({ kind: "email", value: "bids@castleroofing.example", domain: "castleroofing.example" }, { reason: "bounce", source: "bounce_import" });
    // A complaint about the whole company, entered as its domain. A complaint is an opt-out too.
    await addSuppressionEntry({ kind: "domain", value: "heathroofing.example" }, { reason: "complaint", source: "admin" });
    // Elm was never written to: an opt-out there is not a result of a letter.
    await addSuppressionEntry({ kind: "email", value: "office@elmcare.example", domain: "elmcare.example" }, { reason: "optout", source: "admin" });

    const results = await getOutreachResults(campaignId, at(3));
    expect(results.counts).toMatchObject({ sent: 4, optedOut: 2, bounced: 1, complaints: 1 });
    expect(results.totals).toMatchObject({ skipped: 1, optedOutBeforeSending: 0 });
    // Three complaints stop the test whatever else happened.
    await addSuppressionEntry({ kind: "email", value: "tenders@acmegrounds.example", domain: "acmegrounds.example" }, { reason: "complaint", source: "admin" });
    await addSuppressionEntry({ kind: "email", value: "bids@castleroofing.example", domain: "castleroofing.example" }, { reason: "complaint", source: "admin" }); // already listed as a bounce: one entry per address
    await addSuppressionEntry({ kind: "domain", value: "castleroofing.example" }, { reason: "complaint", source: "admin" });
    const stopped = await getOutreachResults(campaignId, at(3));
    expect(stopped.counts.complaints).toBe(3);
    expect(stopped.reading).toMatchObject({ verdict: "stopped", headline: "Stop: 3 complaints" });
  });

  it("a paying workspace is one that claimed after the letter and has a Paddle subscription", async () => {
    await db.insert(subscriptions).values({ organizationId: acmeOwner.organizationId, status: "active", planKey: "pro", paddleSubscriptionId: "sub_test_acme" });
    // A subscription without Paddle behind it (a comped plan) is not a payment.
    const comped = await claim("Brightway Cleaning Ltd", at(2));
    await visit("Brightway Cleaning Ltd", at(1.5));
    await db.insert(subscriptions).values({ organizationId: comped.organizationId, status: "active", planKey: "pro" });
    actAs(founder);
    const results = await getOutreachResults(campaignId, at(3));
    expect(results.counts).toMatchObject({ visited: 3, claimed: 2, cardPayments: 1 });
  });

  it("does not invent bid checks while the bid desk is not installed", async (context) => {
    if (await bidDeskInstalled()) context.skip();
    const results = await getOutreachResults(campaignId, at(3));
    expect(results.counts.bidChecks).toBeNull();
    expect(results.reading.lines.find((line) => line.key === "packs")).toMatchObject({ value: "—", state: "unknown" });
  });

  it("with the bid desk installed: bid checks started after the claim", async () => {
    await withBidDeskTables(async () => {
      const zero = await getOutreachResults(campaignId, at(3));
      expect(zero.counts).toMatchObject({ bidChecks: 0, cardPayments: 0 });

      const org = acmeOwner.organizationId;
      await db.execute(sql`insert into bids (organization_id, title, created_at) values (${org}, 'Before the claim', ${at(0.5).toISOString()}::timestamptz)`);
      expect((await getOutreachResults(campaignId, at(3))).counts.bidChecks).toBe(0);
      await db.execute(sql`insert into bids (organization_id, title, created_at) values (${org}, 'Grounds tender', ${at(2).toISOString()}::timestamptz), (${org}, 'Second tender', ${at(2.5).toISOString()}::timestamptz)`);
      const started = await getOutreachResults(campaignId, at(3));
      expect(started.counts).toMatchObject({ bidChecks: 1, cardPayments: 0 }); // one company, however many checks
      expect(started.reading.lines.find((line) => line.key === "packs")).toMatchObject({ value: "1 of 4" });
    });
  });

  it("a Bid Pass bought after the claim is a card payment — unless it was refunded, or given by hand", async () => {
    const org = acmeOwner.organizationId;
    const cardPayments = async () => (await getOutreachResults(campaignId, at(3))).counts.cardPayments;

    // A pass given by hand has no purchase behind it.
    if (await bidDeskInstalled()) {
      await db.execute(sql`insert into bid_credits (organization_id, kind, source, granted_at) values (${org}, 'bid_pass', 'admin', ${at(2).toISOString()}::timestamptz)`);
    }
    expect(await cardPayments()).toBe(0);
    // Bought before the company claimed its page: not because of the letter.
    await recordPurchase(org, { at: at(0.5) });
    expect(await cardPayments()).toBe(0);
    // Refunded in full, or charged back: the money did not stay.
    await recordPurchase(org, { at: at(2), status: "refunded" });
    await recordPurchase(org, { at: at(2), status: "disputed" });
    expect(await cardPayments()).toBe(0);
    // Paid, and still paid for (a partial refund leaves the pass with the customer).
    await recordPurchase(org, { at: at(2), status: "partially_refunded" });
    expect(await cardPayments()).toBe(1);
    await recordPurchase(org, { at: at(2.5), quantity: 2 });
    expect(await cardPayments()).toBe(1); // one company, however many purchases

    // A purchase by a workspace that did not come through a letter is none of the campaign's.
    const stranger = await createTestUser({ email: "owner@stranger.example" });
    await recordPurchase(stranger.organizationId, { at: at(2) });
    actAs(founder);
    expect(await cardPayments()).toBe(1);
  });

  it("adds campaigns up for the overall figures and keeps them apart otherwise", async () => {
    await seed([{ company: "Fir Trees Ltd", coh: "06868686", email: "info@firtrees.example", publishedDaysAgo: 1 }]);
    const second = await createCampaign({ name: "Week two", segment: segment(), templateVariant: "s2" }, NOW);
    expect(second.listed).toBe(1);
    await exportCampaignCsv(second.campaignId, "first", NOW);
    await markProspectsSent({ campaignId: second.campaignId, sentOn: at(1).toISOString().slice(0, 10), allExported: true }, at(1));
    await visit("Fir Trees Ltd", at(2));

    expect((await getOutreachResults(second.campaignId, at(3))).counts).toMatchObject({ sent: 1, visited: 1, claimed: 0 });
    expect((await getOutreachResults(campaignId, at(3))).counts).toMatchObject({ sent: 4, visited: 2, claimed: 1 });
    const overall = await getOutreachResults(null, at(3));
    expect(overall.counts).toMatchObject({ sent: 5, visited: 3, claimed: 1 });
    expect(overall.counts.lastSentAt).toEqual(new Date(`${at(1).toISOString().slice(0, 10)}T12:00:00.000Z`));
    expect(overall.totals.prospects).toBe(7);
  });

  it("is all zeros, and says nothing was sent, on an empty database", async () => {
    await resetOutreach();
    actAs(await signInFounder());
    const results = await getOutreachResults(null, NOW);
    expect(results.counts).toMatchObject({ sent: 0, visited: 0, claimed: 0, optedOut: 0, bounced: 0, complaints: 0, lastSentAt: null });
    expect(results.totals).toEqual({ prospects: 0, listed: 0, exported: 0, skipped: 0, optedOutBeforeSending: 0 });
    expect(results.reading).toMatchObject({ verdict: "too_early", headline: "Nothing sent yet" });
  });
});
