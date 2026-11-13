import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { getBidAccess, type BidAccessSummary } from "@/features/bids/access";
import { NewBidForm, type ExistingFile } from "@/features/bids/components/new-bid-form";
import { Callout, UpgradeNotice } from "@/features/bids/components/ui";
import { getBid, listBidFiles } from "@/features/bids/server/bids";
import { NotFoundError } from "@/lib/errors";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "New bid" };
export const dynamic = "force-dynamic";
// Starting the check nudges the worker from a Server Action on this page.
export const maxDuration = 60;

function allowanceSentence(access: BidAccessSummary): string {
  switch (access.next?.source) {
    case "plan_bid":
      return `This uses 1 of your ${access.fullBids.limit ?? "unlimited"} full bids this month (${access.fullBids.remaining ?? "unlimited"} left): check, drafting, marking and export.`;
    case "plan_brief":
      return `This uses your cited bid check for this month. Drafting and marking need Bid Desk or a Bid Pass.`;
    case "free_brief":
      return access.bidPasses > 0
        ? `This uses your free cited bid check. You also hold ${access.bidPasses} Bid Pass${access.bidPasses === 1 ? "" : "es"} — apply one to this bid afterwards to unlock drafting.`
        : "Your first cited bid check is free. Drafting and marking need Bid Desk or a Bid Pass.";
    case "credit":
      return `This uses 1 Bid Pass (${access.bidPasses} held): one full bid with drafting, marking and export.`;
    default:
      return "You have no cited bid checks left.";
  }
}

export default async function NewBidPage({ searchParams }: { searchParams: Promise<{ notice?: string; bid?: string }> }) {
  const ctx = await requireOrgForPage({ returnTo: "/app/bids/new" });
  const { notice, bid: draftId } = await searchParams;
  const access = await getBidAccess(ctx.organization.id);

  // A draft being resumed (refresh during upload, or opened from the list).
  let existing: ExistingFile[] = [];
  let initialBidId: string | null = null;
  let noticeId = notice && /^[A-Za-z0-9._:\-/]{1,200}$/.test(notice) ? notice : null;
  if (draftId) {
    try {
      const draft = await getBid(ctx, draftId);
      if (draft.status !== "draft") redirect(`/app/bids/${draft.id}`);
      initialBidId = draft.id;
      noticeId = draft.noticeId ?? noticeId;
      existing = (await listBidFiles(ctx, draft.id)).map((file) => ({ id: file.id, name: file.name, size: file.size }));
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="New bid" description="Upload the tender pack. We read every file and return a cited bid check: deadline, pass/fail requirements and questions, each with its quote, file and page." />

      {noticeId ? (
        <Callout>
          Linked to notice <span className="font-mono text-xs">{noticeId}</span>. Upload the documents the buyer published for it.
        </Callout>
      ) : null}

      {!access.next ? (
        <UpgradeNotice title="You have used your cited bid checks" data-testid="quota-reached">
          {access.planName === "Free" ? "The Free plan includes one cited bid check." : `${access.planName} includes ${access.checks.limit ?? 0} cited bid check${access.checks.limit === 1 ? "" : "s"} a month.`} Bid Desk (£149/month) includes 3 full bids a
          month — check, grounded first drafts, evaluator-style marking and Word export. A Bid Pass (£99) covers one full bid on any plan.
        </UpgradeNotice>
      ) : null}

      <NewBidForm initialBidId={initialBidId} initialFiles={existing} noticeId={noticeId} allowance={allowanceSentence(access)} disabled={!access.next} />

      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">What happens next</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5">
          <li>We read every file page by page (scanned pages are transcribed and flagged).</li>
          <li>Two independent readings find requirements, deadlines and questions; questionnaires and clarification files get their own reading.</li>
          <li>Every quote is checked against your documents by our own code. Anything we cannot find is marked “Verify in documents”.</li>
          <li>Requirements are compared with your confirmed company facts. Usually ready in two to four minutes.</li>
        </ol>
        <p className="mt-2">
          Your documents stay in your workspace and are not used to train AI models.{" "}
          <Link href="/sample-check" className="underline underline-offset-4">
            See a sample check
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
