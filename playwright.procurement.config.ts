import { defineConfig, devices } from "@playwright/test";
import { E2E_DEV_TOOLS_SECRET } from "./e2e/bids.env";

/**
 * End-to-end tests of the procurement module (public data pages, claim flow, Radar)
 * against a production build and a dedicated local database seeded by
 * e2e/procurement.global-setup.ts. Nothing here talks to the internet.
 *
 *   pnpm exec playwright test -c playwright.procurement.config.ts --trace off
 *   E2E_SKIP_BUILD=1 …                      # reuse the existing .next build
 *
 * A separate config (own port and database) so it can run next to the foundation's
 * `pnpm e2e`. At integration the seeding can move into the main global setup and this
 * file can go.
 */
const PORT = Number(process.env.E2E_PORT ?? 3108);
const BASE_URL = `http://localhost:${PORT}`;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://app:app@localhost:5432/bidfolio_b1_e2e";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "/opt/pw-browsers";
process.env.E2E_DATABASE_URL = DATABASE_URL;
process.env.PROCUREMENT_E2E = "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/procurement*.spec.ts",
  globalSetup: "./e2e/procurement.global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: BASE_URL, trace: "off", screenshot: "only-on-failure", video: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The database is rebuilt for every run, so what the last run's pages cached (unstable_cache, kept under
    // .next/cache between starts) goes too: otherwise a supplier page can show the previous seed's numbers.
    command: `${process.env.E2E_SKIP_BUILD ? "" : "pnpm exec next build && "}rm -rf .next/cache/fetch-cache && pnpm exec next start -p ${PORT}`,
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
      ADMIN_EMAILS: "founder@e2e.test",
      CRON_SECRET: "e2e-cron-secret-0123456789",
      // Production build, but the dev outbox must be reachable to read verification links.
      DEV_TOOLS: "1",
      DEV_TOOLS_SECRET: E2E_DEV_TOOLS_SECRET,
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
