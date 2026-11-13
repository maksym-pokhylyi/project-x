/**
 * Removes everything that came from the Paddle SANDBOX from a database — the step before
 * switching PADDLE_ENV to production (README "Before switching PADDLE_ENV to production").
 *
 *   pnpm billing:purge-sandbox            # shows what would be removed
 *   pnpm billing:purge-sandbox --yes      # removes it
 *
 * Removed: subscriptions bought with test cards (their workspaces return to Free and can
 * start a trial again), one-off purchases (unused Bid Passes are taken back), payments,
 * checkout nonces and the stored sandbox events. Rows of the live environment are never
 * touched, whatever PADDLE_ENV says where this runs.
 *
 * Uses DATABASE_URL from the environment / .env.local. Point it at production deliberately:
 *   DATABASE_URL=… pnpm billing:purge-sandbox --yes
 */
import { loadEnv } from "./load-env.mjs";

loadEnv();

async function main(): Promise<void> {
  const confirmed = process.argv.includes("--yes");
  const { purgeSandboxBilling } = await import("../src/lib/billing/environment");
  const { pg } = await import("../src/db");
  const database = new URL(process.env.DATABASE_URL ?? "postgres://unknown/unknown");
  console.log(`Database: ${database.hostname}${database.pathname}`);
  try {
    const summary = await purgeSandboxBilling({ dryRun: !confirmed });
    console.log(`${confirmed ? "Removed" : "Would remove"} sandbox rows:`);
    console.log(`  subscriptions: ${summary.subscriptions}`);
    console.log(`  purchases:     ${summary.purchases}${confirmed ? ` (${summary.unitsRevoked} unused unit(s) taken back, ${summary.unitsAlreadyUsed} already used)` : ""}`);
    console.log(`  payments:      ${summary.payments}`);
    console.log(`  stored events: ${summary.events}`);
    if (!confirmed) console.log("Nothing was changed. Add --yes to remove them.");
  } finally {
    await pg.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(`billing:purge-sandbox failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
