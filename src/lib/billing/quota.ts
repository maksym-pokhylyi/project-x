import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { usageCounters } from "@/db/schema";
import { QUOTA_METRICS, type QuotaMetric } from "@/config/plans";
import { getOrgEntitlements } from "./subscription";

export type QuotaResult =
  | { ok: true; metric: QuotaMetric; used: number; limit: number | null; remaining: number | null }
  | { ok: false; reason: "limit_exceeded"; metric: QuotaMetric; used: number; limit: number; remaining: number };

/** Start of the period a metric is counted in (UTC month, or the epoch for lifetime metrics). */
export function quotaPeriodStart(metric: QuotaMetric, now: Date = new Date()): Date {
  if (QUOTA_METRICS[metric].period === "lifetime") return new Date(0);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Atomically consumes `n` units of a metered quota for a workspace.
 *
 *   const result = await consumeQuota(ctx.organization.id, "units", 1);
 *   if (!result.ok) throw new QuotaExceededError(result.metric, result.limit, result.used);
 *
 * Inside one transaction: the plan limit is resolved from the subscription, the counter
 * row for the current period is created if missing, and a single conditional UPDATE
 * (`quantity + n <= limit`) increments it. Postgres row locking makes concurrent calls
 * queue on that row, so the limit can never be exceeded and a rejected call consumes
 * nothing. Call it BEFORE doing the metered work; use `refundQuota` if the work fails.
 *
 * `organizationId` must come from the authenticated session (requireOrg), never from input.
 */
export async function consumeQuota(organizationId: string, metric: QuotaMetric, n = 1, now: Date = new Date()): Promise<QuotaResult> {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError("consumeQuota: n must be a positive integer");
  const periodStart = quotaPeriodStart(metric, now);

  return db.transaction(async (tx) => {
    const entitlements = await getOrgEntitlements(organizationId, tx);
    const limit = entitlements.limits[metric];
    const where = and(
      eq(usageCounters.organizationId, organizationId),
      eq(usageCounters.metric, metric),
      eq(usageCounters.periodStart, periodStart),
    );

    await tx.insert(usageCounters).values({ organizationId, metric, periodStart, quantity: 0 }).onConflictDoNothing();

    const updated = await tx
      .update(usageCounters)
      .set({ quantity: sql`${usageCounters.quantity} + ${n}`, updatedAt: new Date() })
      .where(limit === null ? where : and(where, sql`${usageCounters.quantity} + ${n} <= ${limit}`))
      .returning({ quantity: usageCounters.quantity });

    const row = updated[0];
    if (row) {
      return { ok: true, metric, used: row.quantity, limit, remaining: limit === null ? null : limit - row.quantity } as const;
    }

    // Only reachable when a finite limit blocked the update.
    const [current] = await tx.select({ quantity: usageCounters.quantity }).from(usageCounters).where(where);
    const used = current?.quantity ?? 0;
    const finiteLimit = limit ?? 0;
    return { ok: false, reason: "limit_exceeded", metric, used, limit: finiteLimit, remaining: Math.max(0, finiteLimit - used) } as const;
  });
}

/** Gives back units consumed for work that did not complete. Never drops below zero. */
export async function refundQuota(organizationId: string, metric: QuotaMetric, n = 1, now: Date = new Date()): Promise<void> {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError("refundQuota: n must be a positive integer");
  await db
    .update(usageCounters)
    .set({ quantity: sql`greatest(${usageCounters.quantity} - ${n}, 0)`, updatedAt: new Date() })
    .where(
      and(
        eq(usageCounters.organizationId, organizationId),
        eq(usageCounters.metric, metric),
        eq(usageCounters.periodStart, quotaPeriodStart(metric, now)),
      ),
    );
}

/** Usage of a metric in the current period (0 when nothing was consumed yet). */
export async function getUsage(organizationId: string, metric: QuotaMetric, now: Date = new Date()): Promise<number> {
  const [row] = await db
    .select({ quantity: usageCounters.quantity })
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.organizationId, organizationId),
        eq(usageCounters.metric, metric),
        eq(usageCounters.periodStart, quotaPeriodStart(metric, now)),
      ),
    );
  return row?.quantity ?? 0;
}
