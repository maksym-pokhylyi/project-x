import Link from "next/link";
import { BriefView } from "@/features/bids/components/brief-view";
import { ProcessingState } from "@/features/bids/components/processing-state";
import { Callout } from "@/features/bids/components/ui";
import { factsConfirmed, loadBidPage } from "@/features/bids/server/page-data";
import { getBidStatus } from "@/features/bids/server/status";
import { toRequirementItem } from "@/features/bids/view";
import { track } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Brief tab: the cited bid check. Shows the processing state on top while the pack is being read. */
export default async function BriefPage({ params }: { params: Promise<{ bidId: string }> }) {
  const { bidId } = await params;
  const { ctx, bid, requirements, questions } = await loadBidPage(bidId);
  const [status, confirmed] = await Promise.all([getBidStatus(ctx, bid), factsConfirmed(ctx.organization.id)]);
  const processing = bid.status === "processing" || bid.status === "failed";
  if (bid.status === "ready") await track("brief_viewed", { organizationId: ctx.organization.id, userId: ctx.user.id }, { status: bid.status });

  return (
    <div className="space-y-6">
      {processing ? <ProcessingState bidId={bid.id} initial={status} /> : null}
      {bid.status === "ready" && !confirmed ? (
        <Callout tone="warning" title="Confirm your company facts to see where you stand">
          The requirements below were found in the pack, but they have not been compared with your company yet.{" "}
          <Link href="/app/library" className="font-medium underline underline-offset-4">
            Confirm your company facts
          </Link>
          , then use “Re-check against company facts” on the Requirements tab.
        </Callout>
      ) : null}
      {processing && !bid.brief && requirements.length === 0 ? null : (
        <BriefView
          bidId={bid.id}
          brief={bid.brief}
          verdict={bid.status === "ready" || bid.status === "archived" ? bid.verdict : null}
          evaluationModel={bid.evaluationModel}
          keyDates={bid.keyDates ?? []}
          packStats={bid.status === "ready" || bid.status === "archived" ? bid.packStats : null}
          review={bid.review}
          submissionDeadline={bid.submissionDeadline}
          requirements={requirements.map(toRequirementItem)}
          questionCount={questions.length}
          links={{ kind: "app", bidId: bid.id }}
          readOnly={bid.status !== "ready"}
          partial={processing}
          factsConfirmed={confirmed}
          basePath={`/app/bids/${bid.id}`}
        />
      )}
    </div>
  );
}
