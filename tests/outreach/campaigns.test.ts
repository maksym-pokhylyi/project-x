import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/navigation", async () => (await import("./mocks/next")).navigation);
vi.mock("next/cache", async () => (await import("./mocks/next")).cache);
// A UK representative is appointed here, so a list may hold named addresses.
vi.mock("@/config/site", async () => (await import("./mocks/site")).siteModule(true));

import { POST as exportRoute } from "@/app/admin/outreach/campaigns/[id]/export/route";
import { db } from "@/db";
import { outreachAudit, outreachCampaigns, outreachProspects, suppliers, suppressions } from "@/db/schema";
import { clearSentAction, createCampaignAction, discardCampaignAction, markSentAction } from "@/features/outreach/actions";
import { CSV_BOM, parseCsv } from "@/features/outreach/domain/csv";
import { buildSelection, createCampaign } from "@/features/outreach/server/builder";
import { clearSentMarks, discardCampaign, EXPORT_COLUMNS, exportCampaignCsv, getCampaign, getProspectLetter, listOutreachAudit, markProspectsSent } from "@/features/outreach/server/campaigns";
import { readFlashError } from "@/features/outreach/server/flash";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { TestUser } from "../helpers/auth";
import { count, DAY_MS, daysAgo, FIVE_ELIGIBLE, NOW, prospectOf, prospectStates, resetOutreach, seed, segment, signInFounder, submit, type AwardSpec } from "./helpers";
import { TEST_REPRESENTATIVE } from "./mocks/site";

/**
 * A campaign after it exists: the exported file, "mark as sent", corrections and discarding.
 * All data is fictional; every address is on a reserved `.example` domain.
 */
const NAMED: AwardSpec = { company: "Heath Roofing Ltd", coh: "05050505", email: "sam.taylor@heathroofing.example", publishedDaysAgo: 7, cpv: ["45261210"], title: "Roof Repairs Phase 2" };
const TODAY = NOW.toISOString().slice(0, 10);
const ORIGIN = "http://localhost:3000";

let founder: TestUser;

/** Five generic prospects and one named one, in a campaign created at NOW. */
async function campaignOfSix(): Promise<string> {
  await seed([...FIVE_ELIGIBLE, NAMED]);
  const created = await createCampaign({ name: "Week one", segment: segment({ mailbox: "generic_and_named" }), templateVariant: "s1" }, NOW);
  expect(created.listed).toBe(6);
  return created.campaignId;
}

type ExportRecord = Record<(typeof EXPORT_COLUMNS)[number], string>;

/** The exported file as records keyed by column name. */
function records(csv: string): ExportRecord[] {
  const [header, ...rows] = parseCsv(csv);
  return rows.map((row) => Object.fromEntries(header!.map((column, index) => [column, row[index] ?? ""])) as ExportRecord);
}

const exportRequest = (campaignId: string, init: { origin?: string; letter?: string } = {}) =>
  exportRoute(
    new Request(`${ORIGIN}/admin/outreach/campaigns/${campaignId}/export`, {
      method: "POST",
      headers: { origin: init.origin ?? ORIGIN, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ letter: init.letter ?? "first" }).toString(),
    }),
    { params: Promise.resolve({ id: campaignId }) },
  );

describe("outreach campaigns", () => {
  beforeEach(async () => {
    await resetOutreach();
    founder = await signInFounder();
    // The forms and the download route read the clock themselves. Pin it to the day the
    // fixtures are written for, so that "published in the last 30 days" stays true.
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("export", () => {
    it("writes one row per letter: address, rendered subject and body, both links, the code", async () => {
      const campaignId = await campaignOfSix();
      const exported = await exportCampaignCsv(campaignId, "first", NOW);
      expect(exported).toMatchObject({ count: 6, leftOut: 0, filename: `outreach-week-one-first-${TODAY}.csv` });
      expect(exported.csv.startsWith(CSV_BOM)).toBe(true);
      expect(parseCsv(exported.csv)[0]).toEqual([...EXPORT_COLUMNS]);
      expect(parseCsv(exported.csv)[0]).toEqual(["email", "company", "first_name", "subject", "body", "page_link", "optout_link", "contact_by", "ref_code"]);

      const rows = records(exported.csv);
      expect(rows).toHaveLength(6);
      const acme = rows.find((row) => row.company === "Acme Grounds Ltd")!;
      const prospect = await prospectOf("Acme Grounds Ltd");
      expect(acme).toMatchObject({
        email: "tenders@acmegrounds.example",
        first_name: "", // a contact's name is never stored
        subject: "Acme Grounds Ltd: your public contract awards on one page (from Bidfolio)",
        page_link: `${ORIGIN}/suppliers/acme-grounds-ltd-01111111?r=${prospect.refCode}`,
        optout_link: `${ORIGIN}/optout?c=${prospect.refCode}`,
        contact_by: "",
        ref_code: prospect.refCode,
      });
      // The letter is the kit's variant A with this company's award, and carries every legal line.
      expect(acme.body).toContain('Acme Grounds Ltd is named as the supplier on "Grounds Maintenance Services" for Leeds City Council (£120,000), in a contract notice published on Find a Tender on 11 November 2026.');
      expect(acme.body).toContain(acme.page_link);
      expect(acme.body).toContain(`To stop these emails, reply "stop" or use this link: ${acme.optout_link}`);
      expect(acme.body).toContain("We will not contact Acme Grounds Ltd again.");
      expect(acme.body).toContain(`Privacy notice: ${ORIGIN}/legal/privacy#contacted`);
      expect(acme.body).toMatch(/Bidfolio is operated by .+, an independent sole trader registered in Ukraine \(legal name .+\)\. .+ Contact: hello@bidfolio\.co\.uk\./);
      expect(acme.body).toContain("Contains public sector information licensed under the Open Government Licence v3.0.");
      expect(acme.body).not.toContain("Where we got your details"); // a generic mailbox is not personal data
      expect(acme.body.match(/https?:\/\/\S+/g)).toHaveLength(3); // the page, the opt-out, the privacy notice — nothing else

      // The named address: variant B, the Art. 14 paragraph, the representative and its contact-by date.
      const heath = rows.find((row) => row.company === "Heath Roofing Ltd")!;
      expect(heath.email).toBe("sam.taylor@heathroofing.example");
      expect(heath.contact_by).toBe(new Date(daysAgo(1).getTime() + 30 * DAY_MS).toISOString().slice(0, 10));
      expect(heath.body).toContain("I am writing to this address because the public notice for");
      expect(heath.body).toContain("Where we got your details: this address appears as the supplier contact in the public contract notice mentioned above");
      expect(heath.body).toContain("delete it after 90 days if you do not reply");
      expect(heath.body).toContain(`UK data-protection representative: ${TEST_REPRESENTATIVE}.`);

      // Every link code in the file is that row's own.
      expect(new Set(rows.map((row) => row.ref_code)).size).toBe(6);
      for (const row of rows) expect(row.body).toContain(`?r=${row.ref_code}`);
    });

    it("marks the rows as exported and logs who, when and how many — not whom", async () => {
      const campaignId = await campaignOfSix();
      await exportCampaignCsv(campaignId, "first", NOW);
      const states = await prospectStates(campaignId);
      expect(states.every((prospect) => prospect.status === "exported" && prospect.exportedAt?.getTime() === NOW.getTime() && prospect.sentAt === null)).toBe(true);
      const [campaign] = await db.select().from(outreachCampaigns).where(eq(outreachCampaigns.id, campaignId));
      expect(campaign!.exportedAt?.getTime()).toBe(NOW.getTime());

      const audit = await db.select().from(outreachAudit).where(eq(outreachAudit.action, "campaign.exported"));
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ actorId: founder.id, campaignId, count: 6, metadata: { letter: "first", leftOut: 0, named: 1 } });
      expect(JSON.stringify(await db.select().from(outreachAudit))).not.toContain("@");

      // Exporting again (the file was lost) gives the same rows and keeps the first export time.
      const later = new Date(NOW.getTime() + DAY_MS);
      expect((await exportCampaignCsv(campaignId, "first", later)).count).toBe(6);
      expect((await prospectStates(campaignId)).every((prospect) => prospect.exportedAt?.getTime() === NOW.getTime())).toBe(true);
      expect(await count("outreach_audit")).toBe(3); // created + two exports
    });

    it("checks the do-not-contact list, removals and the contact-by date again at every export", async () => {
      const campaignId = await campaignOfSix();
      // Things that happened after the list was built, written straight to the tables
      // (the ordinary paths update the prospects themselves; the export must not rely on that).
      await db.insert(suppressions).values({ email: "tenders@acmegrounds.example", reason: "optout", source: "admin" });
      await db.insert(suppressions).values({ domain: "brightway.example", reason: "complaint", source: "admin" });
      await db.update(suppliers).set({ removedAt: NOW }).where(eq(suppliers.name, "Castle Roofing Ltd"));
      // The named address is now one day past its month.
      const afterWindow = new Date(daysAgo(1).getTime() + 31 * DAY_MS);

      const exported = await exportCampaignCsv(campaignId, "first", afterWindow);
      expect(records(exported.csv).map((row) => row.company).sort()).toEqual(["Dale Facilities LLP", "Elm Care Ltd"]);
      expect(exported).toMatchObject({ count: 2, leftOut: 4 });
      const states = Object.fromEntries((await prospectStates(campaignId)).map((prospect) => [prospect.company, [prospect.status, prospect.skippedReason]]));
      expect(states).toEqual({
        "Acme Grounds Ltd": ["skipped", "suppressed"],
        "Brightway Cleaning Ltd": ["skipped", "suppressed"],
        "Castle Roofing Ltd": ["skipped", "suppressed"],
        "Heath Roofing Ltd": ["skipped", "contact_window_expired"],
        "Dale Facilities LLP": ["exported", null],
        "Elm Care Ltd": ["exported", null],
      });
      // The page shows the same numbers before the button is pressed.
      expect((await getCampaign(campaignId, afterWindow)).exportable).toEqual({ first: 2, reminder_1: 0, reminder_2: 0 });
    });

    it("leaves out a company that opted out through another list", async () => {
      await seed([
        { company: "Brightway Cleaning Ltd", coh: "02222222", email: "info@brightway.example", publishedDaysAgo: 2 },
        { company: "Brightway Cleaning Ltd", coh: "02222222", email: "tenders@brightway-group.example", publishedDaysAgo: 9, title: "Window Cleaning" },
      ]);
      const first = await createCampaign({ name: "First", segment: segment(), templateVariant: "s1" }, NOW);
      // The same company on a later list, once the cool-off has passed.
      await db.update(outreachProspects).set({ createdAt: daysAgo(200) });
      const second = await createCampaign({ name: "Second", segment: segment(), templateVariant: "s1" }, NOW);
      expect(second.listed).toBe(1);
      await db.update(outreachProspects).set({ status: "opted_out", optedOutAt: NOW }).where(eq(outreachProspects.campaignId, first.campaignId));

      const exported = await exportCampaignCsv(second.campaignId, "first", NOW);
      expect(exported).toMatchObject({ count: 0, leftOut: 1 });
      expect((await prospectStates(second.campaignId))[0]).toMatchObject({ status: "skipped", skippedReason: "suppressed" });
    });

    it("guards the file against formulas: a company name cannot make a spreadsheet run anything", async () => {
      await seed([{ company: "=HYPERLINK(1) Services Ltd", coh: "07171717", email: "info@formula.example", publishedDaysAgo: 2 }]);
      const created = await createCampaign({ name: "Formula", segment: segment(), templateVariant: "s1" }, NOW);
      const { csv } = await exportCampaignCsv(created.campaignId, "first", NOW);
      const [row] = records(csv);
      expect(row!.company).toBe("'=HYPERLINK(1) Services Ltd");
      expect(row!.subject.startsWith("'=HYPERLINK(1) Services Ltd:")).toBe(true);
      // Every field is quoted, records end with CRLF and the body keeps its line breaks inside one field.
      const lines = csv.slice(1).split("\r\n");
      expect(lines[0]).toBe(EXPORT_COLUMNS.map((column) => `"${column}"`).join(","));
      expect(csv.endsWith('"\r\n')).toBe(true);
      expect(row!.body).toContain("\r\n\r\nI run Bidfolio");
    });

    it("exports reminders only to companies that were written to and have not opted out", async () => {
      const campaignId = await campaignOfSix();
      await exportCampaignCsv(campaignId, "first", NOW);
      expect((await exportCampaignCsv(campaignId, "reminder_1", NOW)).count).toBe(0); // nothing is marked as sent yet

      const [acme, brightway, castle] = [await prospectOf("Acme Grounds Ltd"), await prospectOf("Brightway Cleaning Ltd"), await prospectOf("Castle Roofing Ltd")];
      await markProspectsSent({ campaignId, sentOn: TODAY, prospectIds: [acme.id, brightway.id, castle.id] }, NOW);
      await db.update(outreachProspects).set({ status: "opted_out", optedOutAt: NOW }).where(eq(outreachProspects.id, brightway.id));
      await db.insert(suppressions).values({ email: "bids@castleroofing.example", reason: "bounce", source: "bounce_import" });

      const reminder = await exportCampaignCsv(campaignId, "reminder_1", new Date(NOW.getTime() + 4 * DAY_MS));
      const rows = records(reminder.csv);
      expect(rows.map((row) => row.company)).toEqual(["Acme Grounds Ltd"]);
      expect(rows[0]!.body).toContain("A short reminder about the page I built from Acme Grounds Ltd's published contract awards");
      expect(rows[0]!.body).toContain("To stop these emails");
      expect(reminder.filename).toContain("reminder-1");
      // A reminder changes no status and no first-contact date.
      expect(await prospectOf("Acme Grounds Ltd")).toMatchObject({ status: "sent", exportedAt: NOW });
      // The first letter is never exported twice for a company that already has a date.
      expect(records((await exportCampaignCsv(campaignId, "first", NOW)).csv).map((row) => row.company)).not.toContain("Acme Grounds Ltd");
    });

    it("the download route: a CSV attachment that is never cached; a reason and a way back when there is nothing to export", async () => {
      const campaignId = await campaignOfSix();
      const response = await exportRequest(campaignId);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="outreach-week-one-first-\d{4}-\d{2}-\d{2}\.csv"$/);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(records(await response.text())).toHaveLength(6);

      // A request from another site is refused before anything is read or marked.
      expect((await exportRequest(campaignId, { origin: "https://evil.example" })).status).toBe(403);
      // An unknown letter falls back to the first letter rather than failing.
      expect((await exportRequest(campaignId, { letter: "everything" })).status).toBe(200);

      await markProspectsSent({ campaignId, sentOn: TODAY, allExported: true }, NOW);
      const nothing = await exportRequest(campaignId);
      expect(nothing.status).toBe(303);
      const location = new URL(nothing.headers.get("location")!, ORIGIN);
      expect(location.pathname).toBe(`/admin/outreach/campaigns/${campaignId}`);
      const params = Object.fromEntries(location.searchParams);
      expect(readFlashError(params)).toContain("Nothing to export");
      // The page shows only words this server wrote: changed text, or text without a signature, is dropped.
      expect(readFlashError({ ...params, error: "Your session has expired. Sign in at evil.example" })).toBeNull();
      expect(readFlashError({ error: params.error })).toBeNull();

      expect((await exportRequest("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    });
  });

  describe("what the page shows", () => {
    it("lists companies with their state — and no address anywhere", async () => {
      const campaignId = await campaignOfSix();
      const detail = await getCampaign(campaignId, NOW);
      expect(detail.campaign).toMatchObject({ name: "Week one", templateVariant: "s1", counts: { total: 6, listed: 6, exported: 0, sent: 0, optedOut: 0, skipped: 0, named: 1 } });
      expect(detail.campaign.buildSummary).toMatchObject({ listed: 6, listedGeneric: 5, listedNamed: 1 });
      expect(detail.prospects).toHaveLength(6);
      expect(detail.prospects.find((prospect) => prospect.company === "Heath Roofing Ltd")).toMatchObject({ emailKind: "named", status: "listed", exportable: true, visits: 0 });
      expect(detail.prospects.find((prospect) => prospect.company === "Heath Roofing Ltd")!.contactBy).not.toBeNull();
      expect(detail.prospects.find((prospect) => prospect.company === "Acme Grounds Ltd")).toMatchObject({ emailKind: "generic", contactBy: null, companyNumber: "01111111", award: { buyer: "Leeds City Council", value: "£120,000" } });
      expect(detail).toMatchObject({ exportable: { first: 6, reminder_1: 0, reminder_2: 0 }, senderProblems: [], canDiscard: true, linkOrigin: ORIGIN });
      expect(JSON.stringify(detail)).not.toContain("@");
      await expect(getCampaign("00000000-0000-4000-8000-000000000000", NOW)).rejects.toBeInstanceOf(NotFoundError);
      await expect(getCampaign("not-an-id", NOW)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("previews one company's letter exactly as it would be exported", async () => {
      const campaignId = await campaignOfSix();
      const acme = await prospectOf("Acme Grounds Ltd");
      const letter = await getProspectLetter(campaignId, acme.id);
      const { csv } = await exportCampaignCsv(campaignId, "first", NOW);
      const row = records(csv).find((entry) => entry.company === "Acme Grounds Ltd")!;
      expect(letter).toMatchObject({ company: "Acme Grounds Ltd", variant: "A", subject: row.subject });
      expect(letter!.body.replace(/\n/g, "\r\n")).toBe(row.body);
      expect((await getProspectLetter(campaignId, acme.id, "reminder_2"))!.variant).toBe("R2");
      expect(await getProspectLetter(campaignId, "00000000-0000-4000-8000-000000000000")).toBeNull();
      expect(await getProspectLetter(campaignId, "nonsense")).toBeNull();
    });
  });

  describe("mark as sent", () => {
    it("records the date for a partial selection, once", async () => {
      const campaignId = await campaignOfSix();
      await exportCampaignCsv(campaignId, "first", NOW);
      const [acme, brightway] = [await prospectOf("Acme Grounds Ltd"), await prospectOf("Brightway Cleaning Ltd")];

      const marked = await markProspectsSent({ campaignId, sentOn: TODAY, prospectIds: [acme.id, brightway.id] }, NOW);
      expect(marked).toEqual({ marked: 2, notChanged: 0, shortBy: 0, afterContactBy: 0, sentOn: TODAY });
      expect(await prospectOf("Acme Grounds Ltd")).toMatchObject({ status: "sent", sentAt: new Date(`${TODAY}T12:00:00.000Z`) });
      expect(await prospectOf("Castle Roofing Ltd")).toMatchObject({ status: "exported", sentAt: null });
      expect((await getCampaign(campaignId, NOW)).campaign.counts).toMatchObject({ sent: 2, exported: 4 });

      const audit = await db.select().from(outreachAudit).where(eq(outreachAudit.action, "campaign.marked_sent"));
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ actorId: founder.id, campaignId, count: 2, metadata: { sentOn: TODAY, afterContactBy: 0 } });

      // The record of first contact is not overwritten by a second press or a later date.
      const castle = await prospectOf("Castle Roofing Ltd");
      const again = await markProspectsSent({ campaignId, sentOn: TODAY, prospectIds: [acme.id, brightway.id, castle.id] }, new Date(NOW.getTime() + 3 * DAY_MS));
      expect(again).toMatchObject({ marked: 1, notChanged: 2 });
      expect((await prospectOf("Acme Grounds Ltd")).sentAt).toEqual(new Date(`${TODAY}T12:00:00.000Z`));
    });

    it("marks a day's batch by count, in the order of the list and of the exported file", async () => {
      const campaignId = await campaignOfSix();
      const { csv } = await exportCampaignCsv(campaignId, "first", NOW);
      const fileOrder = records(csv).map((row) => row.company);
      expect((await prospectStates(campaignId)).map((prospect) => prospect.company)).toEqual(fileOrder);

      expect(await markProspectsSent({ campaignId, sentOn: TODAY, firstExported: 2 }, NOW)).toMatchObject({ marked: 2, shortBy: 0 });
      const sent = (await prospectStates(campaignId)).filter((prospect) => prospect.sentAt).map((prospect) => prospect.company);
      expect(sent).toEqual(fileOrder.slice(0, 2));
      // The next day's batch carries on where the first stopped.
      const tomorrow = new Date(NOW.getTime() + DAY_MS);
      await markProspectsSent({ campaignId, sentOn: tomorrow.toISOString().slice(0, 10), firstExported: 3 }, tomorrow);
      expect((await prospectStates(campaignId)).filter((prospect) => prospect.sentAt).map((prospect) => prospect.company)).toEqual(fileOrder.slice(0, 5));
      // Asking for more than are left marks what is left and says so.
      expect(await markProspectsSent({ campaignId, sentOn: TODAY, firstExported: 10 }, tomorrow)).toMatchObject({ marked: 1, shortBy: 9 });
      expect(await markProspectsSent({ campaignId, sentOn: TODAY, allExported: true }, tomorrow)).toMatchObject({ marked: 0 });
      await expect(markProspectsSent({ campaignId, sentOn: TODAY, firstExported: 0 }, NOW)).rejects.toBeInstanceOf(ValidationError);
      await expect(markProspectsSent({ campaignId, sentOn: TODAY, firstExported: 401 }, NOW)).rejects.toBeInstanceOf(ValidationError);
    });

    it("by count takes only what was exported; a company off the list is never marked", async () => {
      const campaignId = await campaignOfSix();
      // Nothing exported yet: there is nothing to take by count.
      expect(await markProspectsSent({ campaignId, sentOn: TODAY, firstExported: 3 }, NOW)).toMatchObject({ marked: 0, shortBy: 3 });
      const acme = await prospectOf("Acme Grounds Ltd");
      await db.update(outreachProspects).set({ status: "skipped", skippedReason: "suppressed" }).where(eq(outreachProspects.id, acme.id));
      expect(await markProspectsSent({ campaignId, sentOn: TODAY, prospectIds: [acme.id] }, NOW)).toMatchObject({ marked: 0, notChanged: 1 });
      // A listed row can be ticked (a letter copied from the preview); a row of another campaign cannot.
      const brightway = await prospectOf("Brightway Cleaning Ltd");
      expect(await markProspectsSent({ campaignId, sentOn: TODAY, prospectIds: [brightway.id] }, NOW)).toMatchObject({ marked: 1 });
      expect(await markProspectsSent({ campaignId: "00000000-0000-4000-8000-000000000000", sentOn: TODAY, prospectIds: [brightway.id] }, NOW).catch((error: unknown) => error)).toBeInstanceOf(NotFoundError);
    });

    it("keeps an opt-out an opt-out, and notes a named address written to after its date", async () => {
      const campaignId = await campaignOfSix();
      await exportCampaignCsv(campaignId, "first", NOW);
      const [acme, heath] = [await prospectOf("Acme Grounds Ltd"), await prospectOf("Heath Roofing Ltd")];
      // Acme opted out after the letter went out, before the batch was marked.
      await db.update(outreachProspects).set({ status: "opted_out", optedOutAt: NOW }).where(eq(outreachProspects.id, acme.id));
      const late = new Date(daysAgo(1).getTime() + 32 * DAY_MS);
      const marked = await markProspectsSent({ campaignId, sentOn: late.toISOString().slice(0, 10), prospectIds: [acme.id, heath.id] }, late);
      expect(marked).toMatchObject({ marked: 2, afterContactBy: 1 });
      expect(await prospectOf("Acme Grounds Ltd")).toMatchObject({ status: "opted_out" });
      expect((await prospectOf("Acme Grounds Ltd")).sentAt).not.toBeNull();
      expect((await getCampaign(campaignId, late)).campaign.counts).toMatchObject({ sent: 2, optedOut: 1 });
    });

    it("refuses a date that cannot be right, and an empty request", async () => {
      const campaignId = await campaignOfSix();
      const acme = await prospectOf("Acme Grounds Ltd");
      const mark = (sentOn: string, now = NOW) => markProspectsSent({ campaignId, sentOn, prospectIds: [acme.id] }, now);
      await expect(mark("13/11/2026")).rejects.toBeInstanceOf(ValidationError);
      await expect(mark("2026-02-30")).rejects.toBeInstanceOf(ValidationError);
      await expect(mark(new Date(NOW.getTime() + 3 * DAY_MS).toISOString().slice(0, 10))).rejects.toBeInstanceOf(ValidationError); // in the future
      await expect(mark(daysAgo(3).toISOString().slice(0, 10))).rejects.toBeInstanceOf(ValidationError); // before the list existed
      await expect(markProspectsSent({ campaignId, sentOn: TODAY, prospectIds: [] }, NOW)).rejects.toBeInstanceOf(ValidationError);
      await expect(markProspectsSent({ campaignId, sentOn: TODAY, prospectIds: ["nonsense"] }, NOW)).rejects.toBeInstanceOf(ValidationError);
      expect((await prospectStates(campaignId)).every((prospect) => prospect.sentAt === null)).toBe(true);
    });

    it("a wrong mark can be cleared, and the correction is logged", async () => {
      const campaignId = await campaignOfSix();
      const dale = await prospectOf("Dale Facilities LLP");
      // Dale is marked without ever being exported; the others after the export.
      await markProspectsSent({ campaignId, sentOn: TODAY, prospectIds: [dale.id] }, NOW);
      await exportCampaignCsv(campaignId, "first", NOW);
      await markProspectsSent({ campaignId, sentOn: TODAY, allExported: true }, NOW);
      const acme = await prospectOf("Acme Grounds Ltd");
      await db.update(outreachProspects).set({ status: "opted_out", optedOutAt: NOW }).where(eq(outreachProspects.id, acme.id));
      const [brightway, castle] = [await prospectOf("Brightway Cleaning Ltd"), await prospectOf("Castle Roofing Ltd")];

      const cleared = await clearSentMarks({ campaignId, prospectIds: [acme.id, brightway.id, dale.id] }, NOW);
      expect(cleared).toEqual({ cleared: 3, notChanged: 0 });
      expect(await prospectOf("Brightway Cleaning Ltd")).toMatchObject({ status: "exported", sentAt: null });
      expect(await prospectOf("Dale Facilities LLP")).toMatchObject({ status: "listed", sentAt: null });
      expect(await prospectOf("Acme Grounds Ltd")).toMatchObject({ status: "opted_out", sentAt: null }); // an opt-out stays an opt-out
      expect(await prospectOf("Castle Roofing Ltd")).toMatchObject({ status: "sent", sentAt: castle.sentAt });
      expect(await clearSentMarks({ campaignId, prospectIds: [brightway.id] }, NOW)).toEqual({ cleared: 0, notChanged: 1 });
      await expect(clearSentMarks({ campaignId, prospectIds: [] }, NOW)).rejects.toBeInstanceOf(ValidationError);

      const audit = await db.select().from(outreachAudit).where(eq(outreachAudit.action, "campaign.sent_cleared"));
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ actorId: founder.id, campaignId, count: 3 });
      // They can then be marked again, with the right date.
      const tomorrow = new Date(NOW.getTime() + DAY_MS);
      expect(await markProspectsSent({ campaignId, sentOn: tomorrow.toISOString().slice(0, 10), prospectIds: [brightway.id] }, tomorrow)).toMatchObject({ marked: 1 });
    });
  });

  describe("discard", () => {
    it("deletes a list that never left the tool and frees its companies", async () => {
      await seed(FIVE_ELIGIBLE);
      const created = await createCampaign({ name: "Mistake", segment: segment(), templateVariant: "s1" }, NOW);
      expect((await buildSelection(segment(), NOW)).summary.listed).toBe(0);
      expect(await discardCampaign(created.campaignId)).toEqual({ discarded: 5 });
      expect(await count("outreach_campaigns")).toBe(0);
      expect(await count("outreach_prospects")).toBe(0);
      expect((await buildSelection(segment(), NOW)).summary.listed).toBe(5);
      const audit = await db.select().from(outreachAudit).where(eq(outreachAudit.action, "campaign.discarded"));
      expect(audit[0]).toMatchObject({ count: 5, campaignId: created.campaignId });
      await expect(discardCampaign(created.campaignId)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("keeps a list that was exported: it is a record", async () => {
      const campaignId = await campaignOfSix();
      await exportCampaignCsv(campaignId, "first", NOW);
      expect((await getCampaign(campaignId, NOW)).canDiscard).toBe(false);
      await expect(discardCampaign(campaignId)).rejects.toBeInstanceOf(ConflictError);
      expect(await count("outreach_prospects")).toBe(6);
    });
  });

  describe("the forms", () => {
    it("create campaign: stores the list and goes to it; a mistake goes back to the preview with the reason", async () => {
      await seed(FIVE_ELIGIBLE);
      const created = await submit(createCampaignAction, { name: "From the form", templateVariant: "s2", notes: "", segment: JSON.stringify(segment({ batchSize: 3 })) });
      expect(created.path).toMatch(/^\/admin\/outreach\/campaigns\/[0-9a-f-]{36}$/);
      expect(Object.fromEntries(created.params)).toEqual({ notice: "created", n: "3" });
      expect(await count("outreach_prospects")).toBe(3);

      const bad = await submit(createCampaignAction, { name: "x", templateVariant: "s2", segment: JSON.stringify(segment()) });
      expect(bad.path).toBe("/admin/outreach");
      expect(bad.params.get("preview")).toBe("1"); // back on the same preview
      expect(readFlashError(Object.fromEntries(bad.params))).toBe("Give the campaign a name of 3 to 80 characters.");

      const noSegment = await submit(createCampaignAction, { name: "No segment", templateVariant: "s1", segment: "{not json" });
      expect(noSegment.path).toBe("/admin/outreach");
      expect(readFlashError(Object.fromEntries(noSegment.params))).toBeTruthy();
      expect(await count("outreach_campaigns")).toBe(1);
    });

    it("mark as sent, clear and discard answer with a notice on the campaign page", async () => {
      const campaignId = await campaignOfSix();
      await exportCampaignCsv(campaignId, "first", NOW);
      const acme = await prospectOf("Acme Grounds Ltd");
      const page = `/admin/outreach/campaigns/${campaignId}`;

      const byCount = await submit(markSentAction, { campaignId, sentOn: TODAY, scope: "first_exported", count: "2" });
      expect(byCount.path).toBe(page);
      expect(Object.fromEntries(byCount.params)).toEqual({ notice: "sent", n: "2" });

      // Pressing Enter in the date field submits "by count" with no count: a reason, and nothing marked.
      const empty = await submit(markSentAction, { campaignId, sentOn: TODAY, scope: "first_exported", count: "" });
      expect(readFlashError(Object.fromEntries(empty.params))).toBe("Enter how many companies you wrote to, or tick the rows instead.");
      const nothingTicked = await submit(markSentAction, { campaignId, sentOn: TODAY, scope: "selected" });
      expect(readFlashError(Object.fromEntries(nothingTicked.params))).toBe("Nothing is ticked.");
      expect((await prospectStates(campaignId)).filter((prospect) => prospect.sentAt)).toHaveLength(2);

      const ticked = await submit(markSentAction, { campaignId, sentOn: TODAY, scope: "selected", ids: (await prospectStates(campaignId)).map((prospect) => prospect.id) });
      expect(Object.fromEntries(ticked.params)).toEqual({ notice: "sent", n: "4", same: "2" });

      const cleared = await submit(clearSentAction, { campaignId, ids: [acme.id] });
      expect(cleared.path).toBe(page);
      expect(Object.fromEntries(cleared.params)).toEqual({ notice: "cleared", n: "1" });
      expect((await prospectOf("Acme Grounds Ltd")).sentAt).toBeNull();

      const kept = await submit(discardCampaignAction, { campaignId });
      expect(kept.path).toBe(page);
      expect(readFlashError(Object.fromEntries(kept.params))).toContain("kept as a record");
      // Nonsense in the hidden field is answered on the builder page, not with a crash.
      const lost = await submit(markSentAction, { campaignId: "nonsense", sentOn: TODAY, scope: "selected" });
      expect(lost.path).toBe("/admin/outreach");
    });
  });

  it("the audit trail names the founder and the campaign, never an address", async () => {
    const campaignId = await campaignOfSix();
    await exportCampaignCsv(campaignId, "first", NOW);
    await markProspectsSent({ campaignId, sentOn: TODAY, firstExported: 2 }, NOW);
    const trail = await listOutreachAudit(10);
    expect(trail.map((row) => row.action)).toEqual(["campaign.marked_sent", "campaign.exported", "campaign.created"]);
    expect(trail[0]).toMatchObject({ actor: "Fay Founder", campaignId, campaignName: "Week one", count: 2, metadata: { sentOn: TODAY } });
    expect(JSON.stringify(trail)).not.toContain("@");
    expect(await count("outreach_audit")).toBe(3);
  });
});
