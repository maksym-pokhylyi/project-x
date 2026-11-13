import "server-only";
import { and, gte, inArray, lt } from "drizzle-orm";
import { RETENTION_DAYS } from "@/config/retention";
import { db } from "@/db";
import { bids } from "@/db/schema";
import { storage } from "@/lib/storage";
import { bidWorkFolder } from "./store";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A bid is swept on each of this many daily runs, so a missed run loses nothing. */
const SWEEP_WINDOW_DAYS = 14;

/**
 * Retention for the bid desk, run by the daily `maintenance.cleanup` job (rules in
 * src/config/retention.ts). Only working files are removed here; bids, uploaded documents,
 * library documents and answers are customer content and go when the customer deletes
 * them or the workspace (src/server/tenant-data.ts covers every table and the whole
 * storage folder). Idempotent.
 */
export async function runBidRetention(
  now: Date = new Date(),
): Promise<{ bidWorkFiles: number }> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS.bidWorkFiles * DAY_MS);
  const windowStart = new Date(cutoff.getTime() - SWEEP_WINDOW_DAYS * DAY_MS);
  const finished = await db
    .select({ id: bids.id, organizationId: bids.organizationId })
    .from(bids)
    .where(
      and(
        inArray(bids.status, ["ready", "archived"]),
        lt(bids.readyAt, cutoff),
        gte(bids.readyAt, windowStart),
      ),
    );
  let bidWorkFiles = 0;
  for (const bid of finished)
    bidWorkFiles += await storage.deletePrefix(
      bidWorkFolder(bid.organizationId, bid.id),
    );
  return { bidWorkFiles };
}
