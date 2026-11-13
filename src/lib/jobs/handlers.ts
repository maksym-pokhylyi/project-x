import "server-only";
import { reconcileSubscriptions } from "@/lib/billing/reconcile";
import { deliverOutboxEmail } from "@/lib/email/deliver";
import { log } from "@/lib/logger";
import { runMaintenance } from "@/lib/maintenance";
import type { JobPayloads, JobType } from "./queue";

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

  "billing.reconcile": async () => {
    const summary = await reconcileSubscriptions();
    if (summary.skipped) return; // no PADDLE_API_KEY: nothing to compare against
    log.info("billing.reconcile done", summary);
  },

  "maintenance.cleanup": async () => {
    // Retention for every operational table: see src/config/retention.ts.
    const summary = await runMaintenance();
    log.info("maintenance.cleanup done", summary);
  },

  "procurement.backfill": async (payload) => {
    // Imported lazily so the job registry does not pull the ingestion module into every bundle.
    const { runBackfillSlice } = await import("@/features/procurement/ingest/run");
    await runBackfillSlice(payload);
  },
};
