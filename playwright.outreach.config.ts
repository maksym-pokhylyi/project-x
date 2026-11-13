import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end test of the founder's outreach tooling (list builder, campaign export, public
 * opt-out, suppression list) against a production build and a dedicated local database
 * seeded by e2e/outreach.global-setup.ts with FICTIONAL companies. Nothing here talks to
 * the internet, and nothing here sends e-mail.
 *
 *   pnpm exec playwright test -c playwright.outreach.config.ts --trace off
 *   E2E_SKIP_BUILD=1 …                      # reuse the existing .next build
 *
 * A separate config (own port and database) so it can run next to the foundation's
 * `pnpm e2e` and the procurement suite. At integration the seeding can move into the main
 * global setup and this file can go.
 */
const PORT = Number(process.env.E2E_PORT ?? 3142);
const BASE_URL = `http://localhost:${PORT}`;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://app:app@localhost:5432/bidfolio_out_e2e";
// e2e/outreach.spec.ts signs up with this address and opens the dev outbox with this key.
const ADMIN_EMAIL = "founder@e2e.test";
/** On a production build the dev outbox needs an admin session or this key (`/dev/outbox?key=…`). */
const DEV_TOOLS_SECRET = "e2e-dev-tools-secret-0123456789";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "/opt/pw-browsers";
process.env.E2E_DATABASE_URL = DATABASE_URL;
process.env.OUTREACH_E2E = "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/outreach*.spec.ts",
  globalSetup: "./e2e/outreach.global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: BASE_URL, trace: "off", screenshot: "only-on-failure", video: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `${process.env.E2E_SKIP_BUILD ? "" : "pnpm exec next build && "}pnpm exec next start -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NODE_ENV: "production",
      DATABASE_URL,
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789",
      NEXT_PUBLIC_APP_URL: BASE_URL,
      ADMIN_EMAILS: ADMIN_EMAIL,
      CRON_SECRET: "e2e-cron-secret-0123456789",
      // Production build, but the dev outbox must be reachable to read the verification link.
      DEV_TOOLS: "1",
      DEV_TOOLS_SECRET,
      LOG_LEVEL: "warn",
      // Force every optional integration OFF, whatever a developer has in .env.local.
      RESEND_API_KEY: "",
      PADDLE_API_KEY: "",
      PADDLE_WEBHOOK_SECRET: "",
      NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
      NEXT_PUBLIC_POSTHOG_KEY: "",
      SENTRY_DSN: "",
      BLOB_READ_WRITE_TOKEN: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      AI_GATEWAY_API_KEY: "",
      AI_DAILY_BUDGET_USD: "0",
      PUBLIC_DATA_PAGES_INDEXABLE: "",
    },
  },
});
