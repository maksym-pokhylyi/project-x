import "server-only";
import { and, asc, eq, gt, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { bids } from "@/db/schema";

export type BidDeadline = {
  bidId: string;
  title: string;
  /** Null when the pack did not name the buyer. */
  buyerName: string | null;
  closesAt: Date;
  href: string;
};

/**
 * Bids in progress with a known closing time, soonest first — for deadline reminders.
 * Read-only; `organizationId` comes from the caller's own loop over workspaces (a scheduled
 * job), never from a request.
 *
 * "In progress" is every bid that is not archived. "Known" is strict: the closing time is
 * the one read from the tender pack, and it is only stored when both readings of the pack
 * agreed on it — a pack with two different deadlines has none here (the brief shows both
 * with "Check"), so a reminder is never built on a disputed date. Deadlines that have
 * passed are left out.
 */
export async function listBidDeadlines(
  organizationId: string,
  now: Date = new Date(),
): Promise<BidDeadline[]> {
  const rows = await db
    .select({
      id: bids.id,
      title: bids.title,
      buyerName: bids.buyerName,
      closesAt: bids.submissionDeadline,
    })
    .from(bids)
    .where(
      and(
        eq(bids.organizationId, organizationId),
        ne(bids.status, "archived"),
        isNotNull(bids.submissionDeadline),
        gt(bids.submissionDeadline, now),
      ),
    )
    .orderBy(asc(bids.submissionDeadline));
  return rows.flatMap((row) =>
    row.closesAt
      ? [
          {
            bidId: row.id,
            title: row.title,
            buyerName: row.buyerName,
            closesAt: row.closesAt,
            href: `/app/bids/${row.id}`,
          },
        ]
      : [],
  );
}
