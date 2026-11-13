import "server-only";
import { runInBackground } from "@/lib/background";
import { errorReason } from "@/lib/describe-error";
import { log } from "@/lib/logger";
import { reportError } from "@/lib/report-error";
import { jobHandlers, type JobHandler } from "./handlers";
import { claimNextJob, markJobFailed, markJobSucceeded, type JobRow, type JobType } from "./queue";

export type WorkerSummary = { claimed: number; succeeded: number; retried: number; failed: number };

/** Runs one claimed job to completion and records the outcome. Never throws. */
export async function executeJob(job: JobRow): Promise<"succeeded" | "pending" | "failed"> {
  const handler = jobHandlers[job.type as JobType] as JobHandler<JobType> | undefined;
  if (!handler) {
    await markJobFailed(job, `No handler registered for job type "${job.type}"`, { retry: false });
    await reportError(new Error(`Unknown job type "${job.type}"`), { route: `job:${job.type}`, extra: { jobId: job.id } });
    return "failed";
  }
  if (job.attempts > job.maxAttempts) {
    // Reclaimed after a stale lock with no attempts left.
    await markJobFailed(job, "Exceeded max attempts (worker died while running)", { retry: false });
    return "failed";
  }
  try {
    await handler(job.payload as never, { jobId: job.id, attempt: job.attempts });
    await markJobSucceeded(job.id);
    return "succeeded";
  } catch (error) {
    // Sanitised: a failed query must not copy its bind parameters into jobs.last_error.
    const message = errorReason(error);
    const status = await markJobFailed(job, message);
    if (status === "failed") {
      await reportError(error, { route: `job:${job.type}`, extra: { jobId: job.id, attempts: job.attempts } });
    } else {
      log.warn("job failed, will retry", { jobId: job.id, type: job.type, attempt: job.attempts, reason: message });
    }
    return status;
  }
}

/**
 * Claims and runs jobs until the queue is empty, `maxJobs` is reached or the time
 * budget is spent. Safe to run concurrently (cron + inline kicks).
 */
export async function runWorker(options: { maxJobs?: number; timeBudgetMs?: number } = {}): Promise<WorkerSummary> {
  const maxJobs = options.maxJobs ?? 25;
  const deadline = Date.now() + (options.timeBudgetMs ?? 45_000);
  const summary: WorkerSummary = { claimed: 0, succeeded: 0, retried: 0, failed: 0 };
  while (summary.claimed < maxJobs && Date.now() < deadline) {
    const job = await claimNextJob();
    if (!job) break;
    summary.claimed += 1;
    const outcome = await executeJob(job);
    if (outcome === "succeeded") summary.succeeded += 1;
    else if (outcome === "pending") summary.retried += 1;
    else summary.failed += 1;
  }
  return summary;
}

/**
 * Runs a few due jobs right after the current response (via waitUntil), so freshly
 * enqueued work usually starts within milliseconds instead of at the next cron tick.
 * The cron route remains the safety net for anything this misses.
 */
export function kickWorker(): void {
  runInBackground("jobs.kick", () => runWorker({ maxJobs: 5, timeBudgetMs: 20_000 }));
}
