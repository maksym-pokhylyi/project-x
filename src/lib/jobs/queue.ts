import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { jobs } from "@/db/schema";
import { scrubText } from "@/lib/describe-error";

/**
 * Durable background jobs on Postgres.
 *
 * Lifecycle: pending -> running -> succeeded | (pending again with backoff) | failed.
 * Delivery is AT-LEAST-ONCE: a handler may run again after a crash or timeout, so every
 * handler must be idempotent (see src/lib/jobs/handlers.ts).
 *
 * To add a job type: add its payload to JobPayloads, then a handler in handlers.ts.
 */
export type JobPayloads = {
  /** Deliver one e-mail from email_outbox through the provider. */
  "email.send": { outboxId: string };
  /** Housekeeping: expired rate-limit windows, old finished jobs, old outbox bodies. */
  "maintenance.cleanup": Record<string, never>;
};

export type JobType = keyof JobPayloads;
export type JobRow = typeof jobs.$inferSelect;

export const DEFAULT_MAX_ATTEMPTS = 5;
/** A job "running" for longer than this is assumed dead and becomes claimable again. */
export const STALE_LOCK_SECONDS = 15 * 60;

const BASE_BACKOFF_SECONDS = 30;
const MAX_BACKOFF_SECONDS = 6 * 60 * 60;

/**
 * Exponential backoff: 30s, 1m, 2m, 4m, 8m, ... capped at 6h.
 * `attempt` is the number of attempts made so far (1 after the first failure).
 */
export function backoffSeconds(attempt: number): number {
  const exponent = Math.max(0, Math.min(attempt - 1, 20));
  return Math.min(BASE_BACKOFF_SECONDS * 2 ** exponent, MAX_BACKOFF_SECONDS);
}

export type EnqueueOptions = {
  /** Earliest time the job may run. Default: now. */
  runAfter?: Date;
  /** Idempotency key: enqueueing the same key again is a no-op. */
  dedupeKey?: string;
  maxAttempts?: number;
};

/**
 * Inserts a job. Pass a transaction as `executor` to enqueue atomically with other writes.
 * Returns the job id, or null when `dedupeKey` already exists.
 */
export async function enqueueJob<T extends JobType>(
  type: T,
  payload: JobPayloads[T],
  options: EnqueueOptions = {},
  executor: DbOrTx = db,
): Promise<string | null> {
  const rows = await executor
    .insert(jobs)
    .values({
      type,
      payload,
      runAfter: options.runAfter ?? new Date(),
      dedupeKey: options.dedupeKey ?? null,
      maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    })
    .onConflictDoNothing({ target: jobs.dedupeKey })
    .returning({ id: jobs.id });
  return rows[0]?.id ?? null;
}

/**
 * Atomically claims the next runnable job (or a job whose worker died), marking it
 * running and incrementing `attempts`. `FOR UPDATE SKIP LOCKED` lets several workers
 * run concurrently without ever claiming the same job.
 */
export async function claimNextJob(): Promise<JobRow | null> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    update jobs
    set status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
    where id = (
      select id from jobs
      where (status = 'pending' and run_after <= now())
         or (status = 'running' and locked_at < now() - make_interval(secs => ${STALE_LOCK_SECONDS}::int))
      order by run_after asc
      limit 1
      for update skip locked
    )
    returning id
  `);
  const claimedId = rows[0]?.id;
  if (typeof claimedId !== "string") return null;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, claimedId));
  return job ?? null;
}

export async function markJobSucceeded(jobId: string): Promise<void> {
  await db.execute(sql`
    update jobs
    set status = 'succeeded', locked_at = null, last_error = null, completed_at = now(), updated_at = now()
    where id = ${jobId}
  `);
}

/**
 * Records a failed attempt. Re-queues with exponential backoff, or marks the job
 * `failed` for good when attempts are exhausted (or `retry` is false).
 * Returns the resulting status.
 */
export async function markJobFailed(
  job: Pick<JobRow, "id" | "attempts" | "maxAttempts">,
  errorMessage: string,
  options: { retry?: boolean } = {},
): Promise<"pending" | "failed"> {
  const exhausted = options.retry === false || job.attempts >= job.maxAttempts;
  const message = scrubText(errorMessage, 2000);
  if (exhausted) {
    await db.execute(sql`
      update jobs
      set status = 'failed', locked_at = null, last_error = ${message}, completed_at = now(), updated_at = now()
      where id = ${job.id}
    `);
    return "failed";
  }
  await db.execute(sql`
    update jobs
    set status = 'pending', locked_at = null, last_error = ${message},
        run_after = now() + make_interval(secs => ${backoffSeconds(job.attempts)}::int), updated_at = now()
    where id = ${job.id}
  `);
  return "pending";
}

/** Deletes succeeded jobs older than `days`. Failed jobs are kept for inspection. */
export async function purgeFinishedJobs(days = 14): Promise<number> {
  const rows = await db.execute(sql`
    delete from jobs
    where status = 'succeeded' and completed_at < now() - make_interval(days => ${days}::int)
    returning 1
  `);
  return rows.length;
}
