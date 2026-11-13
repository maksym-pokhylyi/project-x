import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/navigation", async () => (await import("./mocks/next")).navigation);
vi.mock("next/cache", async () => (await import("./mocks/next")).cache);
// A UK representative is appointed here: named addresses may be chosen.
vi.mock("@/config/site", async () => (await import("./mocks/site")).siteModule(true));

import AdminLayout from "@/app/admin/layout";
import AdminCampaignPage from "@/app/admin/outreach/campaigns/[id]/page";
import AdminOutreachPage from "@/app/admin/outreach/page";
import AdminSuppressionsPage from "@/app/admin/outreach/suppressions/page";
import { db } from "@/db";
import { dataRequests } from "@/db/schema";
import { createCampaign } from "@/features/outreach/server/builder";
import { exportCampaignCsv, markProspectsSent } from "@/features/outreach/server/campaigns";
import { flashError } from "@/features/outreach/server/flash";
import { addSuppression } from "@/features/outreach/server/suppressions";
import { count, FIVE_ELIGIBLE, fingerprint, NOW, pageText as text, prospectOf, resetOutreach, seed, segment, signInFounder, type AwardSpec } from "./helpers";

/**
 * The founder's pages, rendered as the server sends them. What matters here: a preview
 * stores nothing, and a prospect's address never reaches a page — it exists only in the
 * exported file. All data is fictional.
 */
const HEATH: AwardSpec = { company: "Heath Roofing Ltd", coh: "05050505", email: "sam.taylor@heathroofing.example", publishedDaysAgo: 7 };
const ADDRESSES = [...FIVE_ELIGIBLE, HEATH].map((spec) => spec.email!);
const TODAY = NOW.toISOString().slice(0, 10);

const builder = async (params: Record<string, string | string[]>) => renderToStaticMarkup(await AdminOutreachPage({ searchParams: Promise.resolve(params) }));

/** No address of a prospect, and no part of one that could identify it. */
function expectNoProspectAddress(html: string): void {
  for (const address of ADDRESSES) {
    expect(html).not.toContain(address);
    expect(html).not.toContain(address.split("@")[1]!);
  }
  expect(html).not.toContain("sam.taylor");
}

describe("outreach pages", () => {
  beforeEach(async () => {
    await resetOutreach();
    await signInFounder();
    await seed([...FIVE_ELIGIBLE, HEATH]);
    vi.useFakeTimers({ toFake: ["Date"], now: NOW }); // the pages read the clock themselves
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("the admin navigation leads to Outreach, Suppressions and Ingestion", async () => {
    const html = renderToStaticMarkup(await AdminLayout({ children: null }));
    const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
    expect([...nav.matchAll(/href="([^"]+)"[^>]*>([^<]+)</g)].map((match) => [match[2], match[1]])).toEqual([
      ["Overview", "/admin"],
      ["Organizations", "/admin/organizations"],
      ["Outreach", "/admin/outreach"],
      ["Suppressions", "/admin/outreach/suppressions"],
      ["Ingestion", "/admin/ingestion"],
    ]);
  });

  it("the builder: the segment form, how to use it lawfully in ten lines, and no notice once a representative is appointed", async () => {
    const html = await builder({});
    expect(text(html)).toContain("Nothing here sends e-mail.");
    expect(html).not.toContain('data-testid="named-addresses-blocked"');
    expect(html).toMatch(/<option value="generic_and_named">/); // not disabled
    expect(html).not.toContain('data-testid="segment-preview"'); // no preview until it is asked for

    const panel = html.slice(html.indexOf('data-testid="lawful-use"'));
    const rules = [...panel.slice(0, panel.indexOf("</ol>")).matchAll(/<li>(.*?)<\/li>/gs)].map((match) => text(match[1]!));
    expect(rules.length).toBeLessThanOrEqual(9); // nine rules and one line of links: ten lines
    const all = rules.join(" ");
    expect(all).toContain("Only Ltd, PLC and LLP companies with a Companies House number"); // who may be e-mailed
    expect(all).toContain("write within one month of the day we stored it"); // the one-month rule for named addresses
    expect(all).toContain("Start at 10 letters per mailbox per day; never more than 30."); // daily volume
    expect(all).toContain("Never phone, text or message a prospect.");
    expect(all).toContain("Honour opt-outs within 24 hours");
    for (const doc of ["docs/gtm/07-compliance-pack.md", "docs/gtm/02-outreach-kit.md"]) expect(panel).toContain(doc);
  });

  it("a preview shows companies and counts, stores nothing and contains no address", async () => {
    const before = await fingerprint();
    const html = await builder({ preview: "1", mailbox: "generic_and_named", batch: "4" });
    const shown = text(html);
    expect(shown).toContain("4 companies would be listed (of 6 that pass every rule)");
    expect(html.match(/data-testid="preview-row"/g)).toHaveLength(4);
    for (const company of ["Acme Grounds Ltd", "Brightway Cleaning Ltd", "Castle Roofing Ltd", "Dale Facilities LLP"]) expect(shown).toContain(company);
    // Each row: legal form, company number (a link to Companies House), town, the award, the kind of address.
    expect(shown).toContain("Ltd · 01111111");
    expect(html).toContain('href="https://find-and-update.company-information.service.gov.uk/company/01111111"');
    expect(shown).toContain("Grounds Maintenance Services Leeds City Council · £120,000 · 11 November 2026");
    expect(shown).toContain("Generic mailbox");
    // Everyone who was left out, with a count per reason.
    expect(shown).toContain("Eligible, but over the batch size 2");
    expect(shown).toContain("On this list (4 generic, 0 named) 4");
    for (const key of ["supplier_removed", "suppressed", "not_eligible", "domain_mismatch", "named_not_selected", "not_sme", "already_user", "cool_off", "duplicate_address", "duplicate_company", "over_batch"]) {
      expect(html).toContain(`data-testid="excluded-${key}"`);
    }
    expect(html).toContain('data-testid="create-campaign-form"');
    expectNoProspectAddress(html);

    // The whole list with the named address on it: a contact-by date, still no address.
    const withNamed = await builder({ preview: "1", mailbox: "generic_and_named" });
    expect(text(withNamed)).toContain("Named address");
    expect(text(withNamed)).toContain("12 Dec 2026"); // stored on 12 November: thirty days
    expectNoProspectAddress(withNamed);

    expect(await fingerprint()).toBe(before);
    expect(await count("outreach_campaigns")).toBe(0);
    expect(await count("outreach_audit")).toBe(0);
  });

  it("a mistake in the form is shown next to its field, with what was typed", async () => {
    const html = await builder({ preview: "1", days: "999", min: "lots", groups: "79" });
    expect(html).not.toContain('data-testid="segment-preview"');
    expect(text(html)).toContain("Use at most 180 days.");
    expect(html).toContain('value="999"');
    expect(html).toContain('value="lots"');
    expect(html).toMatch(/aria-invalid="true"[^>]*aria-describedby="segment-days-error"|aria-describedby="segment-days-error"[^>]*aria-invalid="true"/);
  });

  it("the campaign page lists companies, their state and the letter — never an address", async () => {
    const { campaignId } = await createCampaign({ name: "Week one", segment: segment({ mailbox: "generic_and_named" }), templateVariant: "s3", notes: "First cohort" }, NOW);
    await exportCampaignCsv(campaignId, "first", NOW);
    const acme = await prospectOf("Acme Grounds Ltd");
    await markProspectsSent({ campaignId, sentOn: TODAY, prospectIds: [acme.id] }, NOW);

    const html = renderToStaticMarkup(await AdminCampaignPage({ params: Promise.resolve({ id: campaignId }), searchParams: Promise.resolve({ notice: "sent", n: "1", letter: acme.id }) }));
    const shown = text(html);
    expect(shown).toContain("Week one");
    expect(shown).toContain("First cohort");
    expect(shown).toContain("1 company marked as sent.");
    expect(html.match(/data-testid="prospect-row"/g)).toHaveLength(6);
    expect(html).toMatch(/data-testid="prospect-row" data-status="sent"/);
    expect(shown).toContain("5 exported companies have no date yet.");
    expect(shown).toContain("First letter — 5 to export");
    expect(shown).toContain("contact by 12 Dec 2026");
    // The letter preview is the letter, without the address it goes to.
    expect(shown).toContain("Letter to Acme Grounds Ltd");
    expect(shown).toContain("Subject: Acme Grounds Ltd and Leeds City Council: your award, and similar open tenders (Bidfolio)");
    expect(html).toContain(`/optout?c=${acme.refCode}`);
    expectNoProspectAddress(html);
    // Links to a company's page carry no code, so the founder's own look is not counted as a visit.
    expect(html).toContain('href="/suppliers/acme-grounds-ltd-01111111"');
    expect(html).not.toMatch(/href="[^"]*[?&]r=/); // the personal link exists only as text inside the letter
    // The app is not on its public address in tests, and the page says so before anything is sent from it.
    expect(html).toContain('data-testid="origin-warning"');
  });

  it("shows an error only when this server wrote it", async () => {
    const { campaignId } = await createCampaign({ name: "Week one", segment: segment(), templateVariant: "s1" }, NOW);
    const render = async (params: Record<string, string>) => text(renderToStaticMarkup(await AdminCampaignPage({ params: Promise.resolve({ id: campaignId }), searchParams: Promise.resolve(params) })));
    const genuine = flashError("Nothing to export.");
    expect(await render(genuine)).toContain("That did not work Nothing to export.");
    // A link somebody else wrote: the words are not shown.
    expect(await render({ error: "Your session has expired. Sign in again at evil.example", es: genuine.es })).not.toContain("evil.example");
    expect(await render({ error: "Call 01234 567890 to restore access" })).not.toContain("restore access");
    expect(await render({ notice: "made-up" })).not.toContain("made-up");
  });

  it("the suppressions page is the one place the list can be read, with the requests that are waiting", async () => {
    await addSuppression({ target: "tenders@acmegrounds.example", reason: "optout", note: "replied stop" });
    await addSuppression({ target: "brightway.example", reason: "complaint" });
    await db.insert(dataRequests).values({ kind: "removal", requesterEmail: "office@elmcare.example", message: "Please remove our page.", pageUrl: "https://bidfolio.co.uk/suppliers/elm-care-ltd-05555555", organisationName: "Elm Care Ltd" });

    const html = renderToStaticMarkup(await AdminSuppressionsPage({ searchParams: Promise.resolve({}) }));
    const shown = text(html);
    expect(shown).toContain("2 on the list");
    expect(shown).toContain("Opted out: 1");
    expect(shown).toContain("Complaint: 1");
    expect(html.match(/data-testid="suppression-row"/g)).toHaveLength(2);
    expect(shown).toContain("tenders@acmegrounds.example");
    expect(shown).toContain("Whole domain");
    expect(shown).toContain("replied stop");
    // Removing is never one click: a field to type the entry into, per row.
    expect(html.match(/name="confirmation"/g)).toHaveLength(2);
    expect(html.match(/data-testid="request-row"/g)).toHaveLength(1);
    expect(shown).toContain("Removal · Elm Care Ltd");
    expect(shown).toContain("Hide the company page");

    const searched = text(renderToStaticMarkup(await AdminSuppressionsPage({ searchParams: Promise.resolve({ q: "brightway" }) })));
    expect(searched).toContain("1 of 2 entries match “brightway”.");
    expect(searched).not.toContain("tenders@acmegrounds.example");
    const nothing = text(renderToStaticMarkup(await AdminSuppressionsPage({ searchParams: Promise.resolve({ q: "zzz" }) })));
    expect(nothing).toContain("Nothing on the list matches that");
  });
});
