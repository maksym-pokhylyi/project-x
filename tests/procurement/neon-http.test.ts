import { neon, neonConfig } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { queryRows, rowsOf } from "@/features/procurement/ingest/sql";
import { upsertBatch } from "@/features/procurement/ingest/upsert";
import { rebuildSupplierProfiles } from "@/features/procurement/profiles/build";
import { resetDatabase } from "../helpers/db";
import { fixture, mapped, NOW } from "./helpers/factory";
import { startNeonHttpProxy } from "./helpers/neon-http-proxy";
import { resetProcurement } from "./helpers/schema";

/**
 * scripts/seed-fts.ts --driver neon-http loads a remote Neon database over HTTPS with the
 * same mapper and upsert. Neon's HTTP driver has no interactive transactions and returns
 * `{ rows }` instead of an array, so the ingestion code is written for both. Here the real
 * `drizzle-orm/neon-http` driver runs against a local stand-in for Neon's HTTP endpoint
 * and must leave the database exactly as the postgres-js driver does.
 */
const FIXTURES = ["uk4-tender", "uk4-tender-update", "uk6-award", "uk7-contract", "uk7-terminated-contract", "uk11-termination", "uk7-shared-framework", "uk7-supplier-ppon-only", "uk7-supplier-coh-and-ppon", "legacy-award-no-identifier", "uk7-non-uk-supplier"];
const batch = () => FIXTURES.map((name) => mapped(fixture(name)));

async function snapshot() {
  const [notices, awards, suppliers, profiles, contacts] = await Promise.all([
    db.execute(sql`select id, stage, is_latest, value_amount, cpv_codes, regions, deadline_at, award_criteria, lots from notices order by id`),
    db.execute(sql`select id, supplier_id, is_current, effective_status, ended_early_at, value_amount, lots, contract_end from awards order by id`),
    db.execute(sql`select id, name, coh, ppon, slug, legal_form, is_incorporated, awards_count, total_value, first_award_at from suppliers order by id`),
    db.execute(sql`select supplier_id, cpv_weights, cpv_divisions, keywords, regions, value_low, value_high, summary, top_cpv from supplier_profiles order by supplier_id`),
    db.execute(sql`select supplier_id, email, kind, name_present, first_seen_at from supplier_contacts order by supplier_id, email`),
  ]);
  return JSON.parse(JSON.stringify({ notices, awards, suppliers, profiles, contacts })) as Record<string, unknown[]>;
}

let proxy: Awaited<ReturnType<typeof startNeonHttpProxy>>;

beforeAll(async () => {
  await resetDatabase();
  await resetProcurement();
  proxy = await startNeonHttpProxy(process.env.DATABASE_URL!);
  neonConfig.fetchEndpoint = () => proxy.url;
});

afterAll(async () => {
  await proxy.close();
});

describe("ingestion on the neon-http driver", () => {
  it("normalises both drivers' result shapes", () => {
    expect(rowsOf([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(rowsOf({ rows: [{ a: 1 }], rowCount: 1 })).toEqual([{ a: 1 }]);
    expect(rowsOf(undefined)).toEqual([]);
  });

  it("writes the same rows over HTTP as over a Postgres connection", async () => {
    const summary = await upsertBatch(db, batch());
    await rebuildSupplierProfiles(db, summary.touchedSupplierIds, NOW);
    const viaPostgres = await snapshot();
    expect(viaPostgres.notices).toHaveLength(FIXTURES.length);

    await resetProcurement();
    const http = drizzleNeonHttp(neon("postgres://user:password@db.neon.invalid/main"));
    // The driver really goes through the HTTP endpoint and returns `{ rows }`.
    const probe = await http.execute(sql`select 1 + 1 as two, array['a','b'] as letters, now() as at`);
    expect(Array.isArray(probe)).toBe(false);
    expect(await queryRows(http, sql`select count(*)::int as n from notices`)).toEqual([{ n: 0 }]);

    const before = proxy.statements();
    const overHttp = await upsertBatch(http, batch());
    await rebuildSupplierProfiles(http, overHttp.touchedSupplierIds, NOW);
    expect(overHttp).toMatchObject({ releases: summary.releases, notices: summary.notices, awards: summary.awards, suppliersCreated: summary.suppliersCreated, merges: summary.merges });
    expect(await snapshot()).toEqual(viaPostgres);
    // A whole batch is a few dozen HTTP requests, not thousands: one statement per table and step.
    expect(proxy.statements() - before).toBeLessThan(60);

    // Idempotent over HTTP as well.
    const again = await upsertBatch(http, batch());
    expect(again).toMatchObject({ suppliersCreated: 0, buyersCreated: 0, merges: 0 });
    expect(await snapshot()).toEqual(viaPostgres);
  });
});
