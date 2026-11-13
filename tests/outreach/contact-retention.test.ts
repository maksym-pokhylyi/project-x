import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
// A UK representative is appointed here, so the list can hold named addresses.
vi.mock("@/config/site", async () => (await import("./mocks/site")).siteModule(true));

import { db } from "@/db";
import { createCampaign, previewSegment } from "@/features/outreach/server/builder";
import { exportCampaignCsv, markProspectsSent } from "@/features/outreach/server/campaigns";
import { runOutreachRetention } from "@/features/outreach/server/retention";
import { runContactRetention } from "@/features/procurement/retention";
import { DAY_MS, daysAgo, FIVE_ELIGIBLE, NOW, prospectOf, prospectStates, resetOutreach, seed, segment, signInFounder, type AwardSpec } from "./helpers";

/**
 * Where the two retention rules meet. The contact rows taken from notices
 * (`supplier_contacts`) lose a person's address after a month — unless a list still holds
 * that address, in which case the row waits for the outreach module to erase its copy. And
 * a row whose address is gone is never offered to a list again. All data is fictional.
 */
const HEATH: AwardSpec = { company: "Heath Roofing Ltd", coh: "05050505", email: "sam.taylor@heathroofing.example", publishedDaysAgo: 7 };
const YEW: AwardSpec = { company: "Yew Joinery Ltd", coh: "05353535", email: "pat.jones@yewjoinery.example", publishedDaysAgo: 8 };
const NAMED = [HEATH.email!, YEW.email!];
const TODAY = NOW.toISOString().slice(0, 10);
const HOUR = 3_600_000;
const at = (days: number, hours = 0) => new Date(NOW.getTime() + days * DAY_MS + hours * HOUR);
/** A named address may be written to for 30 days from the day it was stored: one day before NOW in these fixtures. */
const CONTACT_BY = at(29);

type Row = { email: string; kind: string; erased: boolean };
const contactRows = async (): Promise<Row[]> => [...(await db.execute<Row>(sql`select email, kind, erased_at is not null as erased from supplier_contacts order by email_domain, email`))];
/** Addresses the contact rows still hold. */
const held = async () => (await contactRows()).filter((row) => !row.erased).map((row) => row.email);
const GENERIC = FIVE_ELIGIBLE.map((spec) => spec.email!).sort();

describe("contact rows of addresses that are on a list", () => {
  let campaignId: string;

  beforeEach(async () => {
    await resetOutreach();
    await signInFounder();
    await seed([...FIVE_ELIGIBLE, HEATH, YEW]);
    campaignId = (await createCampaign({ name: "Week one", segment: segment({ mailbox: "generic_and_named" }), templateVariant: "s1" }, NOW)).campaignId;
    expect(await prospectStates(campaignId)).toHaveLength(7);
  });

  it("listed but never written to: the list's copy and the contact row go on the same day, in that order", async () => {
    const before = new Date(CONTACT_BY.getTime() - HOUR);
    expect(await runOutreachRetention(before)).toMatchObject({ outreachProspectsErased: 0 });
    expect(await runContactRetention(before)).toEqual({ supplierContactsErased: 0 });

    const after = new Date(CONTACT_BY.getTime() + HOUR);
    // While the list still holds the two addresses, their contact rows are not ours to erase…
    expect(await runContactRetention(after)).toEqual({ supplierContactsErased: 0 });
    expect(await held()).toEqual(expect.arrayContaining(NAMED));
    // …so the daily job runs the outreach step first, and this one right after it.
    expect(await runOutreachRetention(after)).toMatchObject({ outreachProspectsErased: 2 });
    expect(await runContactRetention(after)).toEqual({ supplierContactsErased: 2 });

    expect((await held()).sort()).toEqual(GENERIC); // role mailboxes of companies: untouched
    expect((await contactRows()).filter((row) => row.erased).map((row) => [row.kind, /^erased:[0-9a-f]{16}$/.test(row.email)])).toEqual([
      ["named", true],
      ["named", true],
    ]);
    expect((await prospectOf("Heath Roofing Ltd")).email).toBeNull();
    // Nothing is left of the two addresses in either table.
    const [left] = await db.execute<{ n: number }>(sql`
      select (select count(*) from supplier_contacts c where c::text ilike '%sam.taylor%' or c::text ilike '%pat.jones%')::int
           + (select count(*) from outreach_prospects p where p.email ilike '%sam.taylor%' or p.email ilike '%pat.jones%')::int as n
    `);
    expect(left!.n).toBe(0);
    expect(await runContactRetention(new Date(after.getTime() + HOUR))).toEqual({ supplierContactsErased: 0 });
  });

  it("written to: the contact row keeps the address until the list erases its copy, 90 days after the letter", async () => {
    await exportCampaignCsv(campaignId, "first", NOW);
    await markProspectsSent({ campaignId, sentOn: TODAY, allExported: true }, NOW);

    // Past the month, but the person was told in time and the letter promised 90 days.
    expect(await runOutreachRetention(at(31))).toMatchObject({ outreachProspectsErased: 0 });
    expect(await runContactRetention(at(31))).toEqual({ supplierContactsErased: 0 });
    expect(await runContactRetention(at(89))).toEqual({ supplierContactsErased: 0 });
    expect(await held()).toEqual(expect.arrayContaining(NAMED));

    expect(await runOutreachRetention(at(91))).toMatchObject({ outreachProspectsErased: 2 });
    expect(await runContactRetention(at(91))).toEqual({ supplierContactsErased: 2 });
    expect((await held()).sort()).toEqual(GENERIC);
    // A reminder can still be exported to the companies written to at a role mailbox.
    expect((await exportCampaignCsv(campaignId, "reminder_1", at(91))).count).toBe(5);
  });
});

describe("a contact row whose address was erased is never offered to a list", () => {
  beforeEach(async () => {
    await resetOutreach();
    await signInFounder();
  });

  it("is counted as not eligible, and a company is listed by the address it still has", async () => {
    await seed([
      { company: "Acme Grounds Ltd", coh: "01111111", email: "tenders@acmegrounds.example", publishedDaysAgo: 2 },
      HEATH, // a named address only
      // Two notices, two addresses: a person's and a role mailbox.
      { ...YEW, publishedDaysAgo: 4 },
      { ...YEW, email: "info@yewjoinery.example", publishedDaysAgo: 3, title: "Joinery repairs" },
    ]);
    await db.execute(sql`update supplier_contacts set first_ingested_at = ${daysAgo(31).toISOString()}::timestamptz where kind = 'named'`);
    // Before: the two named addresses are past their month, and say so.
    const stale = await previewSegment(segment({ mailbox: "generic_and_named" }), NOW);
    expect(stale.summary.notEligibleByReason).toEqual({ named_address_past_one_month: 2 });

    expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 2 });

    const preview = await previewSegment(segment({ mailbox: "generic_and_named" }), NOW);
    expect(preview.rows.map((row) => [row.company, row.emailKind])).toEqual([
      ["Acme Grounds Ltd", "generic"],
      ["Yew Joinery Ltd", "generic"],
    ]);
    expect(preview.summary).toMatchObject({ companiesMatched: 3, addressesConsidered: 4, listed: 2, listedGeneric: 2, listedNamed: 0 });
    // The gate refuses a placeholder as "not an e-mail address"; nothing else is asked of it.
    expect(preview.summary.notEligibleByReason).toEqual({ invalid_email: 2 });
    expect(preview.summary.excluded).toMatchObject({ not_eligible: 2, suppressed: 0, duplicate_company: 0 });

    const { campaignId } = await createCampaign({ name: "Week two", segment: segment({ mailbox: "generic_and_named" }), templateVariant: "s1" }, NOW);
    const listed = await prospectStates(campaignId);
    expect(listed.map((prospect) => `${prospect.company}: ${prospect.email}`).sort()).toEqual(["Acme Grounds Ltd: tenders@acmegrounds.example", "Yew Joinery Ltd: info@yewjoinery.example"]);
    const exported = await exportCampaignCsv(campaignId, "first", NOW);
    expect(exported.count).toBe(2);
    expect(exported.csv).not.toContain("erased:");
  });
});
