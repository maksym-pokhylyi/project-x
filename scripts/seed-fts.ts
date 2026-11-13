/**
 * Loads a local Find a Tender harvest (gzip JSONL, one OCDS release per line) through the
 * SAME mapper and upsert as live ingestion.
 *
 *   pnpm seed:fts /home/user/data/fts/raw                       # local Postgres (DATABASE_URL)
 *   NODE_USE_ENV_PROXY=1 pnpm seed:fts <dir> --driver neon-http # remote Neon over HTTPS
 *
 * Options
 *   --driver postgres|neon-http   default postgres. neon-http uses @neondatabase/serverless
 *                                 (HTTPS only), for machines without raw TCP access. About
 *                                 25 HTTP requests per batch of 500 releases.
 *   --batch <n>                   releases per upsert batch (default 500)
 *   --limit <n>                   stop after n releases (smoke tests)
 *   --no-profiles                 skip rebuilding supplier profiles at the end
 *
 * Safe to re-run and to interrupt: every write is an idempotent upsert. Files ending in
 * ".tmp" (harvest still in progress) are ignored.
 */
import { createReadStream, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createGunzip } from "node:zlib";
import { sql } from "drizzle-orm";
import { mapRelease, type MappedRelease } from "../src/features/procurement/domain/map-release";
import type { OcdsRelease } from "../src/features/procurement/domain/ocds";
import { rebuildSupplierProfiles } from "../src/features/procurement/profiles/build";
import { queryRows, type SqlExecutor } from "../src/features/procurement/ingest/sql";
import { upsertBatch } from "../src/features/procurement/ingest/upsert";
import { loadEnv } from "./load-env.mjs";

loadEnv();

type Args = { dir: string; driver: "postgres" | "neon-http"; batch: number; limit: number | null; profiles: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { dir: "", driver: "postgres", batch: 500, limit: null, profiles: true };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]!;
    if (value === "--driver") args.driver = argv[++index] === "neon-http" ? "neon-http" : "postgres";
    else if (value === "--batch") args.batch = Math.max(1, Number(argv[++index]) || 500);
    else if (value === "--limit") args.limit = Number(argv[++index]) || null;
    else if (value === "--no-profiles") args.profiles = false;
    else if (!value.startsWith("--") && !args.dir) args.dir = value;
  }
  if (!args.dir) throw new Error("Usage: seed-fts <dir> [--driver postgres|neon-http] [--batch n] [--limit n] [--no-profiles]");
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
  const client = postgres(url, { prepare: false, max: 4, onnotice: () => {} });
  return { db: drizzle(client), close: () => client.end({ timeout: 5 }), target };
}

/**
 * Yields one release per "\n"-terminated line. Not node:readline: it also splits on
 * U+2028 / U+2029, which occur inside notice descriptions and would cut records in half.
 */
async function* readReleases(file: string): AsyncGenerator<OcdsRelease> {
  const stream = createReadStream(file).pipe(createGunzip());
  stream.setEncoding("utf8");
  let pending = "";
  const parse = (line: string): OcdsRelease | null => {
    if (!line.trim()) return null;
    try {
      return JSON.parse(line) as OcdsRelease;
    } catch {
      // Harvests written by Python contain bare Infinity/NaN (e.g. "maximumLotsBidPerSupplier": Infinity).
      try {
        return JSON.parse(line.replace(/:\s*(-?Infinity|NaN)(?=\s*[,}\]])/g, ": null")) as OcdsRelease;
      } catch {
        console.warn(`[seed-fts] skipped an unparseable line in ${file}`);
        return null;
      }
    }
  };
  for await (const chunk of stream as AsyncIterable<string>) {
    pending += chunk;
    let newline = pending.indexOf("\n");
    while (newline !== -1) {
      const release = parse(pending.slice(0, newline));
      pending = pending.slice(newline + 1);
      if (release) yield release;
      newline = pending.indexOf("\n");
    }
  }
  const last = parse(pending);
  if (last) yield last;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = resolve(args.dir);
  const files = statSync(dir).isDirectory()
    ? readdirSync(dir)
        .filter((name) => name.endsWith(".jsonl.gz"))
        .sort()
        .map((name) => join(dir, name))
    : [dir];
  if (files.length === 0) throw new Error(`No *.jsonl.gz files in ${dir}`);

  const { db, close, target } = await connect(args.driver);
  console.log(`[seed-fts] ${files.length} file(s) -> ${target} via ${args.driver}`);
  const started = Date.now();
  const totals = { releases: 0, unmapped: 0, notices: 0, awards: 0, suppliersCreated: 0, buyersCreated: 0, merges: 0 };
  const touched = new Set<string>();
  const [run] = await queryRows<{ id: string }>(db, sql`insert into ingest_runs (source, mode, status) values ('fts:seed', 'seed', 'running') returning id`);

  try {
    let batch: MappedRelease[] = [];
    const flush = async () => {
      if (batch.length === 0) return;
      const summary = await upsertBatch(db, batch);
      totals.notices += summary.notices;
      totals.awards += summary.awards;
      totals.suppliersCreated += summary.suppliersCreated;
      totals.buyersCreated += summary.buyersCreated;
      totals.merges += summary.merges;
      for (const id of summary.touchedSupplierIds) touched.add(id);
      batch = [];
    };

    outer: for (const file of files) {
      const fileStarted = Date.now();
      let inFile = 0;
      for await (const release of readReleases(file)) {
        const mapped = mapRelease(release);
        if (!mapped) {
          totals.unmapped += 1;
          continue;
        }
        batch.push(mapped);
        totals.releases += 1;
        inFile += 1;
        if (batch.length >= args.batch) await flush();
        if (args.limit && totals.releases >= args.limit) break outer;
      }
      await flush();
      console.log(`[seed-fts] ${file.split("/").pop()}: ${inFile} releases in ${((Date.now() - fileStarted) / 1000).toFixed(1)}s`);
    }
    await flush();

    let profiles = 0;
    if (args.profiles) {
      const profileStarted = Date.now();
      profiles = await rebuildSupplierProfiles(db, [...touched]);
      console.log(`[seed-fts] rebuilt ${profiles} supplier profiles in ${((Date.now() - profileStarted) / 1000).toFixed(1)}s`);
    }

    await db.execute(sql`
      update ingest_runs set status = 'ok', finished_at = now(), releases = ${totals.releases}, notices = ${totals.notices}, awards = ${totals.awards},
        suppliers_touched = ${touched.size}, details = ${JSON.stringify({ ...totals, profiles, files: files.length, driver: args.driver })}::jsonb
      where id = ${run!.id}
    `);

    const counts = await queryRows<Record<string, unknown>>(
      db,
      sql`
        select
          (select count(*) from notices) as notices,
          (select count(*) from notices where is_latest) as latest_notices,
          (select count(*) from notices where is_latest and stage = 'tender' and notice_type is distinct from 'UK12' and status = 'active' and deadline_at > now()) as live_tenders,
          (select count(*) from awards) as award_rows,
          (select count(*) from awards where is_current) as current_awards,
          (select count(*) from suppliers where merged_into is null) as suppliers,
          (select count(*) from suppliers where merged_into is not null) as merged_suppliers,
          (select count(*) from buyers where merged_into is null) as buyers,
          (select count(*) from supplier_contacts) as supplier_contacts,
          (select count(*) from supplier_profiles) as supplier_profiles,
          (select count(*) from cpv_codes) as cpv_codes,
          (select count(*) from procurement_aliases) as aliases
      `,
    );
    console.log(`[seed-fts] done in ${((Date.now() - started) / 1000).toFixed(1)}s`, { ...totals, touchedSuppliers: touched.size });
    console.log("[seed-fts] row counts", counts[0]);
  } catch (error) {
    await db
      .execute(sql`update ingest_runs set status = 'error', finished_at = now(), error = ${error instanceof Error ? error.message.slice(0, 2000) : "unknown"} where id = ${run!.id}`)
      .catch(() => undefined);
    throw error;
  } finally {
    await close();
  }
}

main().catch((error) => {
  // Driver errors embed the full parameter list: print the head and the underlying cause only.
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : null;
  console.error("[seed-fts] failed:", message.slice(0, 600), cause ? `\ncause: ${cause}` : "");
  process.exit(1);
});
