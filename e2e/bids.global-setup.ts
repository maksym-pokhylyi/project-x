import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Rebuilds the e2e database from the committed migrations. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgres://app:app@localhost:5432/bidfolio_b2_e2e";
  const database = new URL(url).pathname.replace(/^\//, "");
  if (!/e2e/i.test(database)) throw new Error(`Refusing to reset database "${database}": its name must contain "e2e".`);
  const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    await client.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  } finally {
    await client.end({ timeout: 5 });
  }
}
