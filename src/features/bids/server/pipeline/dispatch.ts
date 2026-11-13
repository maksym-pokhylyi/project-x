import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { DbOrTx } from "@/db";
import { appUrl, env } from "@/env";
import { enqueueJob } from "@/lib/jobs/queue";
import { log } from "@/lib/logger";

/**
 * How pipeline jobs get started promptly on serverless.
 *
 * Jobs live in the durable `jobs` table (the cron route is the safety net), but cron only
 * ticks every few minutes. So every time a bid job is enqueued we also "nudge": a short
 * authenticated request to /api/bids/worker, which starts a worker in ITS OWN function
 * invocation (own maxDuration) and returns at once. Each pipeline step therefore runs in a
 * fresh invocation instead of one long-lived request.
 */
export const BID_JOB_MAX_ATTEMPTS = 3;

export async function enqueueBidJob(bidId: string, runId: string, key: string, executor?: DbOrTx): Promise<void> {
  await enqueueJob("bids.process", { bidId, runId }, { dedupeKey: `bids.process:${bidId}:${runId}:${key}`, maxAttempts: BID_JOB_MAX_ATTEMPTS }, executor);
}

function sign(timestamp: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(`bids-worker:v1:${timestamp}`).digest("hex");
}

export function workerAuthHeader(now: number = Date.now()): string {
  const timestamp = String(Math.floor(now / 1000));
  return `BidsWorker ${timestamp}.${sign(timestamp)}`;
}

export function verifyWorkerAuth(header: string | null, now: number = Date.now()): boolean {
  const match = /^BidsWorker (\d{1,12})\.([0-9a-f]{64})$/.exec(header ?? "");
  if (!match) return false;
  const age = Math.abs(Math.floor(now / 1000) - Number(match[1]));
  if (age > 300) return false;
  const expected = Buffer.from(sign(match[1]!), "hex");
  const given = Buffer.from(match[2]!, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Asks the app to run pending jobs now, in a new invocation. Never throws; when it cannot
 * reach the app the cron worker and the status watchdog pick the job up instead.
 */
export async function nudgeWorker(): Promise<void> {
  if (env.NODE_ENV === "test") return;
  try {
    await fetch(`${appUrl}/api/bids/worker`, {
      method: "POST",
      headers: { authorization: workerAuthHeader() },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
  } catch (error) {
    log.warn("bids: could not nudge the worker (cron will pick the job up)", { reason: error instanceof Error ? error.message : "unknown" });
  }
}
