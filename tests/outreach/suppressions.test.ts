import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/navigation", async () => (await import("./mocks/next")).navigation);
vi.mock("next/cache", async () => (await import("./mocks/next")).cache);

import { POST as exportRoute } from "@/app/admin/suppressions/export/route";
import { db } from "@/db";
import { dataRequests, outreachAudit, outreachProspects, suppliers, suppressions } from "@/db/schema";
import { addSuppressionAction, importBouncesAction, removeSuppressionAction, resolveDataRequestAction } from "@/features/outreach/actions";
import { CSV_BOM, parseCsv } from "@/features/outreach/domain/csv";
import { buildSelection, createCampaign } from "@/features/outreach/server/builder";
import { exportCampaignCsv, markProspectsSent } from "@/features/outreach/server/campaigns";
import { countOpenDataRequests, listDataRequests, resolveDataRequest } from "@/features/outreach/server/data-requests";
import { readFlashError } from "@/features/outreach/server/flash";
import { syncContactSuppressions } from "@/features/outreach/server/suppression-store";
import { addSuppression, exportSuppressionsCsv, importBounceList, listSuppressions, removeSuppression } from "@/features/outreach/server/suppressions";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { runMaintenance } from "@/lib/maintenance";
import type { TestUser } from "../helpers/auth";
import { ingest } from "../procurement/helpers/factory";
import { award, count, daysAgo, FIVE_ELIGIBLE, NOW, prospectOf, resetOutreach, seed, segment, signInFounder, submit } from "./helpers";
import { revalidated } from "./mocks/next";

/**
 * The do-not-contact list from the founder's side, and the queue of correction and removal
 * requests. All data is fictional; every address is on a reserved `.example` domain.
 */
const TODAY = NOW.toISOString().slice(0, 10);
const ORIGIN = "http://localhost:3000";

let founder: TestUser;

const stampOf = async (email: string) => {
  const rows = (await db.execute(sql`select suppressed_at, suppressed_reason from supplier_contacts where email = ${email}`)) as unknown as Array<Record<string, unknown>>;
  return rows.map((row) => (row.suppressed_at === null ? null : String(row.suppressed_reason)));
};
const audit = async (action: string) => db.select().from(outreachAudit).where(eq(outreachAudit.action, action));

/** Five listed companies: Acme and Brightway stay listed, Castle is exported, Dale and Elm are sent. */
async function campaignInThreeStates(): Promise<string> {
  await seed(FIVE_ELIGIBLE);
  const { campaignId } = await createCampaign({ name: "Week one", segment: segment(), templateVariant: "s1" }, NOW);
  const [castle, dale, elm] = [await prospectOf("Castle Roofing Ltd"), await prospectOf("Dale Facilities LLP"), await prospectOf("Elm Care Ltd")];
  // Only these three leave the tool.
  await db.update(outreachProspects).set({ status: "exported", exportedAt: NOW }).where(sql`${outreachProspects.id} in (${castle.id}::uuid, ${dale.id}::uuid, ${elm.id}::uuid)`);
  await markProspectsSent({ campaignId, sentOn: TODAY, prospectIds: [dale.id, elm.id] }, NOW);
  return campaignId;
}

describe("suppression list", () => {
  beforeEach(async () => {
    await resetOutreach();
    revalidated.length = 0;
    founder = await signInFounder();
  });

  describe("adding", () => {
    it("an address: listed once, stamped on the contact row, and taken off a list that never left the tool", async () => {
      await campaignInThreeStates();
      const added = await addSuppression({ target: "  Tenders@AcmeGrounds.example ", reason: "manual", note: "  asked by phone to their office  " });
      expect(added).toEqual({ created: true, kind: "email", contactsStamped: 1, prospectsAffected: 1 });
      const [entry] = await db.select().from(suppressions);
      expect(entry).toMatchObject({ email: "tenders@acmegrounds.example", domain: null, reason: "manual", source: "admin", note: "asked by phone to their office", createdBy: founder.id });
      expect(await stampOf("tenders@acmegrounds.example")).toEqual(["manual"]);
      expect(await prospectOf("Acme Grounds Ltd")).toMatchObject({ status: "skipped", skippedReason: "suppressed" });

      // The audit entry says what kind of entry and for which domain — not the address.
      const [logged] = await audit("suppression.added");
      expect(logged).toMatchObject({ actorId: founder.id, count: 1, metadata: { kind: "email", domain: "acmegrounds.example", reason: "manual" } });
      expect((logged!.metadata as { fingerprint: string }).fingerprint).toMatch(/^[0-9a-f]{16}$/);
      expect(JSON.stringify(logged)).not.toContain("tenders@");

      // Adding it again is not an error and not a second entry.
      expect(await addSuppression({ target: "tenders@acmegrounds.example", reason: "optout" })).toMatchObject({ created: false });
      expect(await count("suppressions")).toBe(1);
      expect(await audit("suppression.added")).toHaveLength(1);
    });

    it("an objection after the letter went out is an opt-out; a bounce leaves the record of sending alone", async () => {
      await campaignInThreeStates();
      // Castle (exported) says "stop"; Dale (sent) complains; Elm (sent) bounces.
      expect(await addSuppression({ target: "bids@castleroofing.example", reason: "optout" })).toMatchObject({ prospectsAffected: 1 });
      expect(await addSuppression({ target: "enquiries@dalefacilities.example", reason: "complaint" })).toMatchObject({ prospectsAffected: 1 });
      expect(await addSuppression({ target: "office@elmcare.example", reason: "bounce" })).toMatchObject({ prospectsAffected: 0 });
      expect((await prospectOf("Castle Roofing Ltd")).status).toBe("opted_out");
      const dale = await prospectOf("Dale Facilities LLP");
      expect(dale.status).toBe("opted_out");
      expect(dale.sentAt).not.toBeNull();
      expect(dale.optedOutAt).not.toBeNull();
      expect(await prospectOf("Elm Care Ltd")).toMatchObject({ status: "sent", optedOutAt: null });
      // None of the three is written to again.
      const exported = await exportCampaignCsv(await prospectCampaign(), "reminder_1", NOW);
      expect(exported.count).toBe(0);
    });

    it("a domain covers every address on it and on its subdomains, however it is typed", async () => {
      await seed([
        { company: "Maple North Ltd", coh: "06363636", email: "enquiries@maplegroup.example", publishedDaysAgo: 2 },
        { company: "Maple South Ltd", coh: "06464646", email: "info@south.maplegroup.example", publishedDaysAgo: 3 },
        { company: "Not Maple Ltd", coh: "06565656", email: "info@notmaplegroup.example", publishedDaysAgo: 4 },
      ]);
      const added = await addSuppression({ target: "https://www.MapleGroup.example/contact", reason: "optout" });
      expect(added).toMatchObject({ created: true, kind: "domain", contactsStamped: 2 });
      expect((await db.select().from(suppressions))[0]).toMatchObject({ email: null, domain: "maplegroup.example" });
      expect(await addSuppression({ target: "@maplegroup.example", reason: "manual" })).toMatchObject({ created: false });
      expect(await addSuppression({ target: "*.maplegroup.example", reason: "manual" })).toMatchObject({ created: false });

      const selection = await buildSelection(segment(), NOW);
      expect(selection.prospects.map((prospect) => prospect.supplier.name)).toEqual(["Not Maple Ltd"]);
      expect(selection.summary.excluded.suppressed).toBe(2);
      expect((await audit("suppression.added"))[0]!.metadata).toEqual({ kind: "domain", domain: "maplegroup.example", reason: "optout" });
    });

    it("refuses what is not an address or a domain — and a suffix that is nobody's domain", async () => {
      for (const target of ["", "   ", "not an address", "name@", "@", "co.uk", "example", "two@x.example three@x.example"]) {
        await expect(addSuppression({ target, reason: "manual" })).rejects.toBeInstanceOf(ValidationError);
      }
      expect(await count("suppressions")).toBe(0);
    });
  });

  describe("bounce list", () => {
    it("finds every address in pasted text or a CSV, ignores our own domains and counts what was new", async () => {
      await campaignInThreeStates();
      await addSuppression({ target: "bids@castleroofing.example", reason: "optout" });
      const report = [
        "Delivery report, 14 November",
        "recipient,status,detail",
        '"office@elmcare.example","550","mailbox unavailable"',
        "Jo Example <jo.example@nowhere.example>; 554 rejected",
        "BIDS@CASTLEROOFING.EXAMPLE,550,already on the list",
        "office@elmcare.example,550,the same address again",
        "mailer-daemon@bidfolio.co.uk,,our own sending address",
      ].join("\r\n");
      const result = await importBounceList(report);
      expect(result).toEqual({ found: 4, added: 2, alreadyListed: 1, ignoredOwn: 1, truncated: false });

      const list = await db.select().from(suppressions);
      expect(list.filter((entry) => entry.reason === "bounce").map((entry) => entry.email).sort()).toEqual(["jo.example@nowhere.example", "office@elmcare.example"]);
      expect(list.filter((entry) => entry.source === "bounce_import")).toHaveLength(2);
      expect(list.some((entry) => entry.email?.endsWith("@bidfolio.co.uk"))).toBe(false);
      expect(await stampOf("office@elmcare.example")).toEqual(["bounce"]);
      // Elm was written to: the record stays "sent", and it is in the results as a bounce.
      expect((await prospectOf("Elm Care Ltd")).status).toBe("sent");

      const [logged] = await audit("suppression.imported");
      expect(logged).toMatchObject({ actorId: founder.id, count: 2, metadata: { found: 4, ignoredOwn: 1, truncated: false } });
      expect(JSON.stringify(logged)).not.toContain("@");
    });

    it("says so when there is nothing to import or too much", async () => {
      await expect(importBounceList("no addresses in here")).rejects.toBeInstanceOf(ValidationError);
      await expect(importBounceList("x".repeat(2_000_001))).rejects.toBeInstanceOf(ValidationError);
      const many = Array.from({ length: 5_003 }, (_, index) => `bounce${index}@bulk.example`).join("\n");
      expect(await importBounceList(many)).toMatchObject({ found: 5_000, added: 5_000, truncated: true });
      expect(await count("suppressions")).toBe(5_000);
    });
  });

  describe("removing", () => {
    it("needs the entry typed out, makes the address contactable again and is logged", async () => {
      await seed(FIVE_ELIGIBLE);
      await addSuppression({ target: "tenders@acmegrounds.example", reason: "manual" });
      const [entry] = await db.select().from(suppressions);
      expect((await buildSelection(segment(), NOW)).summary.listed).toBe(4);

      await expect(removeSuppression({ id: entry!.id, confirmation: "" })).rejects.toBeInstanceOf(ValidationError);
      await expect(removeSuppression({ id: entry!.id, confirmation: "tenders@acmegrounds.exampl" })).rejects.toBeInstanceOf(ValidationError);
      await expect(removeSuppression({ id: entry!.id, confirmation: "acmegrounds.example" })).rejects.toBeInstanceOf(ValidationError);
      expect(await count("suppressions")).toBe(1);

      expect(await removeSuppression({ id: entry!.id, confirmation: " Tenders@AcmeGrounds.example " })).toEqual({ kind: "email", contactsUnstamped: 1 });
      expect(await count("suppressions")).toBe(0);
      expect(await stampOf("tenders@acmegrounds.example")).toEqual([null]);
      expect((await buildSelection(segment(), NOW)).summary.listed).toBe(5);

      const [logged] = await audit("suppression.removed");
      expect(logged).toMatchObject({ actorId: founder.id, count: 1, metadata: { kind: "email", domain: "acmegrounds.example", reason: "manual", source: "admin" } });
      expect(JSON.stringify(logged)).not.toContain("tenders@");
      await expect(removeSuppression({ id: entry!.id, confirmation: "tenders@acmegrounds.example" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("keeps the stamp while another entry still covers the address, and never undoes an opt-out", async () => {
      await campaignInThreeStates();
      await addSuppression({ target: "enquiries@dalefacilities.example", reason: "optout" });
      await addSuppression({ target: "dalefacilities.example", reason: "manual" });
      const entries = await db.select().from(suppressions);
      const address = entries.find((entry) => entry.email)!;
      const domain = entries.find((entry) => entry.domain)!;

      expect(await removeSuppression({ id: address.id, confirmation: "enquiries@dalefacilities.example" })).toEqual({ kind: "email", contactsUnstamped: 0 });
      expect(await stampOf("enquiries@dalefacilities.example")).toEqual(["optout"]);
      expect(await removeSuppression({ id: domain.id, confirmation: "dalefacilities.example" })).toEqual({ kind: "domain", contactsUnstamped: 1 });
      expect(await stampOf("enquiries@dalefacilities.example")).toEqual([null]);

      // The company opted out: off the list or not, it is not listed again.
      expect((await prospectOf("Dale Facilities LLP")).status).toBe("opted_out");
      await db.update(outreachProspects).set({ createdAt: daysAgo(400), exportedAt: daysAgo(400), sentAt: daysAgo(400) });
      const selection = await buildSelection(segment(), NOW);
      expect(selection.prospects.map((prospect) => prospect.supplier.name)).not.toContain("Dale Facilities LLP");
    });
  });

  describe("reading and exporting", () => {
    it("lists newest first, searches by a fragment and counts by reason", async () => {
      await addSuppression({ target: "one@alpha.example", reason: "optout" });
      await addSuppression({ target: "two@beta.example", reason: "bounce" });
      await addSuppression({ target: "alpha-group.example", reason: "complaint" });
      const all = await listSuppressions();
      expect(all).toMatchObject({ total: 3, matching: 3, page: 1, pages: 1, byReason: { optout: 1, bounce: 1, complaint: 1 } });
      expect(all.rows.map((row) => [row.kind, row.value])).toEqual([
        ["domain", "alpha-group.example"],
        ["email", "two@beta.example"],
        ["email", "one@alpha.example"],
      ]);
      expect((await listSuppressions({ query: "ALPHA" })).rows.map((row) => row.value)).toEqual(["alpha-group.example", "one@alpha.example"]);
      expect(await listSuppressions({ query: "100%" })).toMatchObject({ matching: 0, total: 3 }); // a wildcard is searched for as text
      expect((await listSuppressions({ query: "_" })).matching).toBe(0);

      await importBounceList(Array.from({ length: 205 }, (_, index) => `bounce${index}@bulk.example`).join("\n"));
      const paged = await listSuppressions({ page: 3 });
      expect(paged).toMatchObject({ total: 208, page: 3, pages: 3 });
      expect(paged.rows).toHaveLength(8);
      expect((await listSuppressions({ page: 99 })).page).toBe(3);
      expect((await listSuppressions({ page: -4 })).page).toBe(1);
    });

    it("exports the whole list as CSV for the sending tool, and logs the export", async () => {
      await addSuppression({ target: "one@alpha.example", reason: "optout", note: 'said "stop"' });
      await addSuppression({ target: "beta.example", reason: "complaint" });
      const exported = await exportSuppressionsCsv();
      expect(exported.count).toBe(2);
      expect(exported.filename).toMatch(/^suppressions-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(exported.csv.startsWith(CSV_BOM)).toBe(true);
      const [header, ...rows] = parseCsv(exported.csv);
      expect(header).toEqual(["type", "value", "reason", "source", "note", "added"]);
      expect(rows.map((row) => row.slice(0, 5))).toEqual([
        ["domain", "beta.example", "complaint", "admin", ""],
        ["address", "one@alpha.example", "optout", "admin", 'said "stop"'],
      ]);
      const [logged] = await audit("suppression.exported");
      expect(logged).toMatchObject({ actorId: founder.id, count: 2 });
      expect(JSON.stringify(logged)).not.toContain("@");

      const request = (origin: string) => exportRoute(new Request(`${ORIGIN}/admin/suppressions/export`, { method: "POST", headers: { origin } }), undefined);
      const response = await request(ORIGIN);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="suppressions-/);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(parseCsv(await response.text())).toHaveLength(3);
      expect((await request("https://evil.example")).status).toBe(403);
    });
  });

  describe("an address that comes back in a later notice", () => {
    it("is stamped again by the daily maintenance run — and was never listable in between", async () => {
      await seed([{ company: "Acme Grounds Ltd", coh: "01111111", email: "tenders@acmegrounds.example", publishedDaysAgo: 20 }]);
      await addSuppression({ target: "tenders@acmegrounds.example", reason: "optout" });
      // The same address, published for a sister company: ingestion makes a new contact row without a stamp.
      await ingest([award({ company: "Acme Grounds North Ltd", coh: "01212121", email: "tenders@acmegrounds.example", publishedDaysAgo: 1 })]);
      expect((await stampOf("tenders@acmegrounds.example")).sort()).toEqual([null, "optout"].sort());
      expect((await buildSelection(segment(), NOW)).summary).toMatchObject({ listed: 0 });

      const summary = await runMaintenance();
      expect(summary.outreachContactsStamped).toBe(1);
      expect(await stampOf("tenders@acmegrounds.example")).toEqual(["optout", "optout"]);
      expect((await runMaintenance()).outreachContactsStamped).toBe(0); // nothing left to do
      expect(await syncContactSuppressions()).toBe(0);
    });
  });

  describe("the forms", () => {
    it("add, import and remove answer with a notice on the page", async () => {
      await campaignInThreeStates();
      const added = await submit(addSuppressionAction, { target: "tenders@acmegrounds.example", reason: "optout", note: "" });
      expect(added.path).toBe("/admin/suppressions");
      expect(Object.fromEntries(added.params)).toEqual({ notice: "added", n: "1" });
      expect(Object.fromEntries((await submit(addSuppressionAction, { target: "tenders@acmegrounds.example", reason: "optout" })).params)).toEqual({ notice: "already" });
      const invalid = await submit(addSuppressionAction, { target: "nonsense", reason: "optout" });
      expect(readFlashError(Object.fromEntries(invalid.params))).toBe("Enter an e-mail address, or a domain such as example.co.uk.");
      expect(readFlashError(Object.fromEntries((await submit(addSuppressionAction, { target: "one@alpha.example", reason: "because" })).params))).toBeTruthy();

      // Pasted text and an uploaded file together.
      const file = new File(["recipient\r\nfile-bounce@bulk.example\r\noffice@elmcare.example\r\n"], "bounces.csv", { type: "text/csv" });
      const imported = await submit(importBouncesAction, { list: "pasted-bounce@bulk.example\noffice@elmcare.example", file });
      expect(Object.fromEntries(imported.params)).toEqual({ notice: "imported", n: "3" });
      const tooLarge = new File(["x".repeat(500_001)], "huge.txt", { type: "text/plain" });
      expect(readFlashError(Object.fromEntries((await submit(importBouncesAction, { list: "", file: tooLarge })).params))).toBe("That file is larger than 500 KB. Import it in parts.");
      expect(readFlashError(Object.fromEntries((await submit(importBouncesAction, { list: "" })).params))).toContain("No e-mail addresses found");

      const [entry] = await db.select().from(suppressions).where(eq(suppressions.email, "tenders@acmegrounds.example"));
      const wrong = await submit(removeSuppressionAction, { id: entry!.id, confirmation: "something else" });
      expect(readFlashError(Object.fromEntries(wrong.params))).toBe("Type the address or domain exactly as shown to remove it.");
      expect(Object.fromEntries((await submit(removeSuppressionAction, { id: entry!.id, confirmation: "tenders@acmegrounds.example" })).params)).toEqual({ notice: "removed" });
      expect(await db.select().from(suppressions).where(eq(suppressions.email, "tenders@acmegrounds.example"))).toHaveLength(0);
    });
  });

  describe("correction and removal requests", () => {
    const request = (values: Partial<typeof dataRequests.$inferInsert>) =>
      db
        .insert(dataRequests)
        .values({ kind: "removal", requesterEmail: "tenders@acmegrounds.example", message: "Please remove our page.", pageUrl: "https://bidfolio.co.uk/suppliers/acme-grounds-ltd-01111111", organisationName: "Acme Grounds Ltd", ...values })
        .returning({ id: dataRequests.id })
        .then((rows) => rows[0]!.id);

    it("lists open requests oldest first: they have a deadline", async () => {
      await request({ createdAt: daysAgo(1), message: "second" });
      await request({ createdAt: daysAgo(4), message: "first", pageUrl: null });
      await request({ createdAt: daysAgo(9), message: "closed", status: "done", resolvedAt: daysAgo(8) });
      const { open, closed } = await listDataRequests();
      expect(open.map((row) => row.message)).toEqual(["first", "second"]);
      expect(open.map((row) => row.supplierSlug)).toEqual([null, "acme-grounds-ltd-01111111"]);
      expect(closed.map((row) => row.message)).toEqual(["closed"]);
      expect(await countOpenDataRequests()).toEqual({ open: 2, oldestAt: daysAgo(4) });
    });

    it("hide the page: the company is removed everywhere, at once", async () => {
      await seed(FIVE_ELIGIBLE);
      const id = await request({});
      const sent = await submit(resolveDataRequestAction, { id, action: "hide_page" });
      expect(sent.url).toBe("/admin/suppressions?notice=page_hidden#requests");
      expect(revalidated).toContain("tag:procurement"); // public pages are rebuilt now, not when their cache expires

      const [acme] = await db.select().from(suppliers).where(eq(suppliers.name, "Acme Grounds Ltd"));
      expect(acme!.removedAt).not.toBeNull();
      const selection = await buildSelection(segment(), NOW);
      expect(selection.prospects.map((prospect) => prospect.supplier.name)).not.toContain("Acme Grounds Ltd");
      expect(selection.summary.excluded.supplier_removed).toBe(1);
      expect((await db.select().from(dataRequests))[0]).toMatchObject({ status: "done" });
      expect((await audit("data_request.resolved"))[0]).toMatchObject({ actorId: founder.id, metadata: { kind: "removal", action: "hide_page", pageHidden: true } });
      expect(JSON.stringify(await audit("data_request.resolved"))).not.toContain("@");
      // A request that is closed cannot be acted on twice.
      await expect(resolveDataRequest({ id, action: "done" })).rejects.toBeInstanceOf(ConflictError);
    });

    it("erase the contact details: gone from the list and the notices' contact rows, kept on the do-not-contact list", async () => {
      const campaignId = await campaignInThreeStates();
      const id = await request({ kind: "other", message: "Delete my details." });
      const outcome = await resolveDataRequest({ id, action: "erase_contact" });
      expect(outcome).toEqual({ status: "done", pageHidden: false, prospectsErased: 1, contactsDeleted: 1 });

      const acme = await prospectOf("Acme Grounds Ltd", campaignId);
      expect(acme).toMatchObject({ email: null, status: "skipped" });
      expect(acme.erasedAt).not.toBeNull();
      const [row] = await db.select().from(outreachProspects).where(eq(outreachProspects.id, acme.id));
      expect(row).toMatchObject({ emailHash: null, mergeFields: null });
      expect(await stampOf("tenders@acmegrounds.example")).toEqual([]); // the contact row itself is deleted
      expect((await db.select().from(suppressions))[0]).toMatchObject({ email: "tenders@acmegrounds.example", reason: "data_request", source: "admin" });

      // The notice is read again tomorrow: the address comes back as a contact row, and stays unusable.
      await ingest([award({ company: "Acme Grounds Ltd", coh: "01111111", email: "tenders@acmegrounds.example", publishedDaysAgo: 1, title: "Parks Maintenance" })]);
      await db.update(outreachProspects).set({ createdAt: daysAgo(400) });
      const selection = await buildSelection(segment(), NOW);
      expect(selection.prospects.map((prospect) => prospect.supplier.name)).not.toContain("Acme Grounds Ltd");
      expect(selection.summary.excluded.suppressed).toBe(1);
    });

    it("close as done or rejected; refuse what cannot be done", async () => {
      const done = await request({});
      const rejected = await request({});
      const noPage = await request({ pageUrl: "https://bidfolio.co.uk/about-the-data" });
      const badAddress = await request({ requesterEmail: "not-an-address" });
      expect(Object.fromEntries((await submit(resolveDataRequestAction, { id: done, action: "done" })).params)).toEqual({ notice: "request_closed" });
      expect(await resolveDataRequest({ id: rejected, action: "rejected" })).toMatchObject({ status: "rejected" });
      await expect(resolveDataRequest({ id: noPage, action: "hide_page" })).rejects.toBeInstanceOf(ConflictError);
      await expect(resolveDataRequest({ id: badAddress, action: "erase_contact" })).rejects.toBeInstanceOf(ConflictError);
      await expect(resolveDataRequest({ id: "00000000-0000-4000-8000-000000000000", action: "done" })).rejects.toBeInstanceOf(NotFoundError);
      expect(readFlashError(Object.fromEntries((await submit(resolveDataRequestAction, { id: done, action: "delete_everything" })).params))).toBeTruthy();
      expect((await listDataRequests()).open).toHaveLength(2);
    });
  });
});

/** The id of the only campaign in the database. */
async function prospectCampaign(): Promise<string> {
  const rows = (await db.execute(sql`select id from outreach_campaigns limit 1`)) as unknown as Array<{ id: string }>;
  return rows[0]!.id;
}
