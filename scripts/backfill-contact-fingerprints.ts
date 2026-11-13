/**
 * One-off: fills `supplier_contacts.email_fingerprint` on the rows stored before that column
 * existed (migration 0007 adds it empty). Retention and ingestion fill it only on the rows
 * they touch; this does the rest, so that every row can be recognised by its fingerprint.
 *
 *   pnpm contacts:backfill                                      # local Postgres (DATABASE_URL)
 *   NODE_USE_ENV_PROXY=1 pnpm contacts:backfill --driver neon-http   # remote Neon over HTTPS
 *
 * Options
 *   --driver postgres|neon-http   default postgres (as in scripts/seed-fts.ts)
 *   --batch <n>                   rows per statement (default 5000)
 *
 * Batched, idempotent and safe to interrupt: a row that has a fingerprint, or whose address
 * was erased, is never written, so a second run changes nothing. Prints COUNTS ONLY — never
 * an address.
 */
import { sql } from "drizzle-orm";
import { backfillContactFingerprints } from "../src/features/procurement/ingest/contact-erasure";
import { queryRows, type SqlExecutor } from "../src/features/procurement/ingest/sql";
import { describeError, summarizeError } from "../src/lib/describe-error";
import { loadEnv } from "./load-env.mjs";

loadEnv();

type Args = { driver: "postgres" | "neon-http"; batch: number };

function parseArgs(argv: string[]): Args {
  const args: Args = { driver: "postgres", batch: 5000 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]!;
    if (value === "--driver") args.driver = argv[++index] === "neon-http" ? "neon-http" : "postgres";
    else if (value === "--batch") args.batch = Math.max(1, Math.trunc(Number(argv[++index])) || 5000);
    else throw new Error("Usage: backfill-contact-fingerprints [--driver postgres|neon-http] [--batch n]");
  }
  return args;
}

async function connect(driver: Args["driver"]): Promise<{ db: SqlExecutor; close: () => Promise<void>; target: string }> {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const parsed = new URL(url);
  const target = `${parsed.hostname}${parsed.pathname}`; // never log credentials
  if (driver === "neon-http") {
    const { neon, neonConfig } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    // Optional: a local Neon HTTP proxy (development and tests). Not needed for Neon itself.
    const endpoint = process.env.NEON_HTTP_ENDPOINT?.trim();
    if (endpoint) neonConfig.fetchEndpoint = () => endpoint;
    return { db: drizzle(neon(url)), close: async () => undefined, target: endpoint ? `${target} via ${new URL(endpoint).host}` : target };
  }
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  return { db: drizzle(client), close: () => client.end({ timeout: 5 }), target };
}

const counts = async (db: SqlExecutor) => {
  const [row] = await queryRows<Record<string, unknown>>(
    db,
    sql`
      select count(*)::int as rows,
             count(*) filter (where email_fingerprint is null and erased_at is null)::int as without_fingerprint,
             count(*) filter (where erased_at is not null)::int as erased
      from supplier_contacts
    `,
  );
  return { rows: Number(row?.rows ?? 0), withoutFingerprint: Number(row?.without_fingerprint ?? 0), erased: Number(row?.erased ?? 0) };
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { db, close, target } = await connect(args.driver);
  try {
    const before = await counts(db);
    console.log(`[contacts:backfill] ${target} via ${args.driver}: ${before.rows} contact rows, ${before.withoutFingerprint} without a fingerprint, ${before.erased} erased`);
    const started = Date.now();
    const result = await backfillContactFingerprints(db, {
      batchSize: args.batch,
      onBatch: (progress) => console.log(`[contacts:backfill] batch ${progress.batches}: ${progress.filled} filled so far`),
    });
    const after = await counts(db);
    console.log(`[contacts:backfill] done in ${((Date.now() - started) / 1000).toFixed(1)}s: ${result.filled} filled in ${result.batches} batch(es), ${after.withoutFingerprint} left without a fingerprint`);
    if (after.withoutFingerprint > 0) {
      // Only possible if rows were stored while this ran by code older than the column.
      console.log("[contacts:backfill] rows were added meanwhile without a fingerprint: run it again");
      process.exitCode = 1;
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  // Never the raw message: a driver error quotes the statement's values.
  const described = describeError(error);
  console.error("[contacts:backfill] failed:", summarizeError(described));
  if (described.code === "42703" || described.code === "42P01") console.error("[contacts:backfill] the column is not there yet: run `pnpm db:migrate` first");
  process.exit(1);
});
