import { verifyWorkerAuth } from "@/features/bids/server/pipeline/dispatch";
import { kickWorker } from "@/lib/jobs/worker";
import { json, route } from "@/server/http";

/**
 * Worker nudge. Called by the app itself (never by a browser) right after a pipeline job
 * is enqueued: it starts the job worker in THIS invocation — with its own time budget —
 * and returns at once. Authenticated with a short-lived HMAC (see dispatch.ts). The cron
 * route remains the safety net when a nudge is lost.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export const POST = route(async (request, _context, { requestId }) => {
  if (!verifyWorkerAuth(request.headers.get("authorization"))) return json({ error: "unauthorized" }, { status: 401, requestId });
  kickWorker();
  return json({ ok: true }, { status: 202, requestId });
});
