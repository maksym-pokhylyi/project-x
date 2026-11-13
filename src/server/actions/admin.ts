"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { processStoredEvent } from "@/lib/billing/webhooks";
import { AppError, NotFoundError } from "@/lib/errors";
import { runWorker } from "@/lib/jobs/worker";
import { parseInput } from "@/lib/validation";
import { runAction, type ActionResult } from "../http";
import { requireAdmin } from "../session";

/**
 * Re-runs the handler for a stored Paddle event (founder only). Safe by construction:
 * handlers are idempotent, events older than the subscription's last applied event are
 * ignored, and the audit entry and analytics of an event are written only once however
 * often it is replayed. Use it for events that failed or were ignored after fixing data.
 */
export async function replayWebhookAction(input: unknown): Promise<ActionResult<{ outcome: string | null }>> {
  return runAction("admin.replay_webhook", async () => {
    await requireAdmin();
    const eventId = parseInput(z.string().min(1).max(128), input);
    const result = await processStoredEvent(eventId, { force: true });
    if (!result.ok) throw new AppError("CONFLICT", `Replay failed: ${result.error}`, 409);
    return { outcome: result.outcome };
  });
}

/** Puts a failed job back in the queue and runs the worker once (founder only). */
export async function retryJobAction(input: unknown): Promise<ActionResult> {
  return runAction("admin.retry_job", async () => {
    await requireAdmin();
    const jobId = parseInput(z.uuid(), input);
    const updated = await db
      .update(jobs)
      .set({ status: "pending", attempts: 0, runAfter: new Date(), lockedAt: null, completedAt: null, updatedAt: new Date() })
      // Never reset a job a worker is executing right now: it would run twice in parallel.
      .where(and(eq(jobs.id, jobId), ne(jobs.status, "running")))
      .returning({ id: jobs.id });
    if (updated.length === 0) {
      const [existing] = await db.select({ status: jobs.status }).from(jobs).where(eq(jobs.id, jobId));
      if (!existing) throw new NotFoundError("Job not found.");
      throw new AppError("CONFLICT", "This job is running right now. Try again when it has finished.", 409);
    }
    await runWorker({ maxJobs: 5, timeBudgetMs: 15_000 });
    return undefined;
  });
}
