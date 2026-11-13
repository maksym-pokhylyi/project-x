import { eq, sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/navigation", async () => (await import("./mocks/next")).navigation);
vi.mock("next/cache", async () => (await import("./mocks/next")).cache);

import OptOutPage, { metadata } from "@/app/optout/page";
import { db } from "@/db";
import { events, outreachProspects, suppressions } from "@/db/schema";
import { OPTOUT_RATE_LIMITS } from "@/features/outreach/config";
import { confirmOptOutAction, optOutByAddressAction } from "@/features/outreach/optout-actions";
import { buildSelection, createCampaign } from "@/features/outreach/server/builder";
import { exportCampaignCsv, markProspectsSent } from "@/features/outreach/server/campaigns";
import { confirmOptOut, getOptOutView, optOutByAddress } from "@/features/outreach/server/optout";
import { getOutreachResults } from "@/features/outreach/server/results";
import { actAs, type TestUser } from "../helpers/auth";
import { ingest } from "../procurement/helpers/factory";
import { asVisitor, award, count, daysAgo, FIVE_ELIGIBLE, fingerprint, NOW, pageText as text, prospectOf, resetOutreach, seed, segment, signInFounder, submit } from "./helpers";

/**
 * The public opt-out. A recipient has no account: what they hold is the code in their
 * letter. Opening the page must change nothing (mail scanners follow links); the button
 * stops the e-mails, once. All data is fictional.
 */
const TODAY = NOW.toISOString().slice(0, 10);

let founder: TestUser;
let campaignId: string;

/** The page as a browser without JavaScript receives it. */
async function page(params: Record<string, string>): Promise<string> {
  return renderToStaticMarkup(await OptOutPage({ searchParams: Promise.resolve(params) }));
}
const buttons = (html: string) => html.match(/<button\b/g)?.length ?? 0;

/** Five companies on a list that was exported and sent on the fixture day. */
async function sentCampaign(): Promise<void> {
  await seed(FIVE_ELIGIBLE);
  campaignId = (await createCampaign({ name: "Week one", segment: segment(), templateVariant: "s1" }, NOW)).campaignId;
  await exportCampaignCsv(campaignId, "first", NOW);
  await markProspectsSent({ campaignId, sentOn: TODAY, allExported: true }, NOW);
}

const optoutEvents = async () => db.select().from(events).where(eq(events.name, "optout"));

describe("public opt-out", () => {
  beforeEach(async () => {
    await resetOutreach();
    founder = await signInFounder();
    await sentCampaign();
    asVisitor(); // from here on nobody is signed in
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("opening the link", () => {
    it("names the company, not the address, and offers one button", async () => {
      const acme = await prospectOf("Acme Grounds Ltd");
      const html = await page({ c: acme.refCode });
      expect(text(html)).toContain("Stop emails to this address?");
      expect(text(html)).toContain("Acme Grounds Ltd");
      expect(text(html)).toContain("Nothing changes until you press the button.");
      expect(html).not.toContain("acmegrounds");
      expect(html).not.toContain("tenders@");
      expect(buttons(html)).toBe(1);
      expect(html).toContain(`<input type="hidden" name="c" value="${acme.refCode}"/>`);
      // A plain form with a submit button. (That it works with JavaScript switched off is
      // proved in a browser: e2e/outreach.spec.ts.)
      expect(html).toMatch(/<form[^>]*>.*<button[^>]*type="submit"/s);
      expect(await getOptOutView(acme.refCode)).toEqual({ state: "pending", company: "Acme Grounds Ltd", supplierSlug: "acme-grounds-ltd-01111111", pagePublic: true });
    });

    it("changes nothing, however often it is opened (mail scanners follow links)", async () => {
      const acme = await prospectOf("Acme Grounds Ltd");
      const before = await fingerprint();
      for (let visit = 0; visit < 3; visit += 1) {
        await page({ c: acme.refCode });
        await getOptOutView(acme.refCode);
      }
      await page({ c: "0000000000" });
      await page({});
      await page({ done: "1" });
      await page({ error: "rate" });
      expect(await fingerprint()).toBe(before);
      expect(await count("suppressions")).toBe(0);
      expect(await prospectOf("Acme Grounds Ltd")).toMatchObject({ status: "sent", optedOutAt: null });
    });

    it("is kept out of search engines and gives nothing away for a code it does not know", async () => {
      expect(metadata.robots).toEqual({ index: false, follow: false });
      for (const code of ["0000000000", "short", "../../etc/passwd", "a".repeat(200), "<script>alert(1)</script>"]) {
        expect(await getOptOutView(code)).toEqual({ state: "unknown" });
        const html = await page({ c: code });
        expect(text(html)).toContain("We could not match that link");
        expect(text(html)).toContain("Stop emails from Bidfolio");
        expect(html).not.toContain("<script>alert");
        expect(buttons(html)).toBe(1);
      }
      expect(await getOptOutView(null)).toEqual({ state: "unknown" });
    });
  });

  describe("pressing the button", () => {
    it("puts the address on the do-not-contact list, marks the company as opted out and records one event", async () => {
      const acme = await prospectOf("Acme Grounds Ltd");
      expect(await confirmOptOut(acme.refCode)).toEqual({ found: true, changed: true });

      const list = await db.select().from(suppressions);
      expect(list.find((entry) => entry.email === "tenders@acmegrounds.example")).toMatchObject({ reason: "optout", source: "optout_link", domain: null, createdBy: null });
      // The domain is this company's alone in the notices, so the whole company is covered.
      expect(list.find((entry) => entry.domain === "acmegrounds.example")).toMatchObject({ reason: "optout", source: "optout_link", email: null });
      expect(list).toHaveLength(2);

      const after = await prospectOf("Acme Grounds Ltd");
      expect(after.status).toBe("opted_out");
      expect(after.optedOutAt).not.toBeNull();
      expect(after.sentAt).toEqual(acme.sentAt); // the record of first contact stays
      const stamped = (await db.execute(sql`select suppressed_at, suppressed_reason from supplier_contacts where email = 'tenders@acmegrounds.example'`)) as unknown as Array<Record<string, unknown>>;
      expect(stamped[0]!.suppressed_at).not.toBeNull();
      expect(stamped[0]!.suppressed_reason).toBe("optout");

      // The event says that someone opted out and through which list — not who.
      const recorded = await optoutEvents();
      expect(recorded).toHaveLength(1);
      expect(recorded[0]).toMatchObject({ organizationId: null, userId: null, properties: { via: "link", campaign: campaignId } });
      expect(JSON.stringify(recorded)).not.toContain("@");
      expect(JSON.stringify(recorded)).not.toContain("acme");

      // The page now says so, and what we hold — still without the address.
      const html = await page({ c: acme.refCode });
      expect(text(html)).toContain("You are unsubscribed");
      expect(text(html)).toContain("We will not email Acme Grounds Ltd again");
      expect(text(html)).toContain("What we hold");
      expect(text(html)).toContain("contract notices published on Find a Tender under the Open Government Licence v3.0");
      expect(text(html)).toContain("no contact name and no telephone number");
      expect(text(html)).toContain("Have it removed");
      expect(html).toContain('href="/about-the-data?page=%2Fsuppliers%2Facme-grounds-ltd-01111111#request"');
      expect(html).toContain('href="/suppliers/acme-grounds-ltd-01111111"');
      expect(html).not.toContain("acmegrounds.example");
      expect(buttons(html)).toBe(0); // nothing left to press: the further step is a link to the request form
      expect(await getOptOutView(acme.refCode)).toMatchObject({ state: "done", company: "Acme Grounds Ltd" });
    });

    it("is idempotent: a second press, a reload or a double click changes nothing more", async () => {
      const acme = await prospectOf("Acme Grounds Ltd");
      await confirmOptOut(acme.refCode);
      const once = await fingerprint();
      const first = await prospectOf("Acme Grounds Ltd");

      expect(await confirmOptOut(acme.refCode)).toEqual({ found: true, changed: false });
      expect(await Promise.all([confirmOptOut(acme.refCode), confirmOptOut(acme.refCode)])).toEqual([
        { found: true, changed: false },
        { found: true, changed: false },
      ]);
      expect(await fingerprint()).toBe(once);
      expect(await optoutEvents()).toHaveLength(1);
      expect((await prospectOf("Acme Grounds Ltd")).optedOutAt).toEqual(first.optedOutAt);
    });

    it("two presses at the same moment still make one entry and one event", async () => {
      const acme = await prospectOf("Acme Grounds Ltd");
      const results = await Promise.all([confirmOptOut(acme.refCode), confirmOptOut(acme.refCode), confirmOptOut(acme.refCode)]);
      expect(results.filter((result) => result.changed)).toHaveLength(1);
      expect(await db.select().from(suppressions).where(eq(suppressions.email, "tenders@acmegrounds.example"))).toHaveLength(1);
      expect(await optoutEvents()).toHaveLength(1);
    });

    it("does nothing for a code nobody was sent", async () => {
      const before = await fingerprint();
      expect(await confirmOptOut("0000000000")).toEqual({ found: false, changed: false });
      expect(await confirmOptOut("not a code")).toEqual({ found: false, changed: false });
      expect(await fingerprint()).toBe(before);
    });

    it("the form posts, the page answers: back to the link, which now shows the result", async () => {
      const acme = await prospectOf("Acme Grounds Ltd");
      const sent = await submit(confirmOptOutAction, { c: acme.refCode });
      expect(sent.url).toBe(`/optout?c=${acme.refCode}`);
      expect((await prospectOf("Acme Grounds Ltd")).status).toBe("opted_out");
      // A second press lands on the same page and changes nothing.
      const once = await fingerprint();
      expect((await submit(confirmOptOutAction, { c: acme.refCode })).url).toBe(`/optout?c=${acme.refCode}`);
      expect(await fingerprint()).toBe(once);

      // A code that matches nothing: no claim that anything was stopped.
      expect((await submit(confirmOptOutAction, { c: "0000000000" })).url).toBe("/optout?error=link");
      expect((await submit(confirmOptOutAction, { c: "<script>" })).url).toBe("/optout");
      expect((await submit(confirmOptOutAction, {})).url).toBe("/optout");
    });

    it("a signed-in visitor is treated like anyone else: the code is what counts", async () => {
      const brightway = await prospectOf("Brightway Cleaning Ltd");
      actAs(founder);
      expect((await submit(confirmOptOutAction, { c: brightway.refCode })).url).toBe(`/optout?c=${brightway.refCode}`);
      expect((await prospectOf("Brightway Cleaning Ltd")).status).toBe("opted_out");
    });

    it("leaves a shared domain alone: only the address and the company are stopped", async () => {
      // A second company whose notice gives an address on the same domain.
      await ingest([award({ company: "Acme Grounds North Ltd", coh: "01212121", email: "enquiries@acmegrounds.example", publishedDaysAgo: 1 })]);
      const acme = await prospectOf("Acme Grounds Ltd");
      await confirmOptOut(acme.refCode);
      const list = await db.select().from(suppressions);
      expect(list.map((entry) => entry.email ?? entry.domain)).toEqual(["tenders@acmegrounds.example"]);
      // The sister company can still be listed; the company that opted out cannot.
      const selection = await buildSelection(segment(), NOW);
      expect(selection.prospects.map((prospect) => prospect.supplier.name)).toEqual(["Acme Grounds North Ltd"]);
    });

    it("still works after retention erased the address: the company stays blocked", async () => {
      const elm = await prospectOf("Elm Care Ltd");
      await db.update(outreachProspects).set({ email: null, emailHash: null, mergeFields: null, erasedAt: NOW }).where(eq(outreachProspects.id, elm.id));
      const html = await page({ c: elm.refCode });
      expect(text(html)).toContain("Elm Care Ltd"); // the registered name, now that the letter's own fields are gone
      expect(await confirmOptOut(elm.refCode)).toEqual({ found: true, changed: true });
      expect(await prospectOf("Elm Care Ltd")).toMatchObject({ status: "opted_out", email: null });
      expect(await count("suppressions")).toBe(0); // there is no address left to list
      // Long after the cool-off the company is still left out; the other four are free again.
      await db.update(outreachProspects).set({ createdAt: daysAgo(400), exportedAt: daysAgo(400), sentAt: daysAgo(400) });
      const selection = await buildSelection(segment(), NOW);
      expect(selection.prospects.map((prospect) => prospect.supplier.name)).not.toContain("Elm Care Ltd");
      expect(selection.summary).toMatchObject({ listed: 4 });
      expect(selection.summary.excluded.suppressed).toBe(1);
    });
  });

  describe("afterwards", () => {
    it("the next list leaves the address and the company out, and says why", async () => {
      const acme = await prospectOf("Acme Grounds Ltd");
      await confirmOptOut(acme.refCode);
      // Long after the cool-off, with the same award still in the window.
      await db.update(outreachProspects).set({ createdAt: daysAgo(400), exportedAt: daysAgo(400), sentAt: daysAgo(400) });
      const selection = await buildSelection(segment(), NOW);
      expect(selection.prospects.map((prospect) => prospect.supplier.name).sort()).toEqual(["Brightway Cleaning Ltd", "Castle Roofing Ltd", "Dale Facilities LLP", "Elm Care Ltd"]);
      expect(selection.summary.excluded).toMatchObject({ suppressed: 1, cool_off: 0 });
      expect(selection.summary.listed).toBe(4);
    });

    it("an address that re-appears in a later notice stays suppressed — also at another address of the same company", async () => {
      const acme = await prospectOf("Acme Grounds Ltd");
      await confirmOptOut(acme.refCode);
      await db.update(outreachProspects).set({ createdAt: daysAgo(400), exportedAt: daysAgo(400), sentAt: daysAgo(400) });
      // New notices: the same address again, the same address for a sister company, and a new address for the company itself.
      await ingest([
        award({ company: "Acme Grounds Ltd", coh: "01111111", email: "tenders@acmegrounds.example", publishedDaysAgo: 1, title: "Parks Maintenance" }),
        award({ company: "Acme Parks Ltd", coh: "01313131", email: "tenders@acmegrounds.example", publishedDaysAgo: 1 }),
        award({ company: "Acme Grounds Ltd", coh: "01111111", email: "bids@acme-grounds-group.example", publishedDaysAgo: 1, title: "Verge Cutting" }),
      ]);
      const selection = await buildSelection(segment(), NOW);
      const listed = selection.prospects.map((prospect) => prospect.supplier.name);
      expect(listed).not.toContain("Acme Grounds Ltd"); // "We will not contact Acme Grounds Ltd again"
      expect(listed).not.toContain("Acme Parks Ltd"); // the address itself, whoever it is published for
      expect(selection.summary.excluded.suppressed).toBe(3);
      actAs(founder);
      await expect(createCampaign({ name: "Later", segment: segment({ cpvDivisions: ["77"] }), templateVariant: "s1" }, NOW)).resolves.toMatchObject({ listed: 1 }); // Dale only
    });

    it("an opt-out is counted in the results of the campaign it came from", async () => {
      const acme = await prospectOf("Acme Grounds Ltd");
      await confirmOptOut(acme.refCode);
      actAs(founder);
      const results = await getOutreachResults(campaignId, NOW);
      expect(results.counts).toMatchObject({ sent: 5, optedOut: 1 });
    });
  });

  describe("the form without a link", () => {
    it("answers every address in the same way, whether we have ever seen it or not", async () => {
      const known = await submit(optOutByAddressAction, { email: "  Tenders@AcmeGrounds.example " });
      const unknown = await submit(optOutByAddressAction, { email: "nobody@never-seen.example" });
      expect(known.url).toBe("/optout?done=1");
      expect(unknown.url).toBe(known.url);
      expect(await optOutByAddress("someone@else.example")).toMatchObject({ valid: true });

      const html = await page({ done: "1" });
      expect(text(html)).toContain("You are unsubscribed");
      expect(text(html)).toContain("We will not email that address again");
      expect(html).not.toMatch(/acme|never-seen/i);
      // Both addresses are now on the list, lower-cased, as plain addresses (never a whole domain).
      const list = await db.select().from(suppressions);
      expect(list.map((entry) => entry.email).sort()).toEqual(["nobody@never-seen.example", "someone@else.example", "tenders@acmegrounds.example"]);
      expect(list.every((entry) => entry.domain === null && entry.reason === "optout" && entry.source === "optout_form")).toBe(true);
      // The one we had written to is marked as opted out; an event is recorded for each address that was new.
      expect((await prospectOf("Acme Grounds Ltd")).status).toBe("opted_out");
      const recorded = await optoutEvents();
      expect(recorded).toHaveLength(3);
      for (const event of recorded) expect(event.properties).toEqual({ via: "form", campaign: null });
      // Typing it again changes nothing and still gets the same answer.
      expect((await submit(optOutByAddressAction, { email: "tenders@acmegrounds.example" })).url).toBe("/optout?done=1");
      expect(await optoutEvents()).toHaveLength(3);
    });

    it("asks again for something that is not an address, and stores nothing", async () => {
      for (const email of ["", "not an address", "acmegrounds.example", "a@b", "two@addresses.example, other@addresses.example"]) {
        expect((await submit(optOutByAddressAction, { email })).url).toBe("/optout?error=email");
      }
      expect(await count("suppressions")).toBe(0);
      const html = await page({ error: "email" });
      expect(text(html)).toContain("Enter the email address in full");
      expect(html).toContain('aria-invalid="true"');
    });

    it("is rate-limited per client address, and says that nothing was changed", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: NOW });
      const limit = OPTOUT_RATE_LIMITS.form.limit;
      for (let attempt = 0; attempt < limit; attempt += 1) {
        expect((await submit(optOutByAddressAction, { email: `person${attempt}@list.example` })).url).toBe("/optout?done=1");
      }
      expect((await submit(optOutByAddressAction, { email: "one-more@list.example" })).url).toBe("/optout?error=rate");
      expect(await count("suppressions")).toBe(limit);
      expect(text(await page({ error: "rate" }))).toContain("nothing was changed");
      // Another client is not affected, and neither is a personal link.
      asVisitor("198.51.100.20");
      expect((await submit(optOutByAddressAction, { email: "elsewhere@list.example" })).url).toBe("/optout?done=1");
      asVisitor();
      const acme = await prospectOf("Acme Grounds Ltd");
      expect((await submit(confirmOptOutAction, { c: acme.refCode })).url).toBe(`/optout?c=${acme.refCode}`);
    });

    it("the link's own limit is generous, and a refused press changes nothing", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: NOW });
      const acme = await prospectOf("Acme Grounds Ltd");
      for (let attempt = 0; attempt < OPTOUT_RATE_LIMITS.link.limit; attempt += 1) await submit(confirmOptOutAction, { c: "0000000000" });
      const before = await fingerprint();
      expect((await submit(confirmOptOutAction, { c: acme.refCode })).url).toBe(`/optout?c=${acme.refCode}&error=rate`);
      expect(await fingerprint()).toBe(before);
      expect(text(await page({ c: acme.refCode, error: "rate" }))).toContain("nothing was changed");
    });
  });
});
