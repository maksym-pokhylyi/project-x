import { getBid } from "@/features/bids/server/bids";
import { getBidStatus, reviveStalledBid } from "@/features/bids/server/status";
import { json, route } from "@/server/http";
import { requireOrg } from "@/server/session";

/**
 * Processing status of one bid, polled by the workspace while a pack is being analysed.
 * Doubles as a watchdog for stalled runs (see reviveStalledBid). The worker it may start
 * runs in this invocation after the response, hence the long maxDuration.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = route<{ params: Promise<{ bidId: string }> }>(async (_request, context, { requestId }) => {
  const ctx = await requireOrg();
  const { bidId } = await context.params;
  const bid = await getBid(ctx, bidId); // 404 for another workspace's bid
  await reviveStalledBid(bid);
  return json(await getBidStatus(ctx, bid), { requestId });
});
