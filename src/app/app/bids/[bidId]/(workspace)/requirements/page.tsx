import type { Metadata } from "next";
import { RequirementsView } from "@/features/bids/components/requirements-view";
import { Callout, StandingNotice } from "@/features/bids/components/ui";
import { factsConfirmed, loadBidPage } from "@/features/bids/server/page-data";
import { toRequirementItem } from "@/features/bids/view";

export const metadata: Metadata = { title: "Requirements" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Requirements tab: the compliance matrix, editable, each row with its source and a "checked" tick. */
export default async function RequirementsPage({ params }: { params: Promise<{ bidId: string }> }) {
  const { bidId } = await params;
  const { ctx, bid, requirements } = await loadBidPage(bidId);
  const confirmed = await factsConfirmed(ctx.organization.id);
  const processing = bid.status === "processing";
  return (
    <div className="space-y-5">
      <StandingNotice />
      {processing ? <Callout>The pack is still being read. Requirements appear here as they are found; you can edit them once the check is ready.</Callout> : null}
      {bid.status === "failed" ? <Callout tone="warning">The analysis stopped before it finished, so this list may be incomplete. Retry from the Brief tab.</Callout> : null}
      <RequirementsView
        bidId={bid.id}
        requirements={requirements.map(toRequirementItem)}
        links={{ kind: "app", bidId: bid.id }}
        readOnly={bid.status !== "ready"}
        factsConfirmed={confirmed}
      />
    </div>
  );
}
