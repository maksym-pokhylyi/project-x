import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { deliverOutboxEmail } from "@/lib/email/deliver";
import { log } from "@/lib/logger";
import { purgeExpiredRateLimits } from "@/lib/rate-limit";
import { purgeFinishedJobs, type JobPayloads, type JobType } from "./queue";

export type JobContext = { jobId: string; attempt: number };
export type JobHandler<T extends JobType> = (payload: JobPayloads[T], context: JobContext) => Promise<void>;

/**
 * One handler per job type. RULES:
 *  - Idempotent: running twice must be harmless (check state first, or use a provider
 *    idempotency key). Jobs are delivered at least once.
 *  - Throw to retry with backoff; return to mark the job done.
 *  - Keep each run well under the cron route's maxDuration.
 */
export const jobHandlers: { [T in JobType]: JobHandler<T> } = {
  "email.send": async ({ outboxId }) => {
    await deliverOutboxEmail(outboxId);
  },

  "maintenance.cleanup": async () => {
    const rateLimits = await purgeExpiredRateLimits();
    const finishedJobs = await purgeFinishedJobs(14);
    // Unsent bodies of old failed e-mails still contain one-time links: drop them after 7 days.
    const outboxBodies = await db.execute(sql`
      update email_outbox set html = null, text = null
      where created_at < now() - interval '7 days' and (html is not null or text is not null)
      returning 1
    `);
    log.info("maintenance.cleanup done", { rateLimits, finishedJobs, outboxBodies: outboxBodies.length });
  },
};
