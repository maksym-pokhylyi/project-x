import { BriefView } from "@/features/bids/components/brief-view";
import { PartialResults } from "@/features/bids/components/partial-results";
import { ProcessingState } from "@/features/bids/components/processing-state";
import { factsConfirmed, loadBidPage } from "@/features/bids/server/page-data";
import { getBidStatus } from "@/features/bids/server/status";
import { coverageSummary, toPackFileItems, toQuestionItem, toRequirementItem } from "@/features/bids/view";
import { track } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Brief tab: the cited bid check. Shows the processing state on top while the pack is being read. */
export default async function BriefPage({ params }: { params: Promise<{ bidId: string }> }) {
  const { bidId } = await params;
  const { ctx, bid, files, requirements, questions } = await loadBidPage(bidId);
  const [status, confirmed] = await Promise.all([getBidStatus(ctx, bid), factsConfirmed(ctx.organization.id)]);
  const processing = bid.status === "processing" || bid.status === "failed";
  const done = bid.status === "ready" || bid.status === "archived";
  if (bid.status === "ready") await track("brief_viewed", { organizationId: ctx.organization.id, userId: ctx.user.id }, { status: bid.status });

  return (
    <div className="flex flex-col gap-6">
      {processing ? <ProcessingState bidId={bid.id} initial={status} /> : null}
      {processing ? (
        <PartialResults
          bidId={bid.id}
          basePath={`/app/bids/${bid.id}`}
          requirements={requirements.map(toRequirementItem)}
          questions={questions.map(toQuestionItem)}
          files={toPackFileItems(files, null)}
          coverage={coverageSummary(files, null)}
          companyChecked={status.stages.find((stage) => stage.stage === "company")?.status === "done"}
          questionsListed={status.stages.find((stage) => stage.stage === "questions")?.status === "done"}
        />
      ) : (
        <BriefView
          bidId={bid.id}
          brief={bid.brief}
          verdict={done ? bid.verdict : null}
          evaluationModel={bid.evaluationModel}
          keyDates={bid.keyDates ?? []}
          packStats={done ? bid.packStats : null}
          submissionDeadline={bid.submissionDeadline}
          requirements={requirements.map(toRequirementItem)}
          questions={questions.map(toQuestionItem)}
          files={toPackFileItems(files, bid.packStats)}
          coverage={coverageSummary(files, done ? bid.packStats : null)}
          links={{ kind: "app", bidId: bid.id }}
          readOnly={bid.status !== "ready"}
          factsConfirmed={confirmed}
          basePath={`/app/bids/${bid.id}`}
        />
      )}
    </div>
  );
}
