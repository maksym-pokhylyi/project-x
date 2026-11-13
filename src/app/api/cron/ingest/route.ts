import { timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { runIngestion } from "@/features/procurement/ingest/run";
import { json, route } from "@/server/http";

/**
 * Find a Tender ingestion tick, invoked by Vercel Cron every 10 minutes (see vercel.json)
 * with `Authorization: Bearer $CRON_SECRET` — the same protection as /api/cron/jobs.
 * Run it by hand:  curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/ingest
 *
 * Reads what changed since the stored cursor (at most 20 pages = 2,000 notices per tick,
 * one request every ~10 s). Overlapping invocations are harmless: the second one exits
 * as "skipped". Backfill runs separately, as `procurement.backfill` jobs.
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

  // Leave headroom below maxDuration for the last page's writes and profile rebuild.
  const summary = await runIngestion({ maxPages: 20, timeBudgetMs: 240_000 });
  return json({ ok: summary.status !== "error", ...summary }, { status: summary.status === "error" ? 502 : 200, requestId });
});
