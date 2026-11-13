import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Rebuilds the test database from the committed migrations once per `vitest` run,
 * which also proves the migrations apply cleanly to an empty database.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://app:app@localhost:5432/app_test";
  const database = new URL(url).pathname.replace(/^\//, "");
  if (!/test/i.test(database)) {
    throw new Error(`Refusing to reset database "${database}": the test database name must contain "test".`);
  }
  const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    await client.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  } finally {
    await client.end({ timeout: 5 });
  }
}
