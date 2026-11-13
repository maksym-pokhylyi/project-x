import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { migrationDecision } from "../scripts/migrate-policy.mjs";

/**
 * F-05 — a Vercel Preview build must never migrate the database it is pointed at
 * (which, until the owner separates them, is production's).
 */
describe("db:migrate policy (F-05)", () => {
  it("runs locally and in CI", () => {
    expect(migrationDecision({})).toMatchObject({ run: true });
    expect(migrationDecision({ CI: "true" })).toMatchObject({ run: true });
  });

  it("runs for Vercel production deployments", () => {
    expect(migrationDecision({ VERCEL: "1", VERCEL_ENV: "production" })).toMatchObject({ run: true });
  });

  it("is skipped for Vercel preview and development builds", () => {
    for (const VERCEL_ENV of ["preview", "development"]) {
      const decision = migrationDecision({ VERCEL: "1", VERCEL_ENV });
      expect(decision.run, VERCEL_ENV).toBe(false);
      expect(decision.reason).toContain("only production deployments migrate");
      expect(decision.reason).toContain("MIGRATE_PREVIEW_DATABASE=1");
    }
    // On Vercel but with no environment name: fail safe.
    expect(migrationDecision({ VERCEL: "1" }).run).toBe(false);
  });

  it("can be enabled for a preview environment that has its own database", () => {
    expect(migrationDecision({ VERCEL: "1", VERCEL_ENV: "preview", MIGRATE_PREVIEW_DATABASE: "1" })).toMatchObject({ run: true });
    expect(migrationDecision({ VERCEL: "1", VERCEL_ENV: "preview", MIGRATE_PREVIEW_DATABASE: "0" }).run).toBe(false);
  });

  it("SKIP_DB_MIGRATE=1 always wins", () => {
    expect(migrationDecision({ VERCEL: "1", VERCEL_ENV: "production", SKIP_DB_MIGRATE: "1" }).run).toBe(false);
    expect(migrationDecision({ SKIP_DB_MIGRATE: "1" }).run).toBe(false);
  });

  describe("the script itself", () => {
    // A database that does not exist: reaching it at all would fail the run.
    const UNREACHABLE = "postgres://nobody:nothing@127.0.0.1:1/nowhere";
    const run = (env: Record<string, string>) =>
      spawnSync(process.execPath, ["scripts/migrate.mjs"], {
        env: { PATH: process.env.PATH ?? "", DATABASE_URL: UNREACHABLE, DATABASE_URL_UNPOOLED: UNREACHABLE, ...env } as unknown as NodeJS.ProcessEnv,
        encoding: "utf8",
        timeout: 60_000,
      });

    it("exits 0 without connecting on a preview build", () => {
      const result = run({ VERCEL: "1", VERCEL_ENV: "preview" });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("[db:migrate] SKIPPED");
      expect(result.stdout).toContain("VERCEL_ENV=preview");
      expect(result.stderr).toBe("");
    });

    it("does connect (and here fails) on a production build", () => {
      const result = run({ VERCEL: "1", VERCEL_ENV: "production" });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("[db:migrate] running");
      expect(result.stderr).toContain("FAILED");
      expect(result.stderr).not.toContain("nothing"); // the password is never printed
    });
  });
});
