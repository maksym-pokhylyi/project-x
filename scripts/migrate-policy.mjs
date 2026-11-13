// Decides whether `pnpm db:migrate` may touch the database in the current environment.
//
// Every Vercel build runs "pnpm db:migrate && pnpm build" (vercel.json). A Preview build of
// a work-in-progress branch must never apply that branch's migrations to a database it
// happens to be pointed at — least of all production's. So on Vercel, migrations run ONLY
// for production deployments, unless a Preview environment explicitly declares that it
// has its own database (MIGRATE_PREVIEW_DATABASE=1, e.g. a Neon branch).
//
// Pure function, no I/O: unit-tested in tests/migrate-policy.test.ts.

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ run: boolean, reason: string }}
 */
export function migrationDecision(env) {
  if (env.SKIP_DB_MIGRATE === "1") return { run: false, reason: "SKIP_DB_MIGRATE=1" };

  const vercelEnv = env.VERCEL_ENV;
  const onVercel = Boolean(env.VERCEL) || Boolean(vercelEnv);
  if (!onVercel) return { run: true, reason: "not on Vercel (local machine or CI)" };
  if (vercelEnv === "production") return { run: true, reason: "Vercel production deployment" };

  if (env.MIGRATE_PREVIEW_DATABASE === "1") {
    return {
      run: true,
      reason: `VERCEL_ENV=${vercelEnv ?? "unset"} with MIGRATE_PREVIEW_DATABASE=1 (this environment declares its own database)`,
    };
  }
  return {
    run: false,
    reason:
      `VERCEL_ENV=${vercelEnv ?? "unset"}: only production deployments migrate. ` +
      "Give this environment its own DATABASE_URL (a Neon branch) and set MIGRATE_PREVIEW_DATABASE=1 to migrate it; " +
      "never point it at the production database.",
  };
}
