import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { env, features } from "@/env";
import { RateLimitError } from "./errors";

export type RateLimitRule = {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** When the current window ends and the counter resets. */
  resetAt: Date;
  retryAfterSeconds: number;
};

/**
 * Postgres-backed fixed-window rate limiter (no extra service).
 *
 * One atomic upsert per call: the row for (key, window) is created or incremented and the
 * new count is returned, so concurrent requests can never both slip under the limit.
 * Windows are aligned to the epoch (e.g. every full minute), which allows a burst of up
 * to 2x `limit` across a window boundary — acceptable for abuse protection; not a billing
 * meter. Expired rows are removed by the `maintenance.cleanup` job.
 *
 *   const result = await rateLimit(`export:${orgId}`, { limit: 10, windowSeconds: 60 });
 *   if (!result.ok) ...
 */
export async function rateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const window = Math.max(1, Math.floor(rule.windowSeconds));
  const rows = await db.execute<{ count: number; window_start: string }>(sql`
    insert into rate_limits (key, window_start, count, expires_at)
    values (
      ${key},
      to_timestamp(floor(extract(epoch from now()) / ${window}::int) * ${window}::int),
      1,
      to_timestamp((floor(extract(epoch from now()) / ${window}::int) + 2) * ${window}::int)
    )
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count, window_start
  `);
  const row = rows[0];
  if (!row) throw new Error("rate limiter returned no row");
  const count = Number(row.count);
  const resetAt = new Date(new Date(row.window_start).getTime() + window * 1000);
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  return {
    ok: count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - count),
    resetAt,
    retryAfterSeconds,
  };
}

/** Throws a typed 429 error when the limit is exceeded. For expensive routes and actions. */
export async function enforceRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const result = await rateLimit(key, rule);
  if (!result.ok) throw new RateLimitError(result.retryAfterSeconds);
  return result;
}

/**
 * Reads the current count of a window WITHOUT consuming it. `ok` is false once `limit`
 * has been reached. For limits that are counted after the fact (e.g. failed sign-ins).
 */
export async function peekRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const window = Math.max(1, Math.floor(rule.windowSeconds));
  const rows = await db.execute<{ count: number | null; window_start: string }>(sql`
    select
      (select count from rate_limits where key = ${key}
         and window_start = to_timestamp(floor(extract(epoch from now()) / ${window}::int) * ${window}::int)) as count,
      to_timestamp(floor(extract(epoch from now()) / ${window}::int) * ${window}::int) as window_start
  `);
  const count = Number(rows[0]?.count ?? 0);
  const resetAt = new Date(new Date(rows[0]!.window_start).getTime() + window * 1000);
  return {
    ok: count < rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
  };
}

/**
 * Request headers that carry the client's IP address AND cannot be set by the client.
 *
 *  - On Vercel the platform sets (and overwrites) these headers.
 *  - Anywhere else nothing is trusted by default: a client could send any
 *    `X-Forwarded-For` and get a fresh rate-limit bucket per request. Set
 *    TRUST_PROXY_HEADERS=1 only behind a reverse proxy that overwrites them.
 */
export const trustedIpHeaders: readonly string[] = features.onVercel
  ? ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]
  : env.TRUST_PROXY_HEADERS === "1"
    ? ["x-forwarded-for", "x-real-ip"]
    : [];

/**
 * The client IP from a trusted header (see `trustedIpHeaders`), or "unknown". With no
 * trusted source every client shares the "unknown" bucket: the per-IP limits then act as
 * global limits instead of being bypassable.
 */
export function clientIp(headers: Headers): string {
  for (const name of trustedIpHeaders) {
    const first = headers.get(name)?.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return "unknown";
}

/** Standard headers describing the limit, for 429 responses. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "retry-after": String(result.retryAfterSeconds),
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "x-ratelimit-reset": String(Math.ceil(result.resetAt.getTime() / 1000)),
  };
}

/** Deletes expired windows. Called by the maintenance job. Returns rows removed. */
export async function purgeExpiredRateLimits(): Promise<number> {
  const rows = await db.execute(sql`delete from rate_limits where expires_at < now() returning 1`);
  return rows.length;
}
