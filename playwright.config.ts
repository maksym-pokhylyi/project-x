import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a real PRODUCTION build (`next build && next start`)
 * and a dedicated local Postgres database (`app_e2e`), with e-mails captured in the
 * dev outbox. Nothing here talks to the internet.
 *
 *   pnpm e2e                      # build, start, test
 *   E2E_SKIP_BUILD=1 pnpm e2e     # reuse the existing .next build
 *
 * Chromium comes from the preinstalled browsers (PLAYWRIGHT_BROWSERS_PATH); on another
 * machine run `pnpm exec playwright install chromium` once.
 */
const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE_URL = `http://localhost:${PORT}`;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://app:app@localhost:5432/app_e2e";
export const E2E_ADMIN_EMAIL = "founder@e2e.test";
/** On a production build the dev outbox needs an admin session or this key (`/dev/outbox?key=…`). */
export const E2E_DEV_TOOLS_SECRET = "e2e-dev-tools-secret-0123456789";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "/opt/pw-browsers";

const serverEnv: Record<string, string> = {
  NODE_ENV: "production",
  DATABASE_URL: E2E_DATABASE_URL,
  BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789",
  NEXT_PUBLIC_APP_URL: BASE_URL,
  ADMIN_EMAILS: E2E_ADMIN_EMAIL,
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
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `${process.env.E2E_SKIP_BUILD ? "" : "pnpm exec next build && "}pnpm exec next start -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: serverEnv,
  },
});
