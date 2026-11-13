import { sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));

import PrivacyPage from "@/app/(marketing)/legal/privacy/page";
import { RETENTION_DAYS } from "@/config/retention";
import { db } from "@/db";
import { outreachCampaigns, outreachProspects } from "@/db/schema";
import { addSuppressionEntry } from "@/features/outreach/server/suppression-store";
import { NAMED_ADDRESS_CONTACT_WINDOW_DAYS, outreachEligibility } from "@/features/procurement/domain/outreach";
import { contactFingerprint, erasedPlaceholder } from "@/features/procurement/ingest/contact-erasure";
import { runContactRetention } from "@/features/procurement/retention";
import { runMaintenance } from "@/lib/maintenance";
import { forgetOptionalTables } from "@/lib/optional-table";
import { resetOutreach } from "../outreach/helpers";
import { ACME, ago, contactOf, contacts, DAY_MS, domainOf, expectAddressGone, expectErased, HEATH, MOOR, notice, sha256, storedDaysAgo, WEBMAIL, YEW, type ContactRow, type ContactSpec } from "./helpers/contacts";
import { ingest, NOW } from "./helpers/factory";

/**
 * Storage limitation for contact addresses taken from notices (src/config/retention.ts,
 * `supplierNamedContacts`): an address that identifies a person is erased IN PLACE a month
 * after we first stored it, and reading its notice again never brings it back.
 * All data is fictional (./helpers/contacts.ts).
 */
beforeEach(async () => {
  await resetOutreach(); // the procurement tables, and the outreach tables one rule here looks at
});

describe("contact retention: an address that identifies a person is erased in place after a month", () => {
  it("the period is the outreach gate's one-month window, and the privacy notice states it", () => {
    expect(RETENTION_DAYS.supplierNamedContacts).toBe(30);
    // The same month: an address is kept exactly as long as it could still be written to.
    expect(RETENTION_DAYS.supplierNamedContacts).toBe(NAMED_ADDRESS_CONTACT_WINDOW_DAYS);

    const html = renderToStaticMarkup(PrivacyPage());
    const rows = [...html.matchAll(/<tr>(.*?)<\/tr>/gs)].map((match) => match[1]!.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|"));
    const row = rows.filter((cells) => cells.includes("Contact addresses of named individuals taken from public notices"));
    expect(row).toEqual([
      `|Contact addresses of named individuals taken from public notices|${RETENTION_DAYS.supplierNamedContacts} days, then erased unless you are a customer or asked us not to contact you (in which case only the do-not-contact entry is kept)|`,
    ]);
  });

  it("erases a named address after 30 days; a generic mailbox and a recent named address are untouched", async () => {
    await ingest([notice(HEATH), notice(YEW), notice(ACME)]);
    await storedDaysAgo(HEATH, 31);
    await storedDaysAgo(YEW, 29);
    await storedDaysAgo(ACME, 400);
    const before = { heath: await contactOf(HEATH), yew: await contactOf(YEW), acme: await contactOf(ACME) };
    expect(before.heath).toMatchObject({ email: HEATH.email, kind: "named", erased_at: null });

    expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });

    // In place: the same row, with the address replaced and everything else as it was.
    const heath = await contactOf(HEATH);
    expectErased(heath, HEATH.email!);
    expect(heath.email).toMatch(/^erased:[0-9a-f]{16}$/);
    expect(heath.email).toBe(erasedPlaceholder(contactFingerprint(HEATH.email!)));
    expect(heath).toEqual({ ...before.heath, email: heath.email, email_fingerprint: heath.email_fingerprint, erased_at: NOW.toISOString() });
    await expectAddressGone(HEATH);
    // A recent named address and a role mailbox of a company, however old: exactly as before.
    expect(await contactOf(YEW)).toEqual(before.yew);
    expect(await contactOf(ACME)).toEqual(before.acme);

    // One hour before its month is over an address stays; one hour after, it goes.
    const boundary = new Date(Date.parse(before.yew.first_ingested_at) + RETENTION_DAYS.supplierNamedContacts * DAY_MS);
    expect(await runContactRetention(new Date(boundary.getTime() - 3_600_000))).toEqual({ supplierContactsErased: 0 });
    expect((await contactOf(YEW)).email).toBe(YEW.email);
    const after = new Date(boundary.getTime() + 3_600_000);
    expect(await runContactRetention(after)).toEqual({ supplierContactsErased: 1 });
    expectErased(await contactOf(YEW), YEW.email!, after);
    expect(await contactOf(ACME)).toEqual(before.acme);
  });

  it("a second run changes nothing", async () => {
    await ingest([notice(HEATH), notice(ACME)]);
    await storedDaysAgo(HEATH, 45);
    expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });
    const once = await contacts();
    expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 0 });
    expect(await runContactRetention(new Date(NOW.getTime() + 400 * DAY_MS))).toEqual({ supplierContactsErased: 0 });
    expect(await contacts()).toEqual(once); // the same placeholder, fingerprint and erased_at
  });

  it("treats as a person's address exactly what the outreach gate treats as personal data", async () => {
    await ingest([notice(HEATH), notice(ACME), notice(MOOR), notice(WEBMAIL)]);
    await db.execute(sql`update supplier_contacts set kind = 'freemail' where email = ${WEBMAIL.email!}`);
    await db.execute(sql`update supplier_contacts set first_ingested_at = ${ago(60).toISOString()}::timestamptz`);
    const before = await contacts();
    expect(before.map((row) => [row.email, row.kind, row.name_present])).toEqual([
      [ACME.email, "generic", false],
      [HEATH.email, "named", false],
      [MOOR.email, "generic", true],
      [WEBMAIL.email, "freemail", false],
    ]);

    await runContactRetention(NOW);

    const company = { name: "Acme Grounds Ltd", coh: "01111111", legalForm: "ltd", country: "GB" };
    for (const row of before) {
      const gate = outreachEligibility(company, { email: row.email, kind: row.kind, namePresent: row.name_present, firstIngestedAt: row.first_ingested_at }, NOW);
      const now = (await contacts()).find((candidate) => candidate.id === row.id)!;
      expect(now.erased_at !== null, `${row.kind}, name published: ${row.name_present}`).toBe(gate.personalData);
    }
    expect((await contacts()).filter((row) => row.erased_at === null).map((row) => row.email)).toEqual([ACME.email]);
  });

  it("a suppressed address is erased like any other: the do-not-contact list keeps its own entry", async () => {
    await ingest([notice(HEATH), notice(ACME)]);
    await addSuppressionEntry({ kind: "email", value: HEATH.email!, domain: domainOf(HEATH) }, { reason: "optout", source: "optout_form" });
    await addSuppressionEntry({ kind: "email", value: ACME.email!, domain: domainOf(ACME) }, { reason: "bounce", source: "bounce_import" });
    await storedDaysAgo(HEATH, 31);
    await storedDaysAgo(ACME, 31);
    const stamped = await contactOf(HEATH);
    expect(stamped.suppressed_at).not.toBeNull();

    expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });
    const heath = await contactOf(HEATH);
    expectErased(heath, HEATH.email!);
    expect(heath.suppressed_at).toBe(stamped.suppressed_at); // the row still says it must not be used
    expect((await contactOf(ACME)).email).toBe(ACME.email); // a suppressed role mailbox is not personal data: untouched
    // The list is what keeps the promise, and it is not ours to trim.
    const list = await db.execute<{ email: string; reason: string }>(sql`select email, reason from suppressions order by email`);
    expect([...list]).toEqual([
      { email: HEATH.email, reason: "optout" },
      { email: ACME.email, reason: "bounce" },
    ]);
  });

  it("an address on an outreach list follows that module's retention: left alone until its copy there is erased", async () => {
    await ingest([notice(HEATH), notice(YEW)]);
    await storedDaysAgo(HEATH, 31);
    await storedDaysAgo(YEW, 31);
    const heath = await contactOf(HEATH);
    const [campaign] = await db
      .insert(outreachCampaigns)
      .values({
        name: "Week one",
        segment: { cpvDivisions: [], cpvGroups: [], regions: [], publishedWithinDays: 30, valueMin: null, valueMax: null, mailbox: "generic_and_named", smeOnly: true, batchSize: 100 },
        templateKey: "award_page_v1",
        templateVariant: "s1",
        buildSummary: { companiesMatched: 1, companiesWithoutAddress: 0, addressesConsidered: 1, excluded: {}, notEligibleByReason: {}, eligibleCompanies: 1, listed: 1, listedGeneric: 0, listedNamed: 1 },
      })
      .returning({ id: outreachCampaigns.id });
    await db.insert(outreachProspects).values({
      campaignId: campaign!.id,
      supplierId: heath.supplier_id,
      contactId: heath.id,
      email: HEATH.email!,
      emailHash: contactFingerprint(HEATH.email!),
      emailKind: "named",
      refCode: "Ab3dE6gH9k",
      status: "sent",
      sentAt: ago(20),
      eligibility: { personalData: true, contactBy: ago(1).toISOString(), reasons: [] },
    });

    // Heath was written to: its address stays for as long as the list holds it. Yew goes.
    expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });
    expect((await contactOf(HEATH)).email).toBe(HEATH.email);
    expectErased(await contactOf(YEW), YEW.email!);
    expect(await runContactRetention(new Date(NOW.getTime() + 60 * DAY_MS))).toEqual({ supplierContactsErased: 0 });

    // The outreach module erases its copy (90 days after the letter): the next run follows.
    await db.execute(sql`update outreach_prospects set email = null, erased_at = now()`);
    const later = new Date(NOW.getTime() + 70 * DAY_MS);
    expect(await runContactRetention(later)).toEqual({ supplierContactsErased: 1 });
    expectErased(await contactOf(HEATH), HEATH.email!, later);
    // The fingerprint is the one the prospect row keeps for its cool-off rule.
    const [prospect] = await db.select({ emailHash: outreachProspects.emailHash, contactId: outreachProspects.contactId }).from(outreachProspects);
    expect(prospect).toEqual({ emailHash: (await contactOf(HEATH)).email_fingerprint, contactId: heath.id });
  });

  it("works where the outreach module is not installed", async () => {
    await ingest([notice(HEATH), notice(ACME)]);
    await storedDaysAgo(HEATH, 31);
    await db.execute(sql`alter table outreach_prospects rename to outreach_prospects_not_installed`);
    forgetOptionalTables();
    try {
      expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });
      expectErased(await contactOf(HEATH), HEATH.email!);
    } finally {
      await db.execute(sql`alter table outreach_prospects_not_installed rename to outreach_prospects`);
      forgetOptionalTables();
    }
  });

  it("works through a backlog in batches, oldest first", async () => {
    const specs: ContactSpec[] = [1, 2, 3, 4, 5].map((n) => ({ company: `Backlog ${n} Ltd`, coh: `0900000${n}`, email: `first.last@backlog${n}.example` }));
    await ingest(specs.map(notice));
    for (const [index, spec] of specs.entries()) await storedDaysAgo(spec, 40 - index); // Backlog 1 is the oldest
    await ingest([notice(ACME)]);
    await storedDaysAgo(ACME, 99);

    expect(await runContactRetention(NOW, { batchSize: 2, maxBatches: 2 })).toEqual({ supplierContactsErased: 4 }); // bounded per run
    expect((await contacts()).filter((row) => row.erased_at === null).map((row) => row.email).sort()).toEqual([specs[4]!.email, ACME.email].sort());
    expect(await runContactRetention(NOW, { batchSize: 2, maxBatches: 2 })).toEqual({ supplierContactsErased: 1 }); // the next run continues
    expect(await runContactRetention(NOW, { batchSize: 2, maxBatches: 2 })).toEqual({ supplierContactsErased: 0 });
    expect((await contacts()).filter((row) => row.erased_at === null).map((row) => row.email)).toEqual([ACME.email]);
  });

  it("a second row for an address that is already erased is removed, and the run goes on", async () => {
    await ingest([notice(HEATH), notice(YEW)]);
    await storedDaysAgo(HEATH, 45);
    expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });
    const erased = await contactOf(HEATH);
    // Something outside ingestion (which never does this) stores the address again.
    await db.execute(sql`
      insert into supplier_contacts (id, supplier_id, email, email_domain, kind, source_release_id, first_seen_at, last_seen_at, first_ingested_at)
      values ('ct_stray', ${erased.supplier_id}, ${HEATH.email!}, ${domainOf(HEATH)}, 'named', '000001-2026', now(), now(), ${ago(31).toISOString()}::timestamptz)
    `);
    await storedDaysAgo(YEW, 31);

    // The stray row cannot take the placeholder (it is unique per supplier); it is removed, and Yew is still erased in the same run.
    expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 2 });
    expect(await contactOf(HEATH)).toEqual(erased);
    expectErased(await contactOf(YEW), YEW.email!);
    await expectAddressGone(HEATH);
  });

  it("runs with the daily maintenance job, after the outreach step, and a second run finds nothing left", async () => {
    await ingest([notice(HEATH), notice(ACME)]);
    await db.execute(sql`update supplier_contacts set first_ingested_at = now() - interval '31 days'`);

    expect(await runMaintenance()).toMatchObject({ supplierContactsErased: 1 });
    expect((await contactOf(HEATH)).erased_at).not.toBeNull();
    expect((await contactOf(ACME)).email).toBe(ACME.email);
    expect(await runMaintenance()).toMatchObject({ supplierContactsErased: 0 });
  });
});

describe("ingestion after an address was erased", () => {
  const heathNotice = notice(HEATH);

  /** Heath's address, stored 31 days ago and erased by retention. */
  async function erasedHeath(): Promise<ContactRow> {
    await ingest([heathNotice]);
    await storedDaysAgo(HEATH, 31);
    expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });
    return contactOf(HEATH);
  }

  it("reading the same notice again does not restore the address or restart its clock", async () => {
    const erased = await erasedHeath();

    const again = await ingest([heathNotice]);
    expect(again.contacts).toBe(0);
    await ingest([heathNotice, heathNotice]);
    expect(await contacts()).toEqual([erased]); // one row, the same placeholder, first_ingested_at and erased_at
    await expectAddressGone(HEATH);
    // Nothing for the next retention run to do either.
    expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 0 });
  });

  it("a later notice with the same address does not restore it, however the address is written", async () => {
    const erased = await erasedHeath();
    await ingest([notice({ ...HEATH, title: "Gutter repairs" }), notice({ ...HEATH, title: "Chimney repairs", email: " Sam.Taylor@HeathRoofing.Example " })]);
    expect(await contacts()).toEqual([erased]);
  });

  it("a different address of the same supplier is stored normally", async () => {
    const erased = await erasedHeath();
    const started = Date.now();
    const other = "alex.morgan@heathroofing.example";
    const summary = await ingest([notice({ ...HEATH, title: "Gutter repairs", email: other }), heathNotice]);
    expect(summary.contacts).toBe(1);

    const rows = await contacts();
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === erased.id)).toEqual(erased);
    const added = rows.find((row) => row.id !== erased.id)!;
    expect(added).toMatchObject({ supplier_id: erased.supplier_id, email: other, email_fingerprint: sha256(other), kind: "named", erased_at: null });
    expect(Date.parse(added.first_ingested_at)).toBeGreaterThanOrEqual(started - 5_000); // its own clock starts now
    // …and runs out a month from now, like any other.
    expect(await runContactRetention(new Date(Date.now() + 31 * DAY_MS))).toEqual({ supplierContactsErased: 1 });
    expect((await contacts()).every((row) => row.erased_at !== null)).toBe(true);
  });

  it("stores the fingerprint with a new address, and fills it on a row stored before the column existed", async () => {
    await ingest([heathNotice, notice(ACME)]);
    for (const row of await contacts()) expect(row.email_fingerprint).toBe(sha256(row.email));
    expect(contactFingerprint(" Sam.Taylor@HeathRoofing.Example ")).toBe(sha256(HEATH.email!));

    await db.execute(sql`update supplier_contacts set email_fingerprint = null`);
    await storedDaysAgo(HEATH, 10);
    const before = await contactOf(HEATH);
    await ingest([heathNotice]); // touches Heath's row only
    expect(await contactOf(HEATH)).toEqual({ ...before, email_fingerprint: sha256(HEATH.email!) });
    expect((await contactOf(ACME)).email_fingerprint).toBeNull(); // not touched: the backfill script's job
  });

  describe("when two supplier rows turn out to be one company", () => {
    // Different names, so nothing links them until a notice carries both identifiers.
    const OLD_ROW: ContactSpec = { company: "Northern Roofing", ppon: "PNRF-2222-BBBB" };
    const COMPANY: ContactSpec = { company: "Northern Roofing Contractors Limited", coh: "07770002" };
    const BOTH: ContactSpec = { ...COMPANY, ppon: OLD_ROW.ppon };
    const ADDRESS = "pat.jones@northernroofing.example";
    const at = { email: ADDRESS } as ContactSpec;
    const supplierIdOf = async (name: string) => (await db.execute<{ id: string }>(sql`select id from suppliers where name = ${name}`))[0]!.id;
    const rowsOf = async (supplierId: string) => (await contacts()).filter((row) => row.supplier_id === supplierId);
    const merge = async (email?: string) => {
      const summary = await ingest([notice({ ...BOTH, title: "The notice with both identifiers", email })]);
      expect(summary.merges).toBe(1);
    };

    it("the surviving row holds the address as erased: the folded row's copy is dropped, not moved", async () => {
      await ingest([notice({ ...OLD_ROW, email: ADDRESS })]);
      await ingest([notice({ ...COMPANY, email: ADDRESS })]);
      const [oldRow, company] = [await supplierIdOf(OLD_ROW.company), await supplierIdOf(COMPANY.company)];
      await db.execute(sql`update supplier_contacts set first_ingested_at = ${ago(40).toISOString()}::timestamptz where supplier_id = ${company}`);
      await db.execute(sql`update supplier_contacts set first_ingested_at = ${ago(5).toISOString()}::timestamptz where supplier_id = ${oldRow}`);
      expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });
      const erased = (await rowsOf(company))[0]!;
      expect((await rowsOf(oldRow))[0]).toMatchObject({ email: ADDRESS, erased_at: null });

      await merge();
      expect(await contacts()).toEqual([erased]);
      await expectAddressGone(at);
    });

    it("the folded row holds it as erased and the merging notice publishes it again: it is not stored again", async () => {
      await ingest([notice({ ...OLD_ROW, email: ADDRESS })]);
      await ingest([notice(COMPANY)]);
      const [oldRow, company] = [await supplierIdOf(OLD_ROW.company), await supplierIdOf(COMPANY.company)];
      await db.execute(sql`update supplier_contacts set first_ingested_at = ${ago(40).toISOString()}::timestamptz`);
      expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });
      const erased = (await rowsOf(oldRow))[0]!;

      await merge(ADDRESS);
      // The erased row now belongs to the company, and the notice that caused the merge did not bring the address back.
      expect(await contacts()).toEqual([{ ...erased, supplier_id: company }]);
      // Nor does reading the older notices again, which now resolve to the company.
      await ingest([notice({ ...OLD_ROW, email: ADDRESS }), notice({ ...COMPANY, email: ADDRESS })]);
      expect(await contacts()).toEqual([{ ...erased, supplier_id: company }]);
      await expectAddressGone(at);
    });

    it("the folded row holds it as erased, the surviving row still has it: the company keeps the earlier clock, and retention erases it", async () => {
      await ingest([notice({ ...OLD_ROW, email: ADDRESS })]);
      await ingest([notice({ ...COMPANY, email: ADDRESS })]);
      const [oldRow, company] = [await supplierIdOf(OLD_ROW.company), await supplierIdOf(COMPANY.company)];
      await db.execute(sql`update supplier_contacts set first_ingested_at = ${ago(40).toISOString()}::timestamptz where supplier_id = ${oldRow}`);
      await db.execute(sql`update supplier_contacts set first_ingested_at = ${ago(5).toISOString()}::timestamptz where supplier_id = ${company}`);
      expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });
      expect((await rowsOf(company))[0]).toMatchObject({ email: ADDRESS, first_ingested_at: ago(5).toISOString() });

      await merge(ADDRESS);
      // One company: we have held the address since the earlier day, so it is past its month…
      const kept = await contacts();
      expect(kept).toHaveLength(1);
      expect(kept[0]).toMatchObject({ supplier_id: company, email: ADDRESS, first_ingested_at: ago(40).toISOString(), erased_at: null });
      const gate = outreachEligibility({ name: COMPANY.company, coh: COMPANY.coh!, legalForm: "ltd", country: "GB" }, { email: ADDRESS, kind: kept[0]!.kind, namePresent: false, firstIngestedAt: kept[0]!.first_ingested_at }, NOW);
      expect(gate).toMatchObject({ eligible: false, reasons: ["named_address_past_one_month"] });
      // …and the next run erases it.
      expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });
      expectErased((await contacts())[0]!, ADDRESS);
    });

    it("both rows hold a role mailbox, one of them published with a name: the earlier clock and the name are kept", async () => {
      const mailbox = "info@northernroofing.example";
      await ingest([notice({ ...OLD_ROW, email: mailbox, contactName: "Jo Example" })]);
      await ingest([notice({ ...COMPANY, email: mailbox })]);
      const [oldRow, company] = [await supplierIdOf(OLD_ROW.company), await supplierIdOf(COMPANY.company)];
      await db.execute(sql`update supplier_contacts set first_ingested_at = ${ago(40).toISOString()}::timestamptz where supplier_id = ${oldRow}`);
      await db.execute(sql`update supplier_contacts set first_ingested_at = ${ago(5).toISOString()}::timestamptz where supplier_id = ${company}`);
      expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 }); // the old row's: a name was published with it
      expect((await rowsOf(company))[0]).toMatchObject({ email: mailbox, name_present: false });

      await merge();
      expect(await contacts()).toHaveLength(1);
      expect((await contacts())[0]).toMatchObject({ supplier_id: company, email: mailbox, name_present: true, first_ingested_at: ago(40).toISOString() });
      expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });
    });

    it("an address only the folded row holds moves with its clock", async () => {
      await ingest([notice({ ...OLD_ROW, email: ADDRESS })]);
      await ingest([notice(COMPANY)]);
      const company = await supplierIdOf(COMPANY.company);
      await db.execute(sql`update supplier_contacts set first_ingested_at = ${ago(12).toISOString()}::timestamptz`);
      const before = (await contacts())[0]!;

      await merge(ADDRESS);
      expect(await contacts()).toEqual([{ ...before, supplier_id: company }]); // not a new row with a new month
    });
  });
});

describe("an erased contact is never eligible for outreach", () => {
  const company = { name: "Heath Roofing Ltd", coh: "05050505", legalForm: "ltd", country: "GB" };

  it("the gate takes the placeholder for what it is: not an e-mail address", () => {
    const placeholder = erasedPlaceholder(contactFingerprint(HEATH.email!));
    // Whatever else is true of the row — even a role mailbox stored today.
    for (const kind of ["generic", "named", "freemail"]) {
      for (const namePresent of [false, true]) {
        const gate = outreachEligibility(company, { email: placeholder, kind, namePresent, firstIngestedAt: NOW.toISOString() }, NOW);
        expect(gate.eligible, `${kind}/${namePresent}`).toBe(false);
        expect(gate.reasons, `${kind}/${namePresent}`).toContain("invalid_email");
      }
    }
    // The same company and clock with a real address pass, so it is the placeholder that is refused.
    expect(outreachEligibility(company, { email: "tenders@heathroofing.example", kind: "generic", namePresent: false, firstIngestedAt: NOW.toISOString() }, NOW)).toMatchObject({ eligible: true, reasons: [] });
  });

  it("a row as retention leaves it is refused", async () => {
    await ingest([notice(HEATH)]);
    await storedDaysAgo(HEATH, 31);
    await runContactRetention(NOW);
    const row = await contactOf(HEATH);
    // Read as the builder reads it, with a clock that alone would let it through.
    const gate = outreachEligibility(company, { email: row.email, kind: row.kind, namePresent: row.name_present, firstIngestedAt: NOW.toISOString(), suppressedAt: row.suppressed_at }, NOW);
    expect(gate).toMatchObject({ eligible: false, reasons: ["invalid_email"] });
  });
});
