import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * One postgres.js pool per server instance.
 *
 * `prepare: false` keeps us compatible with Neon's pooled (PgBouncer, transaction
 * mode) connection string, which does not support named prepared statements.
 * The pool is small because Vercel Fluid compute reuses instances across requests
 * and Neon's pooler multiplexes connections for us.
 */
function createClient() {
  return postgres(env.DATABASE_URL, {
    prepare: false,
    max: env.NODE_ENV === "test" ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
}

// Reuse the pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __appPgClient?: ReturnType<typeof createClient> };
export const pg = globalForDb.__appPgClient ?? createClient();
if (env.NODE_ENV !== "production") globalForDb.__appPgClient = pg;

export const db = drizzle(pg, { schema });

export type Db = typeof db;
/** A Drizzle transaction handle (same query API as `db`). */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either the pool or an open transaction. */
export type DbOrTx = Db | Tx;

export { schema };
