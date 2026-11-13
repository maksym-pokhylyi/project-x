import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { mapRelease, type MappedRelease } from "../src/features/procurement/domain/map-release";
import { upsertBatch } from "../src/features/procurement/ingest/upsert";
import { rebuildSupplierProfiles } from "../src/features/procurement/profiles/build";
import { clock, contractRelease } from "../tests/procurement/helpers/releases";

/**
 * Rebuilds the e2e database from the committed migrations and seeds a small, FICTIONAL
 * market through the real pipeline (mapRelease -> upsertBatch -> profile builder). Every
 * company is made up and every address is on the reserved `.example` domain — never put
 * real prospect data here.
 *
 *   three grounds-maintenance companies with a generic mailbox (they can be listed),
 *   one with an address that names a person, one sole trader without a company number, one large
 *   company and one whose award is too old — each left out for its own reason.
 */
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://app:app@localhost:5432/bidfolio_out_e2e";

const LEEDS = { name: "Leeds City Council", ppon: "PLDS-1111-AAAA", region: "UKE42" };
const YORK = { name: "City of York Council", ppon: "PYRK-2222-BBBB", region: "UKE21" };
const GROUNDS = ["77314000"];

export default async function globalSetup() {
  const database = new URL(E2E_DATABASE_URL).pathname.replace(/^\//, "");
  if (!/e2e/i.test(database)) throw new Error(`Refusing to reset database "${database}": its name must contain "e2e".`);
  const client = postgres(E2E_DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
  const db = drizzle(client);
  try {
    await client.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    await migrate(db, { migrationsFolder: "./drizzle" });
    for (const statement of readFileSync("./drizzle/extra/procurement.sql", "utf8").split("--> statement-breakpoint")) {
      const text = statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      if (text) await db.execute(sql.raw(text));
    }

    // The running server decides what "the last 30 days" is, so the seed is relative to the real clock.
    clock.now = new Date();
    const releases = [
      contractRelease({ title: "Grounds Maintenance Services", buyer: LEEDS, suppliers: [{ name: "Acme Grounds Ltd", coh: "01111111", email: "tenders@acmegrounds.example" }], cpv: GROUNDS, value: 120_000, publishedDaysAgo: 2, signedDaysAgo: 4 }),
      contractRelease({ title: "Parks Grass Cutting", buyer: YORK, suppliers: [{ name: "Brightway Landscapes Ltd", coh: "02222222", email: "info@brightway.example" }], cpv: GROUNDS, value: 80_000, publishedDaysAgo: 3, signedDaysAgo: 5 }),
      contractRelease({ title: "Cemetery Grounds Maintenance", buyer: LEEDS, suppliers: [{ name: "Castle Gardens LLP", coh: "OC333333", email: "bids@castlegardens.example" }], cpv: GROUNDS, value: 60_000, publishedDaysAgo: 4, signedDaysAgo: 6 }),
      // Left out, each for its own reason:
      contractRelease({ title: "Estate Grounds Maintenance", buyer: YORK, suppliers: [{ name: "Heath Gardens Ltd", coh: "05050505", email: "sam.taylor@heathgardens.example" }], cpv: GROUNDS, value: 50_000, publishedDaysAgo: 5, signedDaysAgo: 7 }), // a named address
      contractRelease({ title: "Grass Cutting Rounds", buyer: LEEDS, suppliers: [{ name: "Jo Example Gardening", email: "jo@soletrader.example" }], cpv: GROUNDS, value: 15_000, publishedDaysAgo: 6, signedDaysAgo: 8 }), // no company number
      contractRelease({ title: "Citywide Grounds Framework", buyer: LEEDS, suppliers: [{ name: "Fenwick Grounds plc", coh: "04040404", email: "info@fenwickgrounds.example", scale: "large" }], cpv: GROUNDS, value: 900_000, publishedDaysAgo: 7, signedDaysAgo: 9 }), // not an SME
      contractRelease({ title: "Old Verge Cutting Contract", buyer: YORK, suppliers: [{ name: "Old Award Ltd", coh: "03030303", email: "info@oldaward.example" }], cpv: GROUNDS, value: 40_000, publishedDaysAgo: 60, signedDaysAgo: 62 }), // outside the 30 days
      // Another trade altogether.
      contractRelease({ title: "Payroll System Support", buyer: YORK, suppliers: [{ name: "Code Smiths Ltd", coh: "06666666", email: "office@codesmiths.example" }], cpv: ["72212000"], value: 70_000, publishedDaysAgo: 3, signedDaysAgo: 5 }),
    ];
    const mapped = releases.map((release) => mapRelease(release)).filter((entry): entry is MappedRelease => entry !== null);
    const summary = await upsertBatch(db, mapped);
    await rebuildSupplierProfiles(db, summary.touchedSupplierIds);
  } finally {
    await client.end({ timeout: 5 });
  }
}
