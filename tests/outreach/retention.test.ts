import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
// A UK representative is appointed here, so the list can hold named addresses.
vi.mock("@/config/site", async () => (await import("./mocks/site")).siteModule(true));

import { RETENTION_DAYS } from "@/config/retention";
import { db } from "@/db";
import { outreachAudit, outreachProspects, suppressions } from "@/db/schema";
import { buildSelection, createCampaign } from "@/features/outreach/server/builder";
import { exportCampaignCsv, getCampaign, markProspectsSent } from "@/features/outreach/server/campaigns";
import { getOutreachResults } from "@/features/outreach/server/results";
import { runOutreachRetention } from "@/features/outreach/server/retention";
import { addSuppressionEntry } from "@/features/outreach/server/suppression-store";
import { runMaintenance } from "@/lib/maintenance";
import { count, DAY_MS, daysAgo, FIVE_ELIGIBLE, NOW, prospectOf, prospectStates, resetOutreach, seed, segment, signInFounder, type AwardSpec } from "./helpers";

/**
 * Retention of prospect lists (src/config/retention.ts). The rows stay — the counts and the
 * record of first contact depend on them — and the personal part goes. All data is fictional.
 */
const HEATH: AwardSpec = { company: "Heath Roofing Ltd", coh: "05050505", email: "sam.taylor@heathroofing.example", publishedDaysAgo: 7 };
const YEW: AwardSpec = { company: "Yew Joinery Ltd", coh: "05353535", email: "pat.jones@yewjoinery.example", publishedDaysAgo: 8 };
const TODAY = NOW.toISOString().slice(0, 10);
const HOUR = 3_600_000;
const at = (days: number, hours = 0) => new Date(NOW.getTime() + days * DAY_MS + hours * HOUR);
/** A named address may be written to for 30 days from the day it was stored: one day before NOW in these fixtures. */
const CONTACT_BY = at(29);

let campaignId: string;

const row = async (company: string) => {
  const prospect = await prospectOf(company);
  const [full] = await db.select().from(outreachProspects).where(eq(outreachProspects.id, prospect.id));
  return full!;
};

describe("outreach retention", () => {
  beforeEach(async () => {
    await resetOutreach();
    await signInFounder();
    await seed([...FIVE_ELIGIBLE, HEATH, YEW]);
    campaignId = (await createCampaign({ name: "Week one", segment: segment({ mailbox: "generic_and_named" }), templateVariant: "s1" }, NOW)).campaignId;
    expect(await count("outreach_prospects")).toBe(7);
  });

  it("documents the three periods, and each named address carries its own contact-by date", async () => {
    expect(RETENTION_DAYS).toMatchObject({ outreachProspects: 365, outreachNamedAddresses: 90, outreachAudit: 730 });
    expect((await row("Heath Roofing Ltd")).eligibility).toMatchObject({ personalData: true, contactBy: CONTACT_BY.toISOString() });
    expect((await row("Acme Grounds Ltd")).eligibility).toMatchObject({ personalData: false, contactBy: null });
  });

  it("a named address that was never written to is erased once its month is over", async () => {
    // Yew was exported (the letter may have gone out in time and simply not been marked); Heath never left the tool.
    const yew = await prospectOf("Yew Joinery Ltd");
    await db.update(outreachProspects).set({ status: "exported", exportedAt: NOW }).where(eq(outreachProspects.id, yew.id));

    expect(await runOutreachRetention(new Date(CONTACT_BY.getTime() - HOUR))).toMatchObject({ outreachProspectsErased: 0 });
    expect((await row("Heath Roofing Ltd")).email).toBe("sam.taylor@heathroofing.example");

    expect(await runOutreachRetention(new Date(CONTACT_BY.getTime() + HOUR))).toMatchObject({ outreachProspectsErased: 2 });
    const heath = await row("Heath Roofing Ltd");
    expect(heath).toMatchObject({ email: null, status: "skipped", skippedReason: "contact_window_expired" });
    expect(heath.erasedAt).not.toBeNull();
    expect(heath.emailHash).toMatch(/^[0-9a-f]{64}$/); // the fingerprint stays for the cool-off rule
    expect(heath.mergeFields).not.toBeNull(); // the row still says which award it was about
    // An exported row keeps its status, so a letter that did go out in time can still be recorded.
    expect(await row("Yew Joinery Ltd")).toMatchObject({ email: null, status: "exported", skippedReason: null });
    expect(await markProspectsSent({ campaignId, sentOn: at(20).toISOString().slice(0, 10), prospectIds: [yew.id] }, at(30))).toMatchObject({ marked: 1 });
    // Generic mailboxes are not personal data: untouched.
    expect((await row("Acme Grounds Ltd")).email).toBe("tenders@acmegrounds.example");

    const [logged] = await db.select().from(outreachAudit).where(eq(outreachAudit.action, "retention.erased"));
    expect(logged).toMatchObject({ actorId: null, count: 2, metadata: { contactWindowExpired: 2, namedAfterDays: 0, afterCampaign: 0 } });
    // Nothing more to do on the next run.
    expect(await runOutreachRetention(new Date(CONTACT_BY.getTime() + 2 * HOUR))).toEqual({ outreachProspectsErased: 0, outreachAudit: 0, outreachContactsStamped: 0 });
  });

  it("a named address that was written to is erased 90 days after the letter, as the letter says", async () => {
    await exportCampaignCsv(campaignId, "first", NOW);
    await markProspectsSent({ campaignId, sentOn: TODAY, allExported: true }, NOW);

    expect(await runOutreachRetention(at(89))).toMatchObject({ outreachProspectsErased: 0 });
    expect(await runOutreachRetention(at(91))).toMatchObject({ outreachProspectsErased: 2 });
    for (const company of ["Heath Roofing Ltd", "Yew Joinery Ltd"]) {
      const named = await row(company);
      expect(named).toMatchObject({ email: null, status: "sent" });
      expect(named.sentAt).not.toBeNull(); // the record of first contact stays
      expect(named.emailHash).not.toBeNull();
    }
    expect((await row("Acme Grounds Ltd")).email).toBe("tenders@acmegrounds.example");
    const [logged] = await db.select().from(outreachAudit).where(eq(outreachAudit.action, "retention.erased"));
    expect(logged!.metadata).toEqual({ contactWindowExpired: 0, namedAfterDays: 2, afterCampaign: 0 });
    // The erased address cannot be exported again, and the company is still inside its cool-off.
    expect((await getCampaign(campaignId, at(91))).prospects.find((prospect) => prospect.company === "Heath Roofing Ltd")).toMatchObject({ erased: true, status: "sent" });
    expect((await exportCampaignCsv(campaignId, "reminder_1", at(91))).count).toBe(5);
  });

  it("twelve months after the campaign every address and letter is erased — and the counts stay", async () => {
    await exportCampaignCsv(campaignId, "first", NOW);
    await markProspectsSent({ campaignId, sentOn: TODAY, firstExported: 4 }, NOW);
    const before = await getOutreachResults(campaignId, at(1));

    expect(await runOutreachRetention(at(364))).toMatchObject({ outreachProspectsErased: 2 }); // only the two named addresses, by the rules above
    expect((await row("Acme Grounds Ltd")).email).toBe("tenders@acmegrounds.example");

    const summary = await runOutreachRetention(at(366));
    expect(summary).toMatchObject({ outreachProspectsErased: 7 });
    const rows = await db.select().from(outreachProspects);
    expect(rows).toHaveLength(7);
    expect(rows.every((prospect) => prospect.email === null && prospect.emailHash === null && prospect.mergeFields === null && prospect.erasedAt !== null)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("@");
    // What the tool needs for its numbers is still there: status, dates, the link code.
    expect(rows.filter((prospect) => prospect.sentAt !== null)).toHaveLength(4);
    expect(new Set(rows.map((prospect) => prospect.refCode)).size).toBe(7);
    const after = await getOutreachResults(campaignId, at(366));
    expect(after.counts).toMatchObject({ sent: before.counts.sent, visited: before.counts.visited, claimed: before.counts.claimed });
    expect(after.totals).toMatchObject({ prospects: 7 });
    const detail = await getCampaign(campaignId, at(366));
    expect(detail.prospects.every((prospect) => prospect.erased && prospect.award === null)).toBe(true);
    expect(detail.exportable).toEqual({ first: 0, reminder_1: 0, reminder_2: 0 });

    // Idempotent.
    expect(await runOutreachRetention(at(367))).toEqual({ outreachProspectsErased: 0, outreachAudit: 0, outreachContactsStamped: 0 });
    // An opted-out company stays blocked after its row is anonymous; once the cool-off has
    // passed, everyone else can be listed again (seen here as if the list were 400 days old).
    await db.update(outreachProspects).set({ status: "opted_out", optedOutAt: at(2) }).where(eq(outreachProspects.id, (await prospectOf("Acme Grounds Ltd")).id));
    await db.execute(sql`
      update outreach_prospects set created_at = ${daysAgo(400).toISOString()}::timestamptz, exported_at = ${daysAgo(400).toISOString()}::timestamptz,
        sent_at = case when sent_at is null then null else ${daysAgo(400).toISOString()}::timestamptz end
    `);
    const selection = await buildSelection(segment(), NOW);
    expect(selection.prospects.map((prospect) => prospect.supplier.name).sort()).toEqual(["Brightway Cleaning Ltd", "Castle Roofing Ltd", "Dale Facilities LLP", "Elm Care Ltd"]);
    expect(selection.summary.excluded).toMatchObject({ suppressed: 1, cool_off: 0 });
  });

  it("never purges the do-not-contact list, and trims the audit trail after two years", async () => {
    await addSuppressionEntry({ kind: "email", value: "tenders@acmegrounds.example", domain: "acmegrounds.example" }, { reason: "optout", source: "optout_link" });
    await db.update(suppressions).set({ createdAt: daysAgo(2_000) });
    await db.insert(outreachAudit).values([
      { action: "campaign.exported", count: 3, createdAt: daysAgo(RETENTION_DAYS.outreachAudit + 1) },
      { action: "campaign.exported", count: 4, createdAt: daysAgo(RETENTION_DAYS.outreachAudit - 1) },
    ]);
    const summary = await runOutreachRetention(NOW);
    expect(summary).toMatchObject({ outreachAudit: 1, outreachProspectsErased: 0 });
    expect(await count("suppressions")).toBe(1);
    expect((await db.select().from(outreachAudit).where(eq(outreachAudit.action, "campaign.exported"))).map((entry) => entry.count)).toEqual([4]);
  });

  it("runs with the daily maintenance job, and a second run finds nothing left", async () => {
    const first = await runMaintenance();
    for (const key of ["outreachProspectsErased", "outreachAudit", "outreachContactsStamped"] as const) expect(typeof first[key]).toBe("number");
    const second = await runMaintenance();
    expect(second).toMatchObject({ outreachProspectsErased: 0, outreachAudit: 0, outreachContactsStamped: 0 });
    // Whatever it erased, no row is ever deleted: the counts and the link codes stay.
    expect(await prospectStates(campaignId)).toHaveLength(7);
  });
});
