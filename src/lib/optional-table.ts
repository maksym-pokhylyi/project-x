import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { describeError, summarizeError } from "./describe-error";
import { log } from "./logger";

/**
 * Reading a table that ANOTHER module owns and that may not be installed in this
 * deployment yet (the bid desk's `bids` arrives with its own migration).
 *
 *   const started = await queryOptionalTable("bids", () => db.execute(sql`select count(*) from bids`));
 *   // null -> the module is absent: show "—", never a made-up zero
 *
 * Returns null when the table does not exist, or when the query names a column the table
 * does not have (the other module's schema moved on): both mean "not measurable here", not
 * an error of this request. Anything else is thrown as usual.
 */
const present = new Set<string>();

export async function optionalTableExists(table: string): Promise<boolean> {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error(`not a table name: ${table}`);
  if (present.has(table)) return true;
  const rows = (await db.execute(sql`select to_regclass(${`public.${table}`}) is not null as present`)) as unknown as Array<{ present: boolean }>;
  const exists = rows[0]?.present === true;
  // Only a positive answer is remembered: a table appears with a deploy, it does not disappear.
  if (exists) present.add(table);
  return exists;
}

const UNDEFINED_TABLE = "42P01";
const UNDEFINED_COLUMN = "42703";

export async function queryOptionalTable<T>(table: string, run: () => Promise<T>): Promise<T | null> {
  if (!(await optionalTableExists(table))) return null;
  try {
    return await run();
  } catch (error) {
    const described = describeError(error);
    if (described.code === UNDEFINED_TABLE || described.code === UNDEFINED_COLUMN) {
      present.delete(table);
      log.warn("optional table could not be read", { table, reason: summarizeError(described) });
      return null;
    }
    throw error;
  }
}

/** For tests that create and drop the optional tables. */
export function forgetOptionalTables(): void {
  present.clear();
}
