import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BidActions } from "@/features/bids/components/bid-actions";
import { BidTabs } from "@/features/bids/components/bid-tabs";
import { DeadlineChip, Pill } from "@/features/bids/components/ui";
import { loadBidPage } from "@/features/bids/server/page-data";

export const metadata: Metadata = { title: "Bid" };
export const dynamic = "force-dynamic";
// Server Actions invoked from these pages (drafting, marking) can take a minute or two.
export const maxDuration = 300;

/** Bid workspace shell: title, buyer, deadline, tabs. Every page below re-checks access itself. */
export default async function BidLayout({ children, params }: { children: ReactNode; params: Promise<{ bidId: string }> }) {
  const { bidId } = await params;
  const { bid, requirements, questions } = await loadBidPage(bidId);
  const base = `/app/bids/${bid.id}`;
  return (
    <div className="space-y-5">
      <div>
        <Link href="/app/bids" className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline">
          <ChevronLeft aria-hidden className="size-3.5" />
          All bids
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl" data-testid="bid-title">
              {bid.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{[bid.buyerName, bid.reference ? `Ref ${bid.reference}` : null].filter(Boolean).join(" · ") || "Buyer not read yet"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {bid.status === "ready" || bid.status === "archived" ? <DeadlineChip deadline={bid.submissionDeadline} /> : null}
              {bid.status === "archived" ? <Pill>Archived — read-only</Pill> : null}
              {bid.accessLevel === "brief" && bid.status !== "draft" ? <Pill>Check only</Pill> : <Pill tone="brand">Full bid</Pill>}
            </div>
          </div>
          <BidActions bidId={bid.id} status={bid.status} />
        </div>
      </div>
      <BidTabs
        tabs={[
          { href: base, label: "Brief", exact: true },
          { href: `${base}/requirements`, label: "Requirements", count: requirements.length },
          { href: `${base}/questions`, label: "Questions", count: questions.length },
          { href: `${base}/export`, label: "Export" },
        ]}
      />
      {children}
    </div>
  );
}
