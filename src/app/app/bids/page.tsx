import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { getBidAccess } from "@/features/bids/access";
import { DeadlineChip, Pill, UpgradeNotice, type Tone } from "@/features/bids/components/ui";
import { isRecent } from "@/features/bids/locations";
import { listBids } from "@/features/bids/server/bids";
import { VERDICT_LABELS, type VerdictKey } from "@/features/bids/types";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "Bids" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Uploading", tone: "neutral" },
  processing: { label: "Checking", tone: "brand" },
  ready: { label: "Ready", tone: "success" },
  failed: { label: "Stopped — retry", tone: "danger" },
  archived: { label: "Archived", tone: "neutral" },
};

const VERDICT_TONE: Record<VerdictKey, Tone> = { looks_biddable: "success", biddable_with_gaps: "warning", likely_not_eligible: "danger", not_enough_information: "neutral" };

export default async function BidsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const ctx = await requireOrgForPage({ returnTo: "/app/bids" });
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const [bids, access] = await Promise.all([listBids(ctx, { includeArchived: showArchived }), getBidAccess(ctx.organization.id)]);
  // Abandoned upload drafts drop off the list after a day.
  const visible = bids.filter((bid) => bid.status !== "draft" || isRecent(bid.createdAt, 86_400_000));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bids"
        description="Upload a tender pack to get a cited bid check: every requirement, deadline and question quoted from the buyer's documents."
        actions={
          <Button asChild>
            <Link href="/app/bids/new" data-testid="new-bid">
              <Plus aria-hidden className="size-4" />
              New bid
            </Link>
          </Button>
        }
      />

      {!access.next ? (
        <UpgradeNotice title="You have used your cited bid checks">
          {access.planName} includes {access.checks.limit ? `${access.checks.limit} check${access.checks.limit === 1 ? "" : "s"} a month` : "one free check"}. Bid Desk (£149/month) includes 3 full bids a month with drafting, marking and export; a Bid Pass
          (£99) covers one full bid.
        </UpgradeNotice>
      ) : null}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center" data-testid="bids-empty">
          <h2 className="text-base font-semibold">No bids yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            A bid starts with the tender pack. Upload the ITT and its appendices and, in a few minutes, see the deadline, the pass/fail requirements and every question — each with the quote, file and page it came from.
          </p>
          <Button asChild className="mt-4">
            <Link href="/app/bids/new">Upload a tender pack</Link>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Not sure what you get?{" "}
            <Link href="/sample-check" className="underline underline-offset-4">
              See a sample check on a real council tender
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card" data-testid="bids-list">
          {visible.map((bid) => {
            const status = STATUS[bid.status] ?? STATUS.ready!;
            const href = bid.status === "draft" ? `/app/bids/new?bid=${bid.id}` : `/app/bids/${bid.id}`;
            return (
              <li key={bid.id} className="flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-sm font-semibold">
                    <Link href={href} className="underline-offset-4 hover:underline">
                      {bid.title}
                    </Link>
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {[bid.buyerName, bid.reference ? `Ref ${bid.reference}` : null].filter(Boolean).join(" · ") || "Buyer not read yet"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Pill tone={status.tone}>{bid.status === "processing" ? `${status.label} · ${bid.processingProgress}%` : status.label}</Pill>
                    {bid.status === "ready" || bid.status === "archived" ? <DeadlineChip deadline={bid.submissionDeadline} /> : null}
                    {bid.verdict && bid.status === "ready" ? <Pill tone={VERDICT_TONE[bid.verdict.verdict]}>{VERDICT_LABELS[bid.verdict.verdict]}</Pill> : null}
                    {bid.accessLevel === "brief" && bid.status !== "draft" ? <Pill>Check only</Pill> : null}
                  </div>
                </div>
                {bid.status !== "draft" ? (
                  <dl className="flex shrink-0 gap-5 text-right text-xs text-muted-foreground">
                    <div>
                      <dt>Requirements</dt>
                      <dd className="text-sm font-medium text-foreground tabular-nums">{bid.requirementCount}</dd>
                    </div>
                    <div>
                      <dt>Answers</dt>
                      <dd className="text-sm font-medium text-foreground tabular-nums">
                        {bid.draftedCount}/{bid.questionCount}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        {showArchived ? (
          <Link href="/app/bids" className="underline underline-offset-4">
            Hide archived bids
          </Link>
        ) : (
          <Link href="/app/bids?archived=1" className="underline underline-offset-4">
            Show archived bids
          </Link>
        )}
      </p>
    </div>
  );
}
