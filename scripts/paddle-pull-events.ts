/**
 * Local end-to-end billing without webhooks.
 *
 * Paddle cannot deliver webhooks to a developer machine. This lists the recent events from
 * the Paddle SANDBOX API and feeds each one through the same pipeline a webhook goes
 * through, so a sandbox checkout made in a local browser becomes a subscription or a
 * purchase in the local database.
 *
 *   pnpm paddle:pull-events                      # events of the last 24 hours
 *   pnpm paddle:pull-events --since 2h           # … of the last 2 hours (30m, 2h, 3d or an ISO time)
 *   pnpm paddle:pull-events --after evt_01…      # … after this event id
 *   pnpm paddle:pull-events --watch              # keep pulling every 5 seconds (--watch 10 for 10)
 *   pnpm paddle:pull-events --limit 50
 *
 * Needs PADDLE_API_KEY (sandbox) and the usual DATABASE_URL / BETTER_AUTH_SECRET in
 * .env.local. Prints one line per event — type, id, outcome — never a payload. Idempotent:
 * an event this database has already processed is reported as `duplicate`.
 *
 * Refuses to run when VERCEL_ENV=production or PADDLE_ENV=production: production receives
 * real, signed webhooks.
 */
import { loadEnv } from "./load-env.mjs";

loadEnv();

function parseSince(value: string): Date {
  const relative = /^(\d{1,4})([mhd])$/.exec(value);
  if (relative) {
    const unit = { m: 60_000, h: 3_600_000, d: 86_400_000 }[relative[2] as "m" | "h" | "d"];
    return new Date(Date.now() - Number(relative[1]) * unit);
  }
  const absolute = new Date(value);
  if (Number.isNaN(absolute.getTime())) throw new Error(`--since: "${value}" is neither a duration (30m, 2h, 3d) nor a date`);
  return absolute;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

async function main(): Promise<void> {
  // Checked before anything of the app is loaded.
  if (process.env.VERCEL_ENV === "production") throw new Error("Refusing to run on the production deployment (VERCEL_ENV=production).");
  if (process.env.PADDLE_ENV === "production") throw new Error("Refusing to run against live Paddle (PADDLE_ENV=production): this tool is for the sandbox.");

  const after = option("--after");
  if (after && !/^evt_[a-z0-9]{10,40}$/.test(after)) throw new Error("--after expects a Paddle event id (evt_…)");
  const since = parseSince(option("--since") ?? "24h");
  const limit = Number(option("--limit") ?? 500);
  if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit expects a positive number");
  const watching = process.argv.includes("--watch");
  const everySeconds = Math.max(2, Number(option("--watch") ?? 5) || 5);

  const { pullPaddleEvents } = await import("../src/lib/billing/pull-events");
  const { pg } = await import("../src/db");
  const database = new URL(process.env.DATABASE_URL ?? "postgres://unknown/unknown");
  console.log(`Paddle sandbox -> ${database.hostname}${database.pathname}${after ? `, after ${after}` : `, since ${since.toISOString()}`}`);

  try {
    let cursor = after;
    for (;;) {
      const summary = await pullPaddleEvents({
        after: cursor,
        since,
        limit,
        onEvent: (event) => console.log(`${event.occurredAt.padEnd(27)}  ${event.eventType.padEnd(28)}  ${event.eventId}  ${event.outcome}`),
      });
      cursor = summary.lastEventId ?? cursor;
      if (!watching || summary.pulled > 0) {
        console.log(`${summary.pulled} event(s): ${summary.processed} processed, ${summary.duplicates} duplicate, ${summary.ignored} ignored, ${summary.failed} failed`);
      }
      if (summary.failed > 0) process.exitCode = 1;
      if (!watching) break;
      await new Promise((resolve) => setTimeout(resolve, everySeconds * 1000));
    }
  } finally {
    await pg.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(`paddle:pull-events failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
