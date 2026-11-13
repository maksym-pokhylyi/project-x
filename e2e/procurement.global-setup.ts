import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as appSchema from "../src/db/schema/app";
import * as authSchema from "../src/db/schema/auth";
import * as procurementSchema from "../src/db/schema/procurement";
import { mapRelease, type MappedRelease } from "../src/features/procurement/domain/map-release";
import { upsertBatch } from "../src/features/procurement/ingest/upsert";
import { rebuildSupplierProfiles } from "../src/features/procurement/profiles/build";
import { clock, contractRelease, planningRelease, tenderRelease } from "../tests/procurement/helpers/releases";

/**
 * Rebuilds the e2e database and seeds a small procurement market through the real
 * pipeline (mapRelease -> upsertBatch -> profile builder):
 *
 *   Acme Grounds Ltd (company no. 01111111) with two grounds-maintenance contracts,
 *   14 open tenders in its trade and region (more than the Free plan's 10) — one of them
 *   with no published value — and one in another region (a wider match), rivals whose
 *   contracts end soon, an early notice, an unrelated trade, a company with a single award
 *   and no open tender near it, and one with 120 contracts (three pages of them).
 *   A finished ingestion run is recorded, so pages can say when the data was updated.
 *
 * Until the procurement tables are in a committed migration they are created here from
 * the Drizzle schema; once the migration exists this step finds them and does nothing.
 */
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://app:app@localhost:5432/bidfolio_b1_e2e";

const LEEDS = { name: "Leeds City Council", ppon: "PLDS-1111-AAAA", region: "UKE42" };
const YORK = { name: "City of York Council", ppon: "PYRK-2222-BBBB", region: "UKE21" };
const BRISTOL = { name: "Bristol City Council", ppon: "PBRS-3333-CCCC", region: "UKK11" };
const GROUNDS = ["77314000"];

export default async function globalSetup() {
  const database = new URL(E2E_DATABASE_URL).pathname.replace(/^\//, "");
  if (!/e2e/i.test(database)) throw new Error(`Refusing to reset database "${database}": its name must contain "e2e".`);
  const client = postgres(E2E_DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
  const db = drizzle(client);
  try {
    await client.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    await migrate(db, { migrationsFolder: "./drizzle" });

    const [existing] = await db.execute<{ present: string | null }>(sql`select to_regclass('public.notices')::text as present`);
    if (!existing?.present) {
      const { generateDrizzleJson, generateMigration } = await import("drizzle-kit/api");
      const before = generateDrizzleJson({ ...authSchema, ...appSchema });
      const after = generateDrizzleJson({ ...authSchema, ...appSchema, ...procurementSchema }, before.id);
      for (const statement of await generateMigration(before, after)) await db.execute(sql.raw(statement));
    }
    for (const statement of readFileSync("./drizzle/extra/procurement.sql", "utf8").split("--> statement-breakpoint")) {
      const text = statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      if (text) await db.execute(sql.raw(text));
    }

    // The running server decides what is live, so the seed is relative to the real clock.
    clock.now = new Date();
    const releases = [
      contractRelease({ title: "Grounds Maintenance Services", buyer: LEEDS, suppliers: [{ name: "Acme Grounds Ltd", coh: "01111111", region: "UKE42", email: "tenders@acmegrounds.example" }], cpv: GROUNDS, value: 120_000, signedDaysAgo: 60, endsInDays: 300 }),
      contractRelease({ title: "Grounds Maintenance for Parks", buyer: YORK, suppliers: [{ name: "Acme Grounds Ltd", coh: "01111111", region: "UKE42" }], cpv: GROUNDS, value: 80_000, signedDaysAgo: 200, endsInDays: 100 }),
      contractRelease({ title: "Cemetery Grounds Maintenance", buyer: LEEDS, suppliers: [{ name: "Rival Landscapes Ltd", coh: "02222222" }], cpv: GROUNDS, value: 90_000, signedDaysAgo: 240, endsInDays: 120, procedure: "Below threshold - without competition", method: "direct" }),
      contractRelease({ title: "Estate Grounds Maintenance", buyer: BRISTOL, suppliers: [{ name: "Southern Gardens Ltd", coh: "03333333", region: "UKK11" }], cpv: GROUNDS, regions: ["UKK"], value: 70_000, signedDaysAgo: 300, endsInDays: 60, procedure: "Below threshold - limited competition", method: "limited" }),
      // A possible sole trader with a personal address: must never surface on a public page.
      contractRelease({ title: "Grass Cutting Rounds", buyer: LEEDS, suppliers: [{ name: "John Smith Gardening", email: "john.smith@gmail.com" }], cpv: GROUNDS, value: 15_000, signedDaysAgo: 100, endsInDays: 90 }),
      contractRelease({ title: "Payroll System Support", buyer: BRISTOL, suppliers: [{ name: "Code Smiths Ltd", coh: "06666666", region: "UKK11" }], cpv: ["72212000"], regions: ["UKK"], endsInDays: 80 }),
      // One award, and no open tender anywhere near its trade: the "no matches right now" state.
      contractRelease({ title: "School Meals Catering", buyer: BRISTOL, suppliers: [{ name: "Harbour Catering Ltd", coh: "07777777", region: "UKK11" }], cpv: ["55524000"], regions: ["UKK"], value: 60_000, endsInDays: 500 }),
      ...Array.from({ length: 14 }, (_, index) =>
        tenderRelease({
          ocid: `ocds-h6vhtk-e${String(index).padStart(5, "0")}`,
          title: index === 0 ? "Grounds Maintenance and Grass Cutting 2027" : `Grounds Maintenance Contract ${index + 1}`,
          buyer: index % 3 === 2 ? YORK : LEEDS,
          cpv: GROUNDS,
          regions: ["UKE"],
          // One notice gives no value: the screens say "Value not published".
          value: index === 4 ? null : 100_000 + index * 5_000,
          deadlineInDays: index === 0 ? 3 : 6 + index * 2,
          aboveThreshold: index % 2 === 1,
        }),
      ),
      // The same work in a region Acme has never worked in: a wider match, counted but not listed on the Free plan.
      tenderRelease({ ocid: "ocds-h6vhtk-w00001", title: "Estate Grounds Maintenance 2027", buyer: BRISTOL, cpv: GROUNDS, regions: ["UKK"], value: 95_000, deadlineInDays: 16 }),
      tenderRelease({ title: "Payroll Software", buyer: BRISTOL, cpv: ["48450000"], regions: ["UKK"], deadlineInDays: 12 }),
      // More than a hundred contracts: three pages of "Show all" (50 a page); in a trade and at end dates that touch nobody else's lists.
      ...Array.from({ length: 120 }, (_, index) =>
        contractRelease({
          title: `Office Cleaning, Building ${index + 1}`,
          buyer: BRISTOL,
          suppliers: [{ name: "Avon Cleaning Services Ltd", coh: "08888888", region: "UKK11" }],
          cpv: ["90919200"],
          regions: ["UKK"],
          value: 20_000 + index * 500,
          signedDaysAgo: 30 + index * 4,
          endsInDays: 500 + index,
        }),
      ),
      planningRelease({ title: "Grounds Maintenance Market Engagement", buyer: YORK, cpv: GROUNDS }),
    ];
    const mapped = releases.map((release) => mapRelease(release)).filter((entry): entry is MappedRelease => entry !== null);
    const summary = await upsertBatch(db, mapped);
    await rebuildSupplierProfiles(db, summary.touchedSupplierIds);
    // What a real ingestion leaves behind: the date behind "updated 13 Nov 2026" on every page.
    await db.insert(procurementSchema.ingestRuns).values({ source: "fts:seed", mode: "seed", status: "ok", finishedAt: new Date(), releases: releases.length, notices: mapped.length });
  } finally {
    await client.end({ timeout: 5 });
  }
}
