import "server-only";
import { asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { env, features } from "@/env";
import { errorReason } from "@/lib/describe-error";
import { log } from "@/lib/logger";
import { reportError } from "@/lib/report-error";
import { paddleSubscriptionSchema } from "./paddle-events";
import { ingestPaddleEvent } from "./webhooks";

/**
 * Daily reconciliation with Paddle.
 *
 * Webhooks are the normal way subscription state reaches us, but a webhook can be lost for
 * good (Paddle stops retrying after about three days). This job asks the Paddle API for
 * the current state of every subscription we still consider open and applies it through
 * the SAME pipeline as a webhook (stored in `webhook_events`, stale check, audit entry),
 * so a missed cancellation, pause or failed renewal is corrected within a day.
 *
 * It is a no-op without PADDLE_API_KEY (or when billing is switched off for the
 * deployment). The fail-safe in resolveEntitlements() covers access in the meantime.
 */

/** Statuses that can still change on Paddle's side. `canceled` is terminal. */
const OPEN_STATUSES = ["active", "trialing", "past_due", "paused"];
const MAX_PER_RUN = 300;

/** Returns the subscription entity in Paddle's wire format (snake_case), or null when Paddle does not know it. */
export type FetchSubscription = (subscriptionId: string) => Promise<unknown | null>;

export type ReconcileSummary = {
  /** True when the job did nothing because the Paddle API is not configured. */
  skipped: boolean;
  checked: number;
  /** Rows whose state differed from Paddle's and was applied. */
  updated: number;
  unchanged: number;
  /** Subscriptions Paddle no longer knows. */
  missing: number;
  failed: number;
};

function apiBase(): string {
  return env.PADDLE_ENV === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

/** Default fetcher: Paddle REST API, raw wire format (the same shape webhooks carry). */
export const fetchSubscriptionFromPaddle: FetchSubscription = async (subscriptionId) => {
  const response = await fetch(`${apiBase()}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { authorization: `Bearer ${env.PADDLE_API_KEY}`, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Paddle API answered ${response.status} for a subscription lookup`);
  const body = (await response.json()) as { data?: unknown };
  return body.data ?? null;
};

export async function reconcileSubscriptions(options: { fetchSubscription?: FetchSubscription; limit?: number } = {}): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { skipped: false, checked: 0, updated: 0, unchanged: 0, missing: 0, failed: 0 };
  if (!options.fetchSubscription && (!env.PADDLE_API_KEY || !features.paddleApi)) return { ...summary, skipped: true };
  const fetchSubscription = options.fetchSubscription ?? fetchSubscriptionFromPaddle;

  const rows = await db
    .select({
      id: subscriptions.id,
      organizationId: subscriptions.organizationId,
      paddleSubscriptionId: subscriptions.paddleSubscriptionId,
      status: subscriptions.status,
      priceId: subscriptions.priceId,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAt: subscriptions.cancelAt,
    })
    .from(subscriptions)
    .where(sql`${isNotNull(subscriptions.paddleSubscriptionId)} and ${inArray(subscriptions.status, OPEN_STATUSES)}`)
    // Longest-unchecked first, so a large table is covered over consecutive runs.
    .orderBy(sql`${subscriptions.reconciledAt} asc nulls first`, asc(subscriptions.createdAt))
    .limit(Math.min(options.limit ?? MAX_PER_RUN, MAX_PER_RUN));

  for (const row of rows) {
    const subscriptionId = row.paddleSubscriptionId!;
    summary.checked += 1;
    try {
      const remoteRaw = await fetchSubscription(subscriptionId);
      if (remoteRaw === null) {
        summary.missing += 1;
        await reportError(new Error(`Reconciliation: Paddle does not know subscription ${subscriptionId}, which is ${row.status} here`), {
          route: "job:billing.reconcile",
          organizationId: row.organizationId,
        });
        continue;
      }
      const remote = paddleSubscriptionSchema.parse(remoteRaw);
      if (remote.id !== subscriptionId) throw new Error("Paddle returned a different subscription than the one requested");

      const remotePeriodEnd = remote.current_billing_period ? Date.parse(remote.current_billing_period.ends_at) : null;
      const remoteCancelAt = remote.scheduled_change?.action === "cancel" ? Date.parse(remote.scheduled_change.effective_at) : null;
      const same =
        remote.status === row.status &&
        remote.items.some((item) => item.price.id === row.priceId) &&
        remotePeriodEnd === (row.currentPeriodEnd?.getTime() ?? null) &&
        remoteCancelAt === (row.cancelAt?.getTime() ?? null);

      if (!same) {
        // The entity's own `updated_at` orders this snapshot against webhooks we already applied.
        const updatedAt = typeof (remoteRaw as { updated_at?: unknown }).updated_at === "string" ? ((remoteRaw as { updated_at: string }).updated_at) : new Date().toISOString();
        const result = await ingestPaddleEvent({
          event_id: `reconcile_${subscriptionId}_${updatedAt}`,
          event_type: "subscription.updated",
          occurred_at: updatedAt,
          notification_id: null,
          data: remoteRaw as { id: string },
        });
        if (!result.ok) throw new Error(`could not apply the reconciled state: ${result.error}`);
        if (result.outcome === "processed") {
          summary.updated += 1;
          log.warn("billing reconciliation corrected a subscription (a webhook was missed)", {
            organizationId: row.organizationId,
            subscriptionId,
            from: row.status,
            to: remote.status,
          });
        } else {
          summary.unchanged += 1;
        }
      } else {
        summary.unchanged += 1;
      }
      await db.update(subscriptions).set({ reconciledAt: new Date() }).where(eq(subscriptions.id, row.id));
    } catch (error) {
      summary.failed += 1;
      log.warn("billing reconciliation failed for a subscription", { subscriptionId, reason: errorReason(error) });
    }
  }
  // Every lookup failing means the API key or Paddle itself is the problem: make the job retry and show up.
  if (summary.checked > 0 && summary.failed === summary.checked) {
    throw new Error(`Billing reconciliation could not check any of ${summary.checked} subscriptions`);
  }
  return summary;
}
