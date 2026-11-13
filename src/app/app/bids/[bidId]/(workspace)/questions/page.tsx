import type { Metadata } from "next";
import { getBidAccess, getBidCapabilities } from "@/features/bids/access";
import { UnlockButton } from "@/features/bids/components/bid-actions";
import { QuestionsView } from "@/features/bids/components/questions-view";
import { Callout, UpgradeNotice } from "@/features/bids/components/ui";
import { UpgradePanel } from "@/features/bids/components/upgrade-panel";
import { loadBidPage } from "@/features/bids/server/page-data";
import { isScoredQuestion, toQuestionItem } from "@/features/bids/view";

export const metadata: Metadata = { title: "Questions" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Questions tab: every question with weighting, limit, status and progress; add and edit by hand. */
export default async function QuestionsPage({ params }: { params: Promise<{ bidId: string }> }) {
  const { bidId } = await params;
  const { ctx, bid, questions } = await loadBidPage(bidId);
  const [capabilities, access] = await Promise.all([getBidCapabilities(ctx.organization.id, bid), getBidAccess(ctx.organization.id)]);
  const canUnlock = bid.accessLevel !== "full" && ((access.drafting && (access.fullBids.remaining === null || access.fullBids.remaining > 0)) || access.bidPasses > 0);
  if (capabilities.lockedReason === "check_only" && bid.status !== "processing") {
    const scored = questions.filter((question) => isScoredQuestion(question));
    return (
      <div className="flex flex-col gap-5">
        <p className="text-[15px]">
          {scored.length} scored question{scored.length === 1 ? "" : "s"} found. Titles are shown; the matrix, drafts and marking are part of a full bid.
        </p>
        {scored.length > 0 ? (
          <ol className="bid-card" data-testid="scored-questions-locked">
            {scored.map((question, index) => (
              <li key={question.id} className={`flex items-baseline gap-4 px-5 py-3 text-[15px] sm:px-6 ${index > 0 ? "bid-rule" : ""}`}>
                <span className="bid-mono w-14 shrink-0 text-xs text-(--bid-muted)">{question.ref}</span>
                <span className="min-w-0">{question.title ?? question.text}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <UpgradePanel access={access} moment="locked">
          {canUnlock ? <UnlockButton bidId={bid.id} label={access.drafting ? "Use one of your full bids on this tender" : `Use a Bid Pass on this tender (${access.bidPasses} left)`} /> : null}
        </UpgradePanel>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {bid.status === "processing" ? <Callout>The pack is still being read. Questions appear here as they are found.</Callout> : null}
      {!capabilities.drafting && bid.status !== "processing" ? (
        <UpgradeNotice
          title={capabilities.lockedReason === "plan_lapsed" ? "Drafting is paused on this bid" : "Drafting and marking are part of Bid Desk"}
          secondary={
            canUnlock ? <UnlockButton bidId={bid.id} label={access.bidPasses > 0 && !access.drafting ? `Use a Bid Pass (${access.bidPasses} held)` : "Use 1 full bid from your plan"} /> : undefined
          }
        >
          {capabilities.lockedReason === "plan_lapsed"
            ? "Your plan no longer includes drafting. Your questions and answers are safe and readable."
            : "Your cited bid check lists every question. Bid Desk (£149/month, 3 full bids) adds grounded first drafts from your own evidence, evaluator-style marking against the tender's scoring and Word export. A Bid Pass (£99) unlocks them for this one bid."}
        </UpgradeNotice>
      ) : null}
      <QuestionsView
        bidId={bid.id}
        questions={questions.map(toQuestionItem)}
        links={{ kind: "app", bidId: bid.id }}
        basePath={`/app/bids/${bid.id}`}
        readOnly={bid.status !== "ready"}
        canDraft={capabilities.drafting}
      />
    </div>
  );
}
