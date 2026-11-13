import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/navigation", async () => (await import("./mocks/next")).navigation);
vi.mock("next/cache", async () => (await import("./mocks/next")).cache);
// NO UK representative: site.company.ukRepresentative is the placeholder it holds before one is appointed.
vi.mock("@/config/site", async () => (await import("./mocks/site")).siteModule(false));

import AdminOutreachPage from "@/app/admin/outreach/page";
import OptOutLayout from "@/app/optout/layout";
import { db } from "@/db";
import { outreachProspects } from "@/db/schema";
import { createCampaignAction } from "@/features/outreach/actions";
import { NAMED_ADDRESSES_BLOCKED, operatorFooterLine, outreachSender, ukRepresentativeAppointed } from "@/features/outreach/config";
import { parseCsv } from "@/features/outreach/domain/csv";
import { buildSelection, createCampaign, previewSegment } from "@/features/outreach/server/builder";
import { exportCampaignCsv, getCampaign, getProspectLetter } from "@/features/outreach/server/campaigns";
import { readFlashError } from "@/features/outreach/server/flash";
import { ConflictError } from "@/lib/errors";
import { count, DAY_MS, FIVE_ELIGIBLE, NOW, pageText as text, prospectOf, resetOutreach, seed, segment, signInFounder, submit, type AwardSpec } from "./helpers";

/**
 * Until a UK representative is appointed (UK GDPR Art. 27) an address that identifies a
 * person must not be written to: the builder lists generic mailboxes only, the server
 * refuses anything else, and no letter names a representative. All data is fictional.
 */
const HEATH: AwardSpec = { company: "Heath Roofing Ltd", coh: "05050505", email: "sam.taylor@heathroofing.example", publishedDaysAgo: 7 };
const named = () => segment({ mailbox: "generic_and_named" });

async function builderPage(params: Record<string, string>): Promise<string> {
  return renderToStaticMarkup(await AdminOutreachPage({ searchParams: Promise.resolve(params) }));
}

describe("outreach without a UK representative", () => {
  beforeEach(async () => {
    await resetOutreach();
    await signInFounder();
    await seed([...FIVE_ELIGIBLE, HEATH]);
    vi.useFakeTimers({ toFake: ["Date"], now: NOW }); // the page and the forms read the clock themselves
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("knows that none is appointed: a placeholder is not a representative", () => {
    expect(outreachSender().ukRepresentative).toBeNull();
    expect(ukRepresentativeAppointed()).toBe(false);
    expect(operatorFooterLine()).toMatch(/· UK representative: being appointed$/);
    expect(NAMED_ADDRESSES_BLOCKED).toBe("Do not send to named addresses until a UK representative is appointed");
  });

  it("refuses a segment with named addresses, whichever way it arrives", async () => {
    await expect(previewSegment(named(), NOW)).rejects.toBeInstanceOf(ConflictError);
    await expect(buildSelection(named(), NOW)).rejects.toThrow(NAMED_ADDRESSES_BLOCKED);
    await expect(createCampaign({ name: "Named", segment: named(), templateVariant: "s1" }, NOW)).rejects.toThrow(/until a UK representative is appointed\. Until then a list can hold generic mailboxes only\./);
    // …including a form posted by hand.
    const posted = await submit(createCampaignAction, { name: "Named by hand", templateVariant: "s1", segment: JSON.stringify(named()) });
    expect(posted.path).toBe("/admin/outreach");
    expect(readFlashError(Object.fromEntries(posted.params))).toContain(NAMED_ADDRESSES_BLOCKED);
    expect(await count("outreach_campaigns")).toBe(0);
    expect(await count("outreach_prospects")).toBe(0);
  });

  it("still builds generic lists, and counts the named address it left out", async () => {
    const preview = await previewSegment(segment(), NOW);
    expect(preview.rows).toHaveLength(5);
    expect(preview.rows.every((row) => row.emailKind === "generic")).toBe(true);
    expect(preview.summary.excluded.named_not_selected).toBe(1);
    const created = await createCampaign({ name: "Generic", segment: segment(), templateVariant: "s1" }, NOW);
    expect(created.listed).toBe(5);

    // The letters name no representative, in the file and in the preview.
    const { csv } = await exportCampaignCsv(created.campaignId, "first", NOW);
    const [header, ...rows] = parseCsv(csv);
    const body = header!.indexOf("body");
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row[body]).toContain("Bidfolio is operated by");
      expect(row[body]).not.toMatch(/representative/i);
    }
    const letter = await getProspectLetter(created.campaignId, (await prospectOf("Acme Grounds Ltd")).id);
    expect(letter!.body).not.toMatch(/representative/i);
  });

  it("the builder page shows the blocking notice and offers generic mailboxes only", async () => {
    const html = await builderPage({});
    expect(text(html)).toContain("Do not send to named addresses until a UK representative is appointed");
    expect(html).toContain('data-testid="named-addresses-blocked"');
    expect(html).toMatch(/<option value="generic_and_named" disabled="">/);
    expect(text(html)).toContain("Named addresses are switched off: no UK representative is appointed.");

    // A preview address that asks for named addresses (typed, or bookmarked from before) builds nothing.
    const refused = await builderPage({ preview: "1", mailbox: "generic_and_named" });
    expect(refused).toContain('data-testid="preview-refused"');
    expect(text(refused)).toContain("No preview was built");
    expect(refused).not.toContain('data-testid="segment-preview"');
    expect(refused).not.toContain('data-testid="create-campaign-form"');
    // The same address with generic mailboxes previews as usual.
    const allowed = await builderPage({ preview: "1", mailbox: "generic" });
    expect(allowed).toContain('data-testid="segment-preview"');
    expect(text(allowed)).toContain("5 companies would be listed");
  });

  it("a list that already holds a named address cannot be exported until one is appointed", async () => {
    const created = await createCampaign({ name: "From before", segment: segment(), templateVariant: "s1" }, NOW);
    // As if this row had been listed while a representative was appointed.
    const acme = await prospectOf("Acme Grounds Ltd");
    await db
      .update(outreachProspects)
      .set({ emailKind: "named", eligibility: { personalData: true, contactBy: new Date(NOW.getTime() + 20 * DAY_MS).toISOString(), reasons: [] } })
      .where(eq(outreachProspects.id, acme.id));

    const detail = await getCampaign(created.campaignId, NOW);
    expect(detail.senderProblems.map((problem) => problem.field)).toEqual(["ukRepresentative"]);
    expect(detail.senderProblems[0]!.where).toBe("site.company.ukRepresentative in src/config/site.ts");
    await expect(exportCampaignCsv(created.campaignId, "first", NOW)).rejects.toThrow(/Letters cannot be exported yet\. Missing: A UK data-protection representative/);
    // Nothing was marked as exported by the refused attempt.
    expect((await db.select().from(outreachProspects)).every((prospect) => prospect.status === "listed" && prospect.exportedAt === null)).toBe(true);
  });

  it("the opt-out page says who operates the service and that a representative is being appointed", async () => {
    const html = renderToStaticMarkup(OptOutLayout({ children: null }));
    const footer = text(html.slice(html.indexOf("<footer")));
    expect(footer).toMatch(/^Bidfolio is operated by .+, an independent sole trader registered in Ukraine \(Kremenchuk\)\. Contact: hello@bidfolio\.co\.uk · UK representative: being appointed · Payments are processed by Paddle\. · Contains public sector information licensed under the Open Government Licence v3\.0\. · Bidfolio is an independent service and is not affiliated with, or endorsed by, the UK Government\.$/);
    // The header is the reduced one of the artboard: the lockup and two links.
    expect(html).toContain('href="/sign-in"');
    expect(text(html)).toContain("What is Bidfolio?");
  });
});
