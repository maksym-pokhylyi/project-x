import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { errorReason } from "@/lib/describe-error";
import { enqueueJob } from "@/lib/jobs/queue";
import { log } from "@/lib/logger";
import { procurementConfig } from "../config";
import { mapRelease, type MappedRelease } from "../domain/map-release";
import { rebuildSupplierProfiles } from "../profiles/build";
import { fetchFtsPage, ftsTimestamp, isSameOrigin, releasePackagesUrl, type FetchFtsPage } from "./fts-client";
import { int, iso, queryRows, str } from "./sql";
import { upsertBatch } from "./upsert";

/**
 * Ingestion from the Find a Tender API.
 *
 * INCREMENTAL (cron, every 10 minutes): reads everything updated since the cursor stored
 * in `ingest_state('fts:incremental')`, page by page, politely paced. A window that does
 * not fit the time budget is resumed by the next run from the saved `links.next`; the
 * cursor only moves once a window has been read to its last page, and every window
 * overlaps the previous one by two minutes — the upsert is idempotent, so reading a
 * release twice costs nothing.
 *
 * BACKFILL (queued jobs): walks backwards one week at a time
 * (job `procurement.backfill`), each job reading a slice of pages and queueing its own
 * continuation, so no single invocation runs long.
 *
 * PACING: one shared slot clock in `ingest_state('fts:pacer')` spaces requests ~10 s apart
 * across every instance and both modes; a 429 pushes the clock forward by Retry-After.
 * SINGLE FLIGHT: a lease column guards each cursor; an overlapping run exits as "skipped".
 */

export type IngestOptions = {
  /** Pages (100 releases each) per run. Default 20. */
  maxPages?: number;
  /** Wall-clock budget for the run. Default 240 s (the cron route allows 300 s). */
  timeBudgetMs?: number;
  now?: Date;
  /** Injected in tests. */
  fetchPage?: FetchFtsPage;
  /** Milliseconds between requests; default from config (10 s). Tests pass 0. */
  requestGapMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

export type IngestSummary = {
  status: "ok" | "partial" | "rate_limited" | "skipped" | "error";
  source: string;
  mode: "incremental" | "backfill";
  pages: number;
  releases: number;
  notices: number;
  awards: number;
  suppliersTouched: number;
  rateLimited: number;
  /** True when the window was read to its last page. */
  windowComplete: boolean;
  windowFrom: string | null;
  windowTo: string | null;
  error: string | null;
  durationMs: number;
};

const OVERLAP_MS = 2 * 60_000;
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60_000;
const LEASE_SECONDS = 6 * 60;
const PACER = "fts:pacer";
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Reserves the next request slot; returns how long to wait for it. */
async function reserveSlot(gapMs: number): Promise<number> {
  if (gapMs <= 0) return 0;
  const gapSeconds = gapMs / 1000;
  await db.execute(sql`insert into ingest_state (source, next_request_at) values (${PACER}, now()) on conflict (source) do nothing`);
  const [row] = await queryRows<{ wait_ms: unknown }>(
    db,
    sql`
      update ingest_state
      set next_request_at = greatest(now(), coalesce(next_request_at, now())) + make_interval(secs => ${gapSeconds}::double precision), updated_at = now()
      where source = ${PACER}
      returning greatest(0, extract(epoch from (next_request_at - make_interval(secs => ${gapSeconds}::double precision) - now())) * 1000) as wait_ms
    `,
  );
  return Math.ceil(Number(row?.wait_ms ?? 0));
}

async function pushBackPacer(seconds: number): Promise<void> {
  await db.execute(sql`
    insert into ingest_state (source, next_request_at) values (${PACER}, now() + make_interval(secs => ${seconds}::int))
    on conflict (source) do update set next_request_at = greatest(coalesce(ingest_state.next_request_at, now()), now() + make_interval(secs => ${seconds}::int)), updated_at = now()
  `);
}

type Lease = { cursor: string | null; nextUrl: string | null; windowTo: string | null };

async function acquireLease(source: string): Promise<Lease | null> {
  await db.execute(sql`insert into ingest_state (source) values (${source}) on conflict (source) do nothing`);
  const [row] = await queryRows<Record<string, unknown>>(
    db,
    sql`
      update ingest_state set locked_until = now() + make_interval(secs => ${LEASE_SECONDS}::int), last_run_at = now(), updated_at = now()
      where source = ${source} and (locked_until is null or locked_until < now())
      returning cursor, next_url, window_to
    `,
  );
  return row ? { cursor: str(row.cursor), nextUrl: str(row.next_url), windowTo: str(row.window_to) } : null;
}

async function saveProgress(source: string, state: { cursor?: string | null; nextUrl: string | null; windowTo: string | null }): Promise<void> {
  await db.execute(sql`
    update ingest_state set
      next_url = ${state.nextUrl}, window_to = ${state.windowTo},
      cursor = ${state.cursor === undefined ? sql`cursor` : sql`${state.cursor}`},
      locked_until = now() + make_interval(secs => ${LEASE_SECONDS}::int), updated_at = now()
    where source = ${source}
  `);
}

async function releaseLease(source: string, summary: IngestSummary): Promise<void> {
  await db.execute(sql`
    update ingest_state set locked_until = null, updated_at = now(),
      last_success_at = ${summary.status === "error" ? sql`last_success_at` : sql`now()`},
      last_error = ${summary.error},
      stats = ${JSON.stringify(summary)}::jsonb
    where source = ${source}
  `);
}

type WindowPlan = { source: string; mode: IngestSummary["mode"]; firstUrl: string; windowFrom: string | null; windowTo: string; resumed: boolean };

/** Reads one window (or the rest of an interrupted one) within the page and time budgets. */
async function readWindow(plan: WindowPlan, options: IngestOptions, started: number): Promise<IngestSummary> {
  const fetchPage = options.fetchPage ?? fetchFtsPage;
  const sleep = options.sleep ?? defaultSleep;
  const gapMs = options.requestGapMs ?? procurementConfig.ftsRequestGapMs;
  const maxPages = options.maxPages ?? 20;
  const deadline = started + (options.timeBudgetMs ?? 240_000);
  const summary: IngestSummary = {
    status: "partial",
    source: plan.source,
    mode: plan.mode,
    pages: 0,
    releases: 0,
    notices: 0,
    awards: 0,
    suppliersTouched: 0,
    rateLimited: 0,
    windowComplete: false,
    windowFrom: plan.windowFrom,
    windowTo: plan.windowTo,
    error: null,
    durationMs: 0,
  };
  const touched = new Set<string>();
  let url: string | null = plan.firstUrl;

  while (url && summary.pages < maxPages) {
    const wait = await reserveSlot(gapMs);
    // Keep headroom for the request itself and the write that follows.
    if (Date.now() + wait + 20_000 > deadline && summary.pages > 0) break;
    if (wait > 0) await sleep(wait);

    const page = await fetchPage(url);
    if (!page.ok) {
      if (page.kind === "rate_limited") {
        summary.rateLimited += 1;
        summary.status = "rate_limited";
        await pushBackPacer(page.retryAfterSeconds);
        log.warn("fts ingest rate limited", { source: plan.source, retryAfterSeconds: page.retryAfterSeconds, pages: summary.pages });
      } else {
        summary.status = "error";
        summary.error = `Find a Tender API: ${page.message}`;
      }
      break;
    }

    const mapped: MappedRelease[] = [];
    for (const release of page.releases) {
      const result = mapRelease(release);
      if (result) mapped.push(result);
    }
    const written = await upsertBatch(db, mapped);
    for (const id of written.touchedSupplierIds) touched.add(id);
    summary.pages += 1;
    summary.releases += page.releases.length;
    summary.notices += written.notices;
    summary.awards += written.awards;

    const next: string | null = page.next && isSameOrigin(page.next, procurementConfig.ftsApiBase) ? page.next : null;
    if (next) {
      // Resumable: the next run (or the next loop turn) continues from here.
      await saveProgress(plan.source, { nextUrl: next, windowTo: plan.windowTo });
      url = next;
    } else {
      summary.windowComplete = true;
      summary.status = "ok";
      await saveProgress(plan.source, { cursor: plan.windowTo, nextUrl: null, windowTo: null });
      url = null;
    }
  }

  if (touched.size > 0) {
    await rebuildSupplierProfiles(db, [...touched], options.now ?? new Date());
    summary.suppliersTouched = touched.size;
  }
  summary.durationMs = Date.now() - started;
  return summary;
}

async function recordRun(summary: IngestSummary): Promise<void> {
  await db.execute(sql`
    insert into ingest_runs (source, mode, status, started_at, finished_at, pages, releases, notices, awards, suppliers_touched, rate_limited, window_from, window_to, error, details)
    values (${summary.source}, ${summary.mode}, ${summary.status}, now() - make_interval(secs => ${summary.durationMs / 1000}::double precision), now(),
            ${summary.pages}, ${summary.releases}, ${summary.notices}, ${summary.awards}, ${summary.suppliersTouched}, ${summary.rateLimited},
            ${summary.windowFrom}, ${summary.windowTo}, ${summary.error}, ${JSON.stringify({ windowComplete: summary.windowComplete })}::jsonb)
  `);
}

function skipped(source: string, mode: IngestSummary["mode"]): IngestSummary {
  return { status: "skipped", source, mode, pages: 0, releases: 0, notices: 0, awards: 0, suppliersTouched: 0, rateLimited: 0, windowComplete: false, windowFrom: null, windowTo: null, error: null, durationMs: 0 };
}

async function runWithLease(source: string, mode: IngestSummary["mode"], plan: (lease: Lease) => WindowPlan, options: IngestOptions): Promise<IngestSummary> {
  const started = Date.now();
  const lease = await acquireLease(source);
  if (!lease) return skipped(source, mode);
  let summary: IngestSummary;
  try {
    summary = await readWindow(plan(lease), options, started);
  } catch (error) {
    summary = { ...skipped(source, mode), status: "error", error: errorReason(error).slice(0, 500), durationMs: Date.now() - started };
  }
  await releaseLease(source, summary);
  // Quiet ticks (nothing new) are not worth a row each; everything else is.
  if (summary.releases > 0 || summary.status !== "ok") await recordRun(summary);
  log.info("fts ingest run", summary);
  return summary;
}

/** Incremental run: everything updated since the stored cursor. Safe to call concurrently and to interrupt. */
export async function runIngestion(options: IngestOptions = {}): Promise<IngestSummary> {
  const source = "fts:incremental";
  const now = options.now ?? new Date();
  return runWithLease(
    source,
    "incremental",
    (lease) => {
      if (lease.nextUrl && lease.windowTo && isSameOrigin(lease.nextUrl, procurementConfig.ftsApiBase)) {
        return { source, mode: "incremental", firstUrl: lease.nextUrl, windowFrom: lease.cursor, windowTo: lease.windowTo, resumed: true };
      }
      const cursorTime = lease.cursor ? Date.parse(`${lease.cursor}Z`) : Number.NaN;
      const from = new Date(Number.isNaN(cursorTime) ? now.getTime() - FIRST_RUN_LOOKBACK_MS : cursorTime - OVERLAP_MS);
      return { source, mode: "incremental", firstUrl: releasePackagesUrl(procurementConfig.ftsApiBase, from, now), windowFrom: ftsTimestamp(from), windowTo: ftsTimestamp(now), resumed: false };
    },
    options,
  );
}

// ---------------------------------------------------------------------------
// Backfill
// ---------------------------------------------------------------------------

const WEEK_MS = 7 * 24 * 60 * 60_000;
const day = (date: Date) => date.toISOString().slice(0, 10);

export type BackfillPayload = {
  /** First day (UTC) of the week to load, "YYYY-MM-DD". */
  weekStart: string;
  /** Stop once a week starting before this day has been loaded, "YYYY-MM-DD". */
  until: string;
  /** Continuation counter, part of the job's idempotency key. */
  part?: number;
};

/**
 * One slice of one backfill week. Reads up to `maxPages` pages, then queues what comes
 * next: its own continuation if the week is unfinished (or the API asked us to back off),
 * otherwise the previous week — until `until` is reached.
 */
export async function runBackfillSlice(payload: BackfillPayload, options: IngestOptions = {}): Promise<IngestSummary> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.weekStart) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.until)) throw new Error("procurement.backfill: bad payload");
  const from = new Date(`${payload.weekStart}T00:00:00Z`);
  const to = new Date(from.getTime() + WEEK_MS);
  const source = `fts:backfill:${payload.weekStart}`;
  const summary = await runWithLease(
    source,
    "backfill",
    (lease) => {
      if (lease.nextUrl && isSameOrigin(lease.nextUrl, procurementConfig.ftsApiBase)) {
        return { source, mode: "backfill", firstUrl: lease.nextUrl, windowFrom: ftsTimestamp(from), windowTo: ftsTimestamp(to), resumed: true };
      }
      return { source, mode: "backfill", firstUrl: releasePackagesUrl(procurementConfig.ftsApiBase, from, to), windowFrom: ftsTimestamp(from), windowTo: ftsTimestamp(to), resumed: false };
    },
    { maxPages: 12, timeBudgetMs: 150_000, ...options },
  );

  const part = (payload.part ?? 0) + 1;
  if (summary.windowComplete) {
    await db.execute(sql`
      insert into ingest_state (source, cursor) values ('fts:backfill', ${payload.weekStart})
      on conflict (source) do update set cursor = least(coalesce(ingest_state.cursor, excluded.cursor), excluded.cursor), last_success_at = now(), updated_at = now()
    `);
    const previous = day(new Date(from.getTime() - WEEK_MS));
    if (previous >= payload.until) await enqueueJob("procurement.backfill", { weekStart: previous, until: payload.until, part: 0 }, { dedupeKey: `procurement.backfill:${previous}:0` });
  } else if (summary.status !== "error") {
    // Unfinished (budget, lease held elsewhere or rate limit): continue shortly.
    const delaySeconds = summary.status === "rate_limited" ? 180 : summary.status === "skipped" ? 120 : 15;
    await enqueueJob(
      "procurement.backfill",
      { ...payload, part },
      { dedupeKey: `procurement.backfill:${payload.weekStart}:${part}`, runAfter: new Date(Date.now() + delaySeconds * 1000) },
    );
  } else {
    // Let the job queue retry with its own backoff.
    throw new Error(summary.error ?? "backfill slice failed");
  }
  return summary;
}

/**
 * Starts (or extends) the backfill: queues the week before the oldest data we hold and
 * walks back to `until` ("YYYY-MM-DD"). Returns the first week queued, or null when
 * there is nothing older to fetch.
 */
export async function startBackfill(until: string, now: Date = new Date()): Promise<string | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error("startBackfill: until must be YYYY-MM-DD");
  const [row] = await queryRows<Record<string, unknown>>(
    db,
    sql`select (select min(published_at) from notices) as oldest, (select cursor from ingest_state where source = 'fts:backfill') as cursor`,
  );
  const oldest = iso(row?.oldest) ?? now.toISOString();
  const anchor = str(row?.cursor) ?? day(new Date(oldest));
  const weekStart = day(new Date(Date.parse(`${anchor}T00:00:00Z`) - WEEK_MS));
  if (weekStart < until) return null;
  await enqueueJob("procurement.backfill", { weekStart, until, part: 0 }, { dedupeKey: `procurement.backfill:${weekStart}:0` });
  return weekStart;
}

// ---------------------------------------------------------------------------
// Admin overview
// ---------------------------------------------------------------------------

export type IngestionOverview = {
  states: Array<{ source: string; cursor: string | null; resuming: boolean; lastRunAt: string | null; lastSuccessAt: string | null; lastError: string | null; locked: boolean }>;
  runs: Array<{ id: string; source: string; mode: string; status: string; startedAt: string | null; finishedAt: string | null; pages: number; releases: number; notices: number; awards: number; suppliersTouched: number; rateLimited: number; error: string | null }>;
  counts: { notices: number; liveTenders: number; awards: number; suppliers: number; buyers: number; newestNoticeAt: string | null };
};

/** Ingestion health for the founder's admin page: cursors, recent runs, table sizes. */
export async function getIngestionOverview(): Promise<IngestionOverview> {
  const [states, runs, [counts]] = await Promise.all([
    queryRows<Record<string, unknown>>(db, sql`select source, cursor, next_url, last_run_at, last_success_at, last_error, locked_until > now() as locked from ingest_state where source <> ${PACER} order by source`),
    queryRows<Record<string, unknown>>(db, sql`select * from ingest_runs order by started_at desc limit 25`),
    queryRows<Record<string, unknown>>(
      db,
      sql`
        select (select count(*) from notices) as notices,
               (select count(*) from notices where is_latest and stage = 'tender' and notice_type is distinct from 'UK12' and coalesce(status, 'active') = 'active' and deadline_at > now()) as live_tenders,
               (select count(*) from awards where is_current) as awards,
               (select count(*) from suppliers where merged_into is null) as suppliers,
               (select count(*) from buyers where merged_into is null) as buyers,
               (select max(published_at) from notices) as newest
      `,
    ),
  ]);
  return {
    states: states.map((row) => ({
      source: String(row.source),
      cursor: str(row.cursor),
      resuming: Boolean(row.next_url),
      lastRunAt: iso(row.last_run_at),
      lastSuccessAt: iso(row.last_success_at),
      lastError: str(row.last_error),
      locked: row.locked === true,
    })),
    runs: runs.map((row) => ({
      id: String(row.id),
      source: String(row.source),
      mode: String(row.mode),
      status: String(row.status),
      startedAt: iso(row.started_at),
      finishedAt: iso(row.finished_at),
      pages: int(row.pages),
      releases: int(row.releases),
      notices: int(row.notices),
      awards: int(row.awards),
      suppliersTouched: int(row.suppliers_touched),
      rateLimited: int(row.rate_limited),
      error: str(row.error),
    })),
    counts: {
      notices: int(counts?.notices),
      liveTenders: int(counts?.live_tenders),
      awards: int(counts?.awards),
      suppliers: int(counts?.suppliers),
      buyers: int(counts?.buyers),
      newestNoticeAt: iso(counts?.newest),
    },
  };
}
