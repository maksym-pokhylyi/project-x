/**
 * Runs one ingestion tick from the command line (the same code as /api/cron/ingest).
 *
 *   pnpm exec tsx --import ./scripts/register-server-only.mjs scripts/procurement-ingest.ts [--max-pages 2]
 *   …/procurement-ingest.ts --backfill-until 2026-01-01     # queue the backfill (run by the job worker)
 *   …/procurement-ingest.ts --status                        # cursors, recent runs, table sizes
 *
 * Behind an HTTPS proxy set NODE_USE_ENV_PROXY=1. Be polite: the API is shared.
 */
import { loadEnv } from "./load-env.mjs";

loadEnv();

async function main() {
  const args = process.argv.slice(2);
  const valueOf = (flag: string) => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };
  const { pg } = await import("../src/db");
  const { getIngestionOverview, runIngestion, startBackfill } = await import("../src/features/procurement/ingest/run");
  try {
    if (args.includes("--status")) {
      console.log(JSON.stringify(await getIngestionOverview(), null, 2));
      return;
    }
    const until = valueOf("--backfill-until");
    if (until) {
      const week = await startBackfill(until);
      console.log(week ? `Backfill queued from the week of ${week} back to ${until}.` : "Nothing older to fetch.");
      return;
    }
    const summary = await runIngestion({ maxPages: Number(valueOf("--max-pages") ?? 5), timeBudgetMs: 120_000 });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await pg.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message).slice(0, 1200) : error);
  process.exit(1);
});
