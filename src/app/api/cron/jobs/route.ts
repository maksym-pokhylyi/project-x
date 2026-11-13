import { timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { enqueueJob } from "@/lib/jobs/queue";
import { runWorker } from "@/lib/jobs/worker";
import { log } from "@/lib/logger";
import { json, route } from "@/server/http";

/**
 * Job worker tick, invoked by Vercel Cron (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. Also schedules the once-a-day maintenance job.
 * Run it by hand:  curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/jobs
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function isAuthorized(header: string | null): boolean {
  if (!env.CRON_SECRET || !header) return false;
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const GET = route(async (request, _context, { requestId }) => {
  if (!env.CRON_SECRET) return json({ error: "CRON_SECRET is not configured" }, { status: 503, requestId });
  if (!isAuthorized(request.headers.get("authorization"))) return json({ error: "unauthorized" }, { status: 401, requestId });

  const today = new Date().toISOString().slice(0, 10);
  await enqueueJob("maintenance.cleanup", {}, { dedupeKey: `maintenance.cleanup:${today}` });

  // Leave headroom below maxDuration so the last job can finish.
  const summary = await runWorker({ maxJobs: 500, timeBudgetMs: 240_000 });
  if (summary.claimed > 0) log.info("cron worker tick", summary);
  return json({ ok: true, ...summary }, { requestId });
});
