import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end test of the bid desk against a production build, fully offline:
 * the language model is replaced by the deterministic pattern matcher (BIDS_OFFLINE_AI=1)
 * and a paid plan is simulated (BIDS_SIMULATE_PLAN=bid_desk).
 *
 *   pnpm exec playwright test -c playwright.bids.config.ts --trace off
 *   E2E_SKIP_BUILD=1 …            # reuse the existing .next build
 *
 * Kept separate from the foundation's playwright.config.ts so it can run on its own port
 * and database (E2E_PORT / E2E_DATABASE_URL override the defaults below).
 */
const PORT = Number(process.env.E2E_PORT ?? 3115);
const BASE_URL = `http://localhost:${PORT}`;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://app:app@localhost:5432/bidfolio_b2_e2e";
/** On a production build the dev outbox needs this key (`/dev/outbox?key=…`). */
export const E2E_DEV_TOOLS_SECRET = "e2e-dev-tools-secret-0123456789";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "/opt/pw-browsers";
process.env.E2E_DATABASE_URL = E2E_DATABASE_URL;
// The spec skips itself unless it runs under this config (the server needs the offline model).
process.env.BIDS_E2E = "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "bids*.spec.ts",
  globalSetup: "./e2e/bids.global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
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
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789",
      NEXT_PUBLIC_APP_URL: BASE_URL,
      CRON_SECRET: "e2e-cron-secret-0123456789",
      DEV_TOOLS: "1",
      DEV_TOOLS_SECRET: E2E_DEV_TOOLS_SECRET,
      LOG_LEVEL: "warn",
      BIDS_OFFLINE_AI: "1",
      BIDS_SIMULATE_PLAN: "bid_desk",
      RESEND_API_KEY: "",
      PADDLE_API_KEY: "",
      PADDLE_WEBHOOK_SECRET: "",
      NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
      NEXT_PUBLIC_POSTHOG_KEY: "",
      SENTRY_DSN: "",
      BLOB_READ_WRITE_TOKEN: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
  },
});
