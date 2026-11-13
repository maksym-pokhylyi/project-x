// Applies the committed SQL migrations in ./drizzle to the database.
//
//   pnpm db:migrate
//
// Non-interactive and idempotent: safe to run on every Vercel build
// ("pnpm db:migrate && next build"). Plain .mjs on purpose, so it has no
// build-time dependency beyond `postgres` and `drizzle-orm`.
//
// Connection: DATABASE_URL_UNPOOLED (Neon's direct connection, preferred for DDL)
// falls back to DATABASE_URL. `prepare: false` keeps the pooled URL working too.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { loadEnv } from "./load-env.mjs";

// Load .env.local / .env for local runs (no-op on Vercel, where env is injected).
loadEnv();

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("[db:migrate] DATABASE_URL is not set.");
  process.exit(1);
}

const target = (() => {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`; // never log credentials
  } catch {
    return "(unparseable url)";
  }
})();

const client = postgres(url, { prepare: false, max: 1, onnotice: () => {}, connect_timeout: 30 });
const started = Date.now();
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log(`[db:migrate] ok — ${target} is up to date (${Date.now() - started} ms)`);
} catch (error) {
  console.error(`[db:migrate] FAILED on ${target}:`, error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
