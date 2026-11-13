import { defineConfig, devices } from "@playwright/test";
import { CRON_SECRET, DEV_TOOLS_SECRET } from "./e2e/notifications.shared";

/**
 * End-to-end journey of the scheduled e-mails against a production build, a dedicated
 * local database and the dev outbox (e2e/notifications.spec.ts). Nothing here talks to
 * the internet.
 *
 *   pnpm exec playwright test -c playwright.notifications.config.ts --trace off
 *   E2E_SKIP_BUILD=1 …                      # reuse the existing .next build
 *
 * A separate config (own port and database) so it can run next to the foundation's
 * `pnpm e2e` and the procurement journey. It reuses the procurement seed; at integration
 * the seeding can move into the main global setup and this file can go.
 */
const PORT = Number(process.env.E2E_PORT ?? 3152);
const BASE_URL = `http://localhost:${PORT}`;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://app:app@localhost:5432/bidfolio_ntf_e2e";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "/opt/pw-browsers";
process.env.E2E_DATABASE_URL = DATABASE_URL;
process.env.NOTIFICATIONS_E2E = "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/notifications*.spec.ts",
  globalSetup: "./e2e/notifications.global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
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
      ADMIN_EMAILS: "founder@e2e.test",
      CRON_SECRET,
      // Production build, but with dev tools: the dev outbox is readable (with the key) and the
      // cron tick accepts `?now=` to run scheduled e-mails as if it were Monday morning.
      DEV_TOOLS: "1",
      DEV_TOOLS_SECRET,
      LOG_LEVEL: "warn",
      NOTIFICATIONS_PAUSED: "",
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
