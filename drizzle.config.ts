import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only diffs the schema against drizzle/meta snapshots, so it
// needs no database. Migrations are applied by `pnpm db:migrate` (scripts/migrate.mjs).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/app_dev" },
  strict: true,
  verbose: false,
});
