import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://app:app@localhost:5432/app_test";

/**
 * Integration-style unit tests: real Postgres (database `app_test`), no network.
 * - tests/global-setup.ts rebuilds the schema from ./drizzle once per run.
 * - Files run sequentially because they share one database.
 * - `server-only` is stubbed (it only exists to break client bundles).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123456789",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      ADMIN_EMAILS: "founder@example.com",
      CRON_SECRET: "test-cron-secret-0123456789",
      PADDLE_ENV: "sandbox",
      PADDLE_WEBHOOK_SECRET: "pdl_ntfset_test_0123456789abcdef",
      PADDLE_PRICE_STARTER_MONTHLY: "pri_test_starter_monthly",
      PADDLE_PRICE_STARTER_ANNUAL: "pri_test_starter_annual",
      PADDLE_PRICE_PRO_MONTHLY: "pri_test_pro_monthly",
      PADDLE_PRICE_PRO_ANNUAL: "pri_test_pro_annual",
      PADDLE_PRICE_BUSINESS_MONTHLY: "pri_test_business_monthly",
      PADDLE_PRICE_BUSINESS_ANNUAL: "pri_test_business_annual",
      BILLING_PAST_DUE_GRACE_DAYS: "7",
      AI_DAILY_BUDGET_USD: "1",
      // Tests simulate client IPs with X-Forwarded-For (tests/rate-limit.test.ts covers the untrusted default).
      TRUST_PROXY_HEADERS: "1",
      // Explicitly empty so a developer's .env.local can never leak into tests.
      RESEND_API_KEY: "",
      PADDLE_API_KEY: "",
      NEXT_PUBLIC_POSTHOG_KEY: "",
      SENTRY_DSN: "",
      BLOB_READ_WRITE_TOKEN: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
  },
});
