import { afterEach, describe, expect, it, vi } from "vitest";

/** Loads src/env.ts fresh with ONLY the given overrides on top of the test environment. */
async function loadEnv(overrides: Record<string, string>) {
  vi.unstubAllEnvs();
  vi.resetModules();
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
  return import("@/env");
}

describe("environment validation and feature flags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("enables dev tools and outbox-based verification in development and tests", async () => {
    const { features } = await loadEnv({});
    expect(features).toMatchObject({ devTools: true, emailConfigured: false, requireEmailVerification: true, isRealProduction: false });
    expect(features).toMatchObject({ paddleApi: false, paddleCheckout: false, paddleWebhooks: true, googleOAuth: false, blobStorage: false });
  });

  it("keeps dev tools off on a production build unless DEV_TOOLS=1", async () => {
    expect((await loadEnv({ NODE_ENV: "production" })).features.devTools).toBe(false);
    expect((await loadEnv({ NODE_ENV: "production", DEV_TOOLS: "0" })).features.devTools).toBe(false);
    expect((await loadEnv({ NODE_ENV: "production", DEV_TOOLS: "1" })).features.devTools).toBe(true);
  });

  it("can never enable dev tools on a Vercel production deployment", async () => {
    const { features } = await loadEnv({ NODE_ENV: "production", VERCEL_ENV: "production", DEV_TOOLS: "1" });
    expect(features.devTools).toBe(false);
    expect(features.isRealProduction).toBe(true);
    // No way to deliver or read e-mail there: verification stays REQUIRED and sign-up is off (F-04).
    expect(features).toMatchObject({ requireEmailVerification: true, signUpEnabled: false, passwordResetEnabled: false, mailDelivery: "none" });
  });

  it("requires e-mail verification in production once Resend is configured", async () => {
    const { features } = await loadEnv({ NODE_ENV: "production", VERCEL_ENV: "production", RESEND_API_KEY: "re_live_key", EMAIL_FROM: "Bidfolio <no-reply@bidfolio.co.uk>" });
    expect(features).toMatchObject({ emailConfigured: true, requireEmailVerification: true, devTools: false, signUpEnabled: true, passwordResetEnabled: true, mailDelivery: "resend" });
  });

  it("derives the canonical URL", async () => {
    expect((await loadEnv({ NEXT_PUBLIC_APP_URL: "https://bidfolio.co.uk/" })).appUrl).toBe("https://bidfolio.co.uk");
    const vercel = await loadEnv({ NEXT_PUBLIC_APP_URL: "", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "bidfolio.co.uk", VERCEL_URL: "x-123.vercel.app" });
    expect(vercel.appUrl).toBe("https://bidfolio.co.uk");
    const preview = await loadEnv({ NEXT_PUBLIC_APP_URL: "", VERCEL_ENV: "preview", VERCEL_URL: "x-123.vercel.app" });
    expect(preview.appUrl).toBe("https://x-123.vercel.app");
    expect((await loadEnv({ NEXT_PUBLIC_APP_URL: "" })).appUrl).toBe("http://localhost:3000");
  });

  it("validates the procurement module's settings, which it reads from here and nowhere else", async () => {
    const { env } = await loadEnv({ PUBLIC_DATA_PAGES_INDEXABLE: "true", AI_MODEL_MATCH_REASON: "test/model", FTS_API_BASE: " https://fts.example.test ", FTS_USER_AGENT: "bidfolio-test/1.0" });
    expect(env).toMatchObject({ PUBLIC_DATA_PAGES_INDEXABLE: "true", AI_MODEL_MATCH_REASON: "test/model", FTS_API_BASE: "https://fts.example.test", FTS_USER_AGENT: "bidfolio-test/1.0" });
    const { procurementConfig } = await import("@/features/procurement/config");
    expect(procurementConfig).toMatchObject({ publicDataPagesIndexable: true, matchReasonModel: "test/model", ftsApiBase: "https://fts.example.test", ftsUserAgent: "bidfolio-test/1.0" });

    // Empty means "not set": the module's own defaults apply, and supplier pages stay out of search engines.
    const blank = await loadEnv({ PUBLIC_DATA_PAGES_INDEXABLE: "", AI_MODEL_MATCH_REASON: "", FTS_API_BASE: "", FTS_USER_AGENT: "" });
    expect(blank.env).toMatchObject({ PUBLIC_DATA_PAGES_INDEXABLE: undefined, FTS_API_BASE: undefined });
    const defaults = (await import("@/features/procurement/config")).procurementConfig;
    expect(defaults).toMatchObject({ publicDataPagesIndexable: false, matchReasonModel: "google/gemini-2.5-flash-lite", ftsApiBase: "https://www.find-tender.service.gov.uk", ftsUserAgent: "procurement-data-client/1.0" });
    expect((await loadEnv({ PUBLIC_DATA_PAGES_INDEXABLE: "yes" }).then(() => import("@/features/procurement/config"))).procurementConfig.publicDataPagesIndexable).toBe(false);

    await expect(loadEnv({ FTS_API_BASE: "not a url" })).rejects.toThrow(/FTS_API_BASE/);
  });

  it("parses ADMIN_EMAILS case-insensitively", async () => {
    const { adminEmails } = await loadEnv({ ADMIN_EMAILS: " Founder@Example.com , ops@example.com,," });
    expect([...adminEmails]).toEqual(["founder@example.com", "ops@example.com"]);
  });

  it("fails fast with variable names (never values) when required settings are missing or malformed", async () => {
    const secretLookingValue = "mysql://user:hunter2@host/db";
    const error = await loadEnv({ DATABASE_URL: secretLookingValue, BETTER_AUTH_SECRET: "too-short" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("BETTER_AUTH_SECRET");
    expect(message).not.toContain("hunter2");
    expect(message).not.toContain("too-short");
    await expect(loadEnv({ DATABASE_URL: "" })).rejects.toThrow(/DATABASE_URL/);
    await expect(loadEnv({ PADDLE_ENV: "live" })).rejects.toThrow(/PADDLE_ENV/);
  });
});
