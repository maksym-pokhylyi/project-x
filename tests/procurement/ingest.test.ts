import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import type { FetchFtsPage, FtsPage } from "@/features/procurement/ingest/fts-client";
import { getIngestionOverview, runBackfillSlice, runIngestion, startBackfill } from "@/features/procurement/ingest/run";
import { upsertBatch } from "@/features/procurement/ingest/upsert";
import { rebuildSupplierProfiles } from "@/features/procurement/profiles/build";
import { resetDatabase } from "../helpers/db";
import { contractRelease, fixture, ingest, mapped, NOW, tenderRelease } from "./helpers/factory";
import { ensureProcurementSchema, resetProcurement } from "./helpers/schema";

const FIXTURES = [
  "uk4-tender",
  "uk4-tender-update",
  "uk6-award",
  "uk7-contract",
  "uk5-transparency",
  "uk2-planning",
  "uk7-terminated-contract",
  "uk11-termination",
  "uk4-cancelled-tender",
  "uk12-cancellation",
  "uk15-dynamic-market",
  "legacy-award-no-identifier",
  "legacy-tender-scotland",
  "uk7-shared-framework",
  "uk7-non-uk-supplier",
  "uk7-placeholder-value",
  "legacy-award-placeholder-value",
  "uk7-freemail-supplier",
  "uk7-supplier-ppon-only",
  "uk7-supplier-coh-and-ppon",
];
const all = () => FIXTURES.map((name) => mapped(fixture(name)));
const rows = <T extends Record<string, unknown>>(query: ReturnType<typeof sql>) => db.execute<T>(query);

/** Everything observable about the stored data, independent of row ids and write times. */
async function snapshot() {
  const [notices, awards, suppliers, buyers, contacts, aliases] = await Promise.all([
    rows(sql`select id, stage, notice_type, title, is_latest, value_amount, deadline_at, (select name from buyers b where b.id = n.buyer_id) as buyer from notices n order by id`),
    rows(sql`
      select a.id, s.name as supplier, s.coh, a.is_current, a.status, a.effective_status, a.value_amount, a.contract_end, a.supplier_basis
      from awards a join suppliers s on s.id = a.supplier_id order by a.id`),
    rows(sql`
      select name, coh, ppon, identity_basis, legal_form, is_incorporated, scale, awards_count, total_value, buyers_count, slug
      from suppliers where merged_into is null order by name, coh nulls last`),
    rows(sql`select name, ppon, notices_count, awards_count, awards_value, slug from buyers where merged_into is null order by name`),
    rows(sql`select s.name as supplier, c.email, c.kind, c.name_present, c.first_seen_at, c.last_seen_at from supplier_contacts c join suppliers s on s.id = c.supplier_id order by c.email, s.name`),
    rows(sql`select kind, alias_key, (select coalesce(s.name, b.name) from (select 1) x left join suppliers s on s.id = a.entity_id left join buyers b on b.id = a.entity_id) as entity from procurement_aliases a order by kind, alias_key`),
  ]);
  return JSON.parse(JSON.stringify({ notices, awards, suppliers, buyers, contacts, aliases })) as Record<string, Array<Record<string, unknown>>>;
}

beforeAll(async () => {
  await ensureProcurementSchema();
});

beforeEach(async () => {
  await resetDatabase();
  await resetProcurement();
});

describe("upsertBatch on real releases", () => {
  it("stores the batch and derives current state", async () => {
    const summary = await upsertBatch(db, all());
    expect(summary).toMatchObject({ releases: 20, notices: 20, merges: 0 });
    const state = await snapshot();

    // Two versions of the Terra Nova tender: only the update is the latest.
    const terra = state.notices!.filter((notice) => notice.title === "Terra Nova Construction Materials");
    expect(terra.map((notice) => [notice.id, notice.is_latest])).toEqual([
      ["ocds-h6vhtk-069f8b:086022-2026", false],
      ["ocds-h6vhtk-069f8b:086121-2026", true],
    ]);

    // UK6 then UK7 for the same supplier and lot: one current award, and it is the contract.
    const keiser = state.awards!.filter((award) => award.supplier === "KEISER UK LIMITED");
    expect(keiser).toHaveLength(2);
    expect(keiser.filter((award) => award.is_current)).toHaveLength(1);
    expect(keiser.find((award) => award.is_current)).toMatchObject({ contract_end: expect.stringContaining("2027-12-28"), value_amount: "64998.50" });
    expect(state.suppliers!.find((supplier) => supplier.name === "KEISER UK LIMITED")).toMatchObject({ awards_count: 1, total_value: "64998.50", buyers_count: 1, coh: "04264117", legal_form: "ltd" });

    // The contract termination notice (UK11) ends the earlier contract; it still counts as a past win.
    expect(state.awards!.find((award) => award.supplier === "REBOUND RUBBER LIMITED")).toMatchObject({ status: "active", effective_status: "terminated", is_current: true });
    expect(state.suppliers!.find((supplier) => supplier.name === "REBOUND RUBBER LIMITED")).toMatchObject({ awards_count: 1 });

    // The procurement termination notice (UK12) is the latest tender-stage notice of its procurement.
    const cancelled = state.notices!.filter((notice) => notice.title === "Framework for Traffic Management for NGED and NGET");
    expect(cancelled.find((notice) => notice.notice_type === "UK12")).toMatchObject({ is_latest: true });
    expect(cancelled.find((notice) => notice.notice_type === "UK4")).toMatchObject({ is_latest: false });

    // A PPON-only notice and a company-number notice for Biffa resolve to ONE supplier with both contracts.
    const biffa = state.suppliers!.filter((supplier) => String(supplier.name).toLowerCase().startsWith("biffa waste"));
    expect(biffa).toHaveLength(1);
    expect(biffa[0]).toMatchObject({ name: "BIFFA WASTE SERVICES LIMITED", coh: "00946107", ppon: "PRQC-5121-CMBL", identity_basis: "coh", awards_count: 2, total_value: "391922.00", slug: "biffa-waste-services-limited-00946107" });
    expect(state.awards!.filter((award) => award.coh === "00946107").map((award) => award.supplier_basis).sort()).toEqual(["coh", "ppon"]);

    // Shared framework value: six suppliers, none of them credited with the £6.7m.
    const framework = state.suppliers!.filter((supplier) => ["APEXSG LTD", "CARROLL GROUP LIMITED", "A. CONNOLLY LIMITED"].includes(String(supplier.name)));
    expect(framework).toHaveLength(3);
    for (const supplier of framework) expect(supplier).toMatchObject({ awards_count: 1, total_value: "0.00" });

    // Placeholder values are stored as "not published", never as £0 or £1.
    expect(state.suppliers!.find((supplier) => supplier.name === "INPOST UK LIMITED")).toMatchObject({ awards_count: 1, total_value: "0.00" });
    // Dynamic-market members are not suppliers with wins.
    expect(state.notices!.some((notice) => notice.notice_type === "UK15")).toBe(true);
    expect(Number((await rows<{ n: string }>(sql`select count(*) as n from awards a join notices n on n.id = a.notice_id where n.notice_type = 'UK15'`))[0]!.n)).toBe(0);
    // Non-GBP values are stored but kept out of sterling totals.
    expect(state.suppliers!.find((supplier) => supplier.name === "GraphPad Software, LLC")).toMatchObject({ awards_count: 1, total_value: "0.00", is_incorporated: false });

    // Contacts: address, kind and a boolean. No names, no phone numbers anywhere in the table.
    expect(state.contacts!.find((contact) => contact.email === "tender@keiseruk.com")).toMatchObject({ kind: "generic", name_present: false });
    expect(state.contacts!.find((contact) => contact.email === "example.person@gmail.com")).toMatchObject({ kind: "freemail" });
    const contactColumns = (await rows<{ column_name: string }>(sql`select column_name from information_schema.columns where table_name = 'supplier_contacts'`)).map((row) => row.column_name);
    expect(contactColumns).not.toEqual(expect.arrayContaining(["name"]));
    expect(contactColumns.some((column) => /phone|contact_name|person/.test(column))).toBe(false);
  });

  it("is idempotent: the same batch twice changes nothing", async () => {
    await upsertBatch(db, all());
    const before = await snapshot();
    const [ingested] = await rows<{ at: string }>(sql`select min(first_ingested_at)::text as at from supplier_contacts`);
    const again = await upsertBatch(db, all());
    expect(again).toMatchObject({ suppliersCreated: 0, buyersCreated: 0, merges: 0 });
    expect(await snapshot()).toEqual(before);
    // The one-month clock for named addresses starts when we first stored them and is never reset.
    expect((await rows<{ at: string }>(sql`select min(first_ingested_at)::text as at from supplier_contacts`))[0]!.at).toBe(ingested!.at);
  });

  it("is order-independent: newest first, oldest first, or one release at a time give the same state", async () => {
    const byDate = [...all()].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    await upsertBatch(db, byDate);
    const forward = await snapshot();

    await resetProcurement();
    // Backfill order: newest releases first, one at a time.
    for (const release of [...byDate].reverse()) await upsertBatch(db, [release]);
    const backward = await snapshot();
    expect(backward).toEqual(forward);

    await resetProcurement();
    // Interleaved halves, each written twice.
    const odd = byDate.filter((_, index) => index % 2 === 1);
    const even = byDate.filter((_, index) => index % 2 === 0);
    await upsertBatch(db, odd);
    await upsertBatch(db, even);
    await upsertBatch(db, odd);
    expect(await snapshot()).toEqual(forward);
  });

  it("does not let an older release overwrite newer supplier details", async () => {
    const buyer = { name: "Leeds City Council", ppon: "PLDS-1111-AAAA" };
    const newer = contractRelease({ title: "Cleaning 2026", buyer, suppliers: [{ name: "Brightside Cleaning Services Limited", coh: "09990001", region: "UKE42" }], cpv: ["90910000"], signedDaysAgo: 10 });
    const older = contractRelease({ title: "Cleaning 2025", buyer, suppliers: [{ name: "BRIGHTSIDE CLEANING LTD (old name)", coh: "09990001", region: "UKD33", scale: "large" }], cpv: ["90910000"], signedDaysAgo: 300 });
    await ingest([newer], { profiles: false });
    await ingest([older], { profiles: false });
    const [supplier] = await rows<Record<string, unknown>>(sql`select name, region, scale, awards_count, slug from suppliers where coh = '09990001'`);
    expect(supplier).toMatchObject({ name: "Brightside Cleaning Services Limited", region: "UKE", scale: "sme", awards_count: 2 });
    // The slug is fixed when the row is created and never changes afterwards.
    expect(supplier!.slug).toBe("brightside-cleaning-services-limited-09990001");
  });

  it("re-points awards when two rows turn out to be the same company", async () => {
    const buyer = { name: "Leeds City Council", ppon: "PLDS-1111-AAAA" };
    // Different names, so nothing links them until a notice carries both identifiers.
    await ingest([contractRelease({ title: "A", buyer, suppliers: [{ name: "Northern Roofing", ppon: "PNRF-2222-BBBB" }], cpv: ["45261000"] })], { profiles: false });
    await ingest([contractRelease({ title: "B", buyer, suppliers: [{ name: "Northern Roofing Contractors Limited", coh: "07770002" }], cpv: ["45261000"] })], { profiles: false });
    expect(Number((await rows<{ n: string }>(sql`select count(*) as n from suppliers where merged_into is null`))[0]!.n)).toBe(2);

    const summary = await ingest([contractRelease({ title: "C", buyer, suppliers: [{ name: "Northern Roofing Contractors Limited", coh: "07770002", ppon: "PNRF-2222-BBBB" }], cpv: ["45261000"] })], { profiles: false });
    expect(summary.merges).toBe(1);
    const suppliers = await rows<Record<string, unknown>>(sql`select name, coh, ppon, awards_count, merged_into is not null as merged from suppliers order by merged, name`);
    expect(suppliers).toEqual([
      expect.objectContaining({ name: "Northern Roofing Contractors Limited", coh: "07770002", ppon: "PNRF-2222-BBBB", awards_count: 3, merged: false }),
      expect.objectContaining({ name: "Northern Roofing", awards_count: 0, merged: true }),
    ]);
  });

  it("rebuilds profiles only for suppliers that have counted awards", async () => {
    const summary = await upsertBatch(db, all());
    const written = await rebuildSupplierProfiles(db, summary.touchedSupplierIds, NOW);
    const [counts] = await rows<{ suppliers: string; profiles: string }>(sql`select (select count(*) from suppliers where merged_into is null and awards_count > 0) as suppliers, (select count(*) from supplier_profiles) as profiles`);
    expect(written).toBe(Number(counts!.profiles));
    expect(Number(counts!.profiles)).toBe(Number(counts!.suppliers));
    const [keiser] = await rows<Record<string, unknown>>(sql`select p.cpv_divisions, p.regions, p.awards_count, p.summary from supplier_profiles p join suppliers s on s.id = p.supplier_id where s.coh = '04264117'`);
    expect(keiser).toMatchObject({ cpv_divisions: ["37"], awards_count: 1 });
    expect(String(keiser!.summary)).toContain("KEISER UK LIMITED is named in 1 published public contract award");
  });
});

describe("runIngestion (incremental, with a fake API)", () => {
  const page = (releases: unknown[], next: string | null = null): FtsPage => ({ ok: true, releases: releases as never, next });
  const base = "https://www.find-tender.service.gov.uk";
  const options = { requestGapMs: 0, sleep: async () => undefined, now: NOW };

  it("reads a window to its last page, moves the cursor and records the run", async () => {
    const calls: string[] = [];
    const fetchPage: FetchFtsPage = async (url) => {
      calls.push(url);
      return calls.length === 1 ? page([fixture("uk6-award"), fixture("uk4-tender")], `${base}/api/1.0/ocdsReleasePackages?cursor=abc`) : page([fixture("uk7-contract")]);
    };
    const summary = await runIngestion({ ...options, fetchPage });
    expect(summary).toMatchObject({ status: "ok", pages: 2, releases: 3, notices: 3, windowComplete: true, windowTo: "2026-11-13T12:00:00" });
    // First run: the last 24 hours.
    expect(calls[0]).toBe(`${base}/api/1.0/ocdsReleasePackages?updatedFrom=2026-11-12T12%3A00%3A00&updatedTo=2026-11-13T12%3A00%3A00&limit=100`);
    expect(calls[1]).toContain("cursor=abc");
    const [state] = await rows<Record<string, unknown>>(sql`select cursor, next_url, locked_until from ingest_state where source = 'fts:incremental'`);
    expect(state).toMatchObject({ cursor: "2026-11-13T12:00:00", next_url: null, locked_until: null });
    // Profiles of the touched suppliers were rebuilt.
    expect(Number((await rows<{ n: string }>(sql`select count(*) as n from supplier_profiles`))[0]!.n)).toBe(1);

    // The next run starts two minutes before the cursor.
    const later = new Date(NOW.getTime() + 10 * 60_000);
    const second: string[] = [];
    await runIngestion({ ...options, now: later, fetchPage: async (url) => (second.push(url), page([])) });
    expect(second[0]).toContain("updatedFrom=2026-11-13T11%3A58%3A00&updatedTo=2026-11-13T12%3A10%3A00");
    const overview = await getIngestionOverview();
    expect(overview.runs).toHaveLength(1); // the quiet second tick is not logged
    expect(overview.runs[0]).toMatchObject({ mode: "incremental", status: "ok", pages: 2, releases: 3 });
    expect(overview.counts).toMatchObject({ notices: 3, suppliers: 1 });
  });

  it("resumes an interrupted window from the saved cursor without moving the watermark", async () => {
    const nextUrl = `${base}/api/1.0/ocdsReleasePackages?cursor=page2`;
    const first = await runIngestion({ ...options, maxPages: 1, fetchPage: async () => page([fixture("uk6-award")], nextUrl) });
    expect(first).toMatchObject({ status: "partial", pages: 1, windowComplete: false });
    const [mid] = await rows<Record<string, unknown>>(sql`select cursor, next_url, window_to from ingest_state where source = 'fts:incremental'`);
    expect(mid).toMatchObject({ cursor: null, next_url: nextUrl, window_to: "2026-11-13T12:00:00" });

    const calls: string[] = [];
    const second = await runIngestion({ ...options, now: new Date(NOW.getTime() + 600_000), fetchPage: async (url) => (calls.push(url), page([fixture("uk7-contract")])) });
    expect(calls).toEqual([nextUrl]);
    expect(second).toMatchObject({ status: "ok", windowComplete: true, windowTo: "2026-11-13T12:00:00" });
    const [done] = await rows<Record<string, unknown>>(sql`select cursor, next_url from ingest_state where source = 'fts:incremental'`);
    expect(done).toMatchObject({ cursor: "2026-11-13T12:00:00", next_url: null });
  });

  it("backs off on HTTP 429 and keeps its place", async () => {
    const summary = await runIngestion({ ...options, fetchPage: async () => ({ ok: false, kind: "rate_limited", retryAfterSeconds: 120 }) });
    expect(summary).toMatchObject({ status: "rate_limited", rateLimited: 1, pages: 0, windowComplete: false });
    const [pacer] = await rows<{ wait: string }>(sql`select extract(epoch from (next_request_at - now()))::int as wait from ingest_state where source = 'fts:pacer'`);
    expect(Number(pacer!.wait)).toBeGreaterThan(100);
    const [state] = await rows<Record<string, unknown>>(sql`select cursor, locked_until from ingest_state where source = 'fts:incremental'`);
    expect(state).toMatchObject({ cursor: null, locked_until: null });
  });

  it("reports API errors without touching the cursor and refuses cursors from another host", async () => {
    const failed = await runIngestion({ ...options, fetchPage: async () => ({ ok: false, kind: "error", status: 500, message: "HTTP 500" }) });
    expect(failed).toMatchObject({ status: "error", error: "Find a Tender API: HTTP 500" });
    const foreign = await runIngestion({ ...options, fetchPage: async () => page([fixture("uk6-award")], "https://evil.example/api?cursor=x") });
    // The foreign `links.next` is ignored: the window ends there.
    expect(foreign).toMatchObject({ status: "ok", pages: 1, windowComplete: true });
  });

  it("is single-flight: a run that finds the lease taken exits as skipped", async () => {
    await db.execute(sql`insert into ingest_state (source, locked_until) values ('fts:incremental', now() + interval '5 minutes')`);
    let called = false;
    const summary = await runIngestion({ ...options, fetchPage: async () => ((called = true), page([])) });
    expect(summary.status).toBe("skipped");
    expect(called).toBe(false);
  });

  it("paces requests through the shared slot clock", async () => {
    const waits: number[] = [];
    let calls = 0;
    await runIngestion({
      now: NOW,
      requestGapMs: 10_000,
      sleep: async (ms) => void waits.push(ms),
      fetchPage: async () => ((calls += 1), calls < 3 ? page([], `${base}/api/1.0/ocdsReleasePackages?cursor=${calls}`) : page([])),
    });
    expect(calls).toBe(3);
    // The first request goes out at once; each later one waits for its ~10 s slot.
    expect(waits).toHaveLength(2);
    for (const wait of waits) expect(wait).toBeGreaterThan(9_000);
  });
});

describe("backfill (week by week, via queued jobs)", () => {
  const options = { requestGapMs: 0, sleep: async () => undefined, now: NOW };
  const jobs = () => rows<{ type: string; payload: Record<string, unknown>; dedupe_key: string }>(sql`select type, payload, dedupe_key from jobs order by created_at`);

  it("queues the week before the oldest data and walks back until the limit", async () => {
    await ingest([tenderRelease({ title: "Anything", buyer: { name: "Leeds City Council", ppon: "PLDS-1111-AAAA" }, cpv: ["45000000"], publishedDaysAgo: 3 })], { profiles: false });
    expect(await startBackfill("2026-10-20", NOW)).toBe("2026-11-03");
    expect(await jobs()).toEqual([expect.objectContaining({ type: "procurement.backfill", payload: { weekStart: "2026-11-03", until: "2026-10-20", part: 0 }, dedupe_key: "procurement.backfill:2026-11-03:0" })]);

    const urls: string[] = [];
    const summary = await runBackfillSlice({ weekStart: "2026-11-03", until: "2026-10-20", part: 0 }, { ...options, fetchPage: async (url) => (urls.push(url), { ok: true, releases: [fixture("uk6-award")] as never, next: null }) });
    expect(summary).toMatchObject({ mode: "backfill", status: "ok", windowComplete: true });
    expect(urls[0]).toContain("updatedFrom=2026-11-03T00%3A00%3A00&updatedTo=2026-11-10T00%3A00%3A00");
    // The finished week queues the one before it…
    expect((await jobs()).map((job) => job.dedupe_key)).toEqual(["procurement.backfill:2026-11-03:0", "procurement.backfill:2026-10-27:0"]);
    await runBackfillSlice({ weekStart: "2026-10-27", until: "2026-10-20", part: 0 }, { ...options, fetchPage: async () => ({ ok: true, releases: [], next: null }) });
    await runBackfillSlice({ weekStart: "2026-10-20", until: "2026-10-20", part: 0 }, { ...options, fetchPage: async () => ({ ok: true, releases: [], next: null }) });
    // …and stops at `until`.
    expect((await jobs()).map((job) => job.dedupe_key)).toEqual(["procurement.backfill:2026-11-03:0", "procurement.backfill:2026-10-27:0", "procurement.backfill:2026-10-20:0"]);
    expect((await rows<{ cursor: string }>(sql`select cursor from ingest_state where source = 'fts:backfill'`))[0]!.cursor).toBe("2026-10-20");
    expect(await startBackfill("2026-10-20", NOW)).toBeNull();
  });

  it("queues its own continuation when a week does not fit one slice or the API says slow down", async () => {
    const next = "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?cursor=more";
    await runBackfillSlice({ weekStart: "2026-11-03", until: "2026-10-01", part: 0 }, { ...options, maxPages: 1, fetchPage: async () => ({ ok: true, releases: [], next }) });
    await runBackfillSlice({ weekStart: "2026-11-03", until: "2026-10-01", part: 1 }, { ...options, fetchPage: async () => ({ ok: false, kind: "rate_limited", retryAfterSeconds: 120 }) });
    expect((await jobs()).map((job) => job.dedupe_key)).toEqual(["procurement.backfill:2026-11-03:1", "procurement.backfill:2026-11-03:2"]);
    const [state] = await rows<Record<string, unknown>>(sql`select next_url from ingest_state where source = 'fts:backfill:2026-11-03'`);
    expect(state!.next_url).toBe(next);
    await expect(runBackfillSlice({ weekStart: "nonsense", until: "2026-10-01" }, options)).rejects.toThrow("bad payload");
  });
});
