/**
 * Values shared by playwright.bids.config.ts and the bids spec. Kept apart from the config
 * on purpose: importing the config from a spec would run it — and the config is what marks
 * a run as a bid desk run (BIDS_E2E), so the spec could never skip itself under `pnpm e2e`.
 */
/** On a production build the dev outbox needs this key (`/dev/outbox?key=…`). */
export const E2E_DEV_TOOLS_SECRET = "e2e-dev-tools-secret-0123456789";
