import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { errorLog, jobs } from "@/db/schema";
import { jobHandlers } from "@/lib/jobs/handlers";
import { backoffSeconds, claimNextJob, enqueueJob, purgeFinishedJobs, STALE_LOCK_SECONDS } from "@/lib/jobs/queue";
import { runWorker } from "@/lib/jobs/worker";
import { resetDatabase } from "./helpers/db";

type Handlers = Record<string, (payload: unknown, context: { jobId: string; attempt: number }) => Promise<void>>;
const handlers = jobHandlers as unknown as Handlers;
const originalCleanup = handlers["maintenance.cleanup"]!;

const jobById = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0]!;
/** Makes a job due now (as if its backoff had elapsed). */
const makeDue = (id: string) => db.update(jobs).set({ runAfter: new Date(Date.now() - 1000) }).where(eq(jobs.id, id));

describe("background jobs", () => {
  beforeEach(resetDatabase);
  afterEach(() => {
    handlers["maintenance.cleanup"] = originalCleanup;
  });

  it("backs off exponentially with a cap", () => {
    expect([1, 2, 3, 4, 5].map(backoffSeconds)).toEqual([30, 60, 120, 240, 480]);
    expect(backoffSeconds(0)).toBe(30);
    expect(backoffSeconds(50)).toBe(6 * 60 * 60);
  });

  it("runs a due job once and marks it succeeded", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    handlers["maintenance.cleanup"] = handler;
    const id = (await enqueueJob("maintenance.cleanup", {}))!;
    const summary = await runWorker();
    expect(summary).toEqual({ claimed: 1, succeeded: 1, retried: 0, failed: 0 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({}, { jobId: id, attempt: 1 });
    const job = await jobById(id);
    expect(job).toMatchObject({ status: "succeeded", attempts: 1, lockedAt: null, lastError: null });
    expect(job.completedAt).toBeInstanceOf(Date);
    // Nothing left to do.
    expect((await runWorker()).claimed).toBe(0);
  });

  it("does not run jobs scheduled for the future", async () => {
    handlers["maintenance.cleanup"] = vi.fn();
    await enqueueJob("maintenance.cleanup", {}, { runAfter: new Date(Date.now() + 60_000) });
    expect((await runWorker()).claimed).toBe(0);
  });

  it("retries a failing job with exponential backoff, then gives up and reports it", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("provider is down"));
    handlers["maintenance.cleanup"] = handler;
    const id = (await enqueueJob("maintenance.cleanup", {}, { maxAttempts: 3 }))!;

    // Attempt 1 -> pending, due in ~30s
    let before = Date.now();
    expect(await runWorker()).toEqual({ claimed: 1, succeeded: 0, retried: 1, failed: 0 });
    let job = await jobById(id);
    expect(job).toMatchObject({ status: "pending", attempts: 1, lastError: "provider is down", lockedAt: null });
    expect(job.runAfter.getTime() - before).toBeGreaterThan(28_000);
    expect(job.runAfter.getTime() - before).toBeLessThan(35_000);
    // Not due yet, so the worker leaves it alone.
    expect((await runWorker()).claimed).toBe(0);

    // Attempt 2 -> pending, due in ~60s
    await makeDue(id);
    before = Date.now();
    expect((await runWorker()).retried).toBe(1);
    job = await jobById(id);
    expect(job.attempts).toBe(2);
    expect(job.runAfter.getTime() - before).toBeGreaterThan(58_000);
    expect(job.runAfter.getTime() - before).toBeLessThan(65_000);

    // Attempt 3 = maxAttempts -> failed for good, recorded in error_log
    await makeDue(id);
    expect(await runWorker()).toEqual({ claimed: 1, succeeded: 0, retried: 0, failed: 1 });
    job = await jobById(id);
    expect(job).toMatchObject({ status: "failed", attempts: 3, lastError: "provider is down" });
    expect(handler).toHaveBeenCalledTimes(3);
    const errors = await db.select().from(errorLog);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ route: "job:maintenance.cleanup", message: "provider is down" });

    // A failed job is never picked up again.
    await makeDue(id);
    expect((await runWorker()).claimed).toBe(0);
  });

  it("succeeds on a later attempt after transient failures", async () => {
    const handler = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValue(undefined);
    handlers["maintenance.cleanup"] = handler;
    const id = (await enqueueJob("maintenance.cleanup", {}))!;
    await runWorker();
    await makeDue(id);
    expect((await runWorker()).succeeded).toBe(1);
    expect(await jobById(id)).toMatchObject({ status: "succeeded", attempts: 2, lastError: null });
  });

  it("de-duplicates on dedupeKey", async () => {
    const first = await enqueueJob("maintenance.cleanup", {}, { dedupeKey: "cleanup:2026-11-13" });
    const second = await enqueueJob("maintenance.cleanup", {}, { dedupeKey: "cleanup:2026-11-13" });
    const other = await enqueueJob("maintenance.cleanup", {}, { dedupeKey: "cleanup:2026-11-14" });
    expect(first).toBeTruthy();
    expect(second).toBeNull();
    expect(other).toBeTruthy();
    expect(await db.select().from(jobs)).toHaveLength(2);
  });

  it("never hands the same job to two workers", async () => {
    await enqueueJob("maintenance.cleanup", {});
    const claims = await Promise.all([claimNextJob(), claimNextJob(), claimNextJob(), claimNextJob()]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("processes each job exactly once when workers run concurrently", async () => {
    const seen: string[] = [];
    handlers["maintenance.cleanup"] = async (_payload, context) => {
      seen.push(context.jobId);
      await new Promise((resolve) => setTimeout(resolve, 5));
    };
    for (let i = 0; i < 12; i += 1) await enqueueJob("maintenance.cleanup", {});
    const summaries = await Promise.all([runWorker(), runWorker(), runWorker()]);
    expect(summaries.reduce((sum, summary) => sum + summary.succeeded, 0)).toBe(12);
    expect(new Set(seen).size).toBe(12);
    expect(seen).toHaveLength(12);
  });

  it("reclaims a job whose worker died (stale lock)", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    handlers["maintenance.cleanup"] = handler;
    const id = (await enqueueJob("maintenance.cleanup", {}))!;
    await claimNextJob(); // simulates a worker that crashed mid-run
    expect((await runWorker()).claimed).toBe(0); // lock still fresh
    await db.execute(sql`update jobs set locked_at = now() - make_interval(secs => ${STALE_LOCK_SECONDS + 5}::int) where id = ${id}`);
    expect((await runWorker()).succeeded).toBe(1);
    expect(await jobById(id)).toMatchObject({ status: "succeeded", attempts: 2 });
  });

  it("fails a job with an unknown type without retrying", async () => {
    await db.insert(jobs).values({ type: "does.not.exist", payload: {} });
    expect(await runWorker()).toEqual({ claimed: 1, succeeded: 0, retried: 0, failed: 1 });
    const [job] = await db.select().from(jobs);
    expect(job).toMatchObject({ status: "failed", attempts: 1 });
    expect(job?.lastError).toMatch(/No handler registered/);
  });

  it("respects maxJobs", async () => {
    handlers["maintenance.cleanup"] = vi.fn().mockResolvedValue(undefined);
    for (let i = 0; i < 5; i += 1) await enqueueJob("maintenance.cleanup", {});
    expect((await runWorker({ maxJobs: 2 })).claimed).toBe(2);
    expect((await runWorker()).claimed).toBe(3);
  });

  it("the real maintenance job is idempotent and purges old data", async () => {
    await db.execute(sql`insert into rate_limits (key, window_start, count, expires_at) values ('old', now() - interval '2 hours', 1, now() - interval '1 hour')`);
    const done = (await enqueueJob("maintenance.cleanup", {}))!;
    await runWorker();
    await db.update(jobs).set({ completedAt: new Date(Date.now() - 20 * 86_400_000) }).where(eq(jobs.id, done));
    expect(await purgeFinishedJobs(14)).toBe(1);
    await enqueueJob("maintenance.cleanup", {});
    await enqueueJob("maintenance.cleanup", {});
    expect((await runWorker()).succeeded).toBe(2);
    expect((await db.execute(sql`select 1 from rate_limits`)).length).toBe(0);
  });
});
