/**
 * Minimal Better Auth config used ONLY to (re)generate the Drizzle schema for the
 * auth tables:   pnpm auth:schema
 *
 * It mirrors the schema-affecting options of src/lib/auth.ts (plugins, plural
 * table names) without importing app code, so the CLI can load it without env.
 * After regenerating, review the diff of src/db/schema/auth.ts, then run
 * `pnpm db:generate` to produce the SQL migration.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter({} as never, { provider: "pg", usePlural: true }),
  emailAndPassword: { enabled: true },
  plugins: [organization()],
});
