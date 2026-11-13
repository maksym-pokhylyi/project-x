import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import * as appSchema from "@/db/schema/app";
import * as authSchema from "@/db/schema/auth";
import * as procurementSchema from "@/db/schema/procurement";

/**
 * The test database is rebuilt from ./drizzle on every run (tests/global-setup.ts). Until
 * the procurement tables are part of a committed migration, this helper creates them from
 * the Drizzle schema (the same DDL `drizzle-kit generate` will emit) plus
 * drizzle/extra/procurement.sql. Once the migration exists it finds the tables and does
 * nothing, so the tests keep working unchanged after integration.
 */
let ready: Promise<void> | null = null;

async function create(): Promise<void> {
  const [existing] = await db.execute<{ present: string | null }>(sql`select to_regclass('public.notices')::text as present`);
  if (!existing?.present) {
    const { generateDrizzleJson, generateMigration } = await import("drizzle-kit/api");
    const before = generateDrizzleJson({ ...authSchema, ...appSchema });
    const after = generateDrizzleJson({ ...authSchema, ...appSchema, ...procurementSchema }, before.id);
    const statements = await generateMigration(before, after);
    for (const statement of statements) await db.execute(sql.raw(statement));
  }
  const extra = readFileSync(fileURLToPath(new URL("../../../drizzle/extra/procurement.sql", import.meta.url)), "utf8");
  for (const statement of extra.split("--> statement-breakpoint")) {
    const text = statement
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim();
    if (text) await db.execute(sql.raw(text));
  }
}

export function ensureProcurementSchema(): Promise<void> {
  ready ??= create();
  return ready;
}

const SHARED_TABLES = [
  "awards",
  "notices",
  "supplier_contacts",
  "supplier_profiles",
  "org_supplier_links",
  "suppliers",
  "buyers",
  "procurement_aliases",
  "cpv_codes",
  "ingest_state",
  "ingest_runs",
  "match_reasons",
  "page_visits",
  "data_requests",
  "radar_items",
  "radar_profiles",
];

/** Empties every procurement table (shared and tenant). */
export async function resetProcurement(): Promise<void> {
  await ensureProcurementSchema();
  await db.execute(sql.raw(`truncate table ${SHARED_TABLES.map((table) => `"${table}"`).join(", ")} restart identity cascade`));
}
