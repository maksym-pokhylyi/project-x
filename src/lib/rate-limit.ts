import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
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

/** Best-effort client IP. On Vercel `x-forwarded-for` is set by the platform and cannot be spoofed. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
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
