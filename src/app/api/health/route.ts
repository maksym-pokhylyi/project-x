import { sql } from "drizzle-orm";
import { db } from "@/db";
import { errorReason } from "@/lib/describe-error";
import { log } from "@/lib/logger";

/** Liveness + database check for uptime monitors. 200 when Postgres answers, 503 otherwise. */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json(
      { status: "ok", database: "ok", latencyMs: Date.now() - started, time: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    log.error("health check failed", { reason: errorReason(error) });
    return Response.json(
      { status: "error", database: "unreachable", time: new Date().toISOString() },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
