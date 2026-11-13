import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getBidCapabilities } from "@/features/bids/access";
import { BidActions, ExportMenu } from "@/features/bids/components/bid-actions";
import { BidTabs } from "@/features/bids/components/bid-tabs";
import { StandingNotice } from "@/features/bids/components/ui";
import { loadBidPage } from "@/features/bids/server/page-data";
import { coverageSummary, isScoredQuestion } from "@/features/bids/view";

export const metadata: Metadata = { title: "Bid" };
export const dynamic = "force-dynamic";
// Server Actions invoked from these pages (re-checks, retries) can take a minute or two.
export const maxDuration = 300;

const builtAt = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date).replace(",", " at");

/** Bid workspace: breadcrumb, meta line, title, actions and tabs. Every page below re-checks access itself. */
export default async function BidLayout({ children, params }: { children: ReactNode; params: Promise<{ bidId: string }> }) {
  const { bidId } = await params;
  const { ctx, bid, files, requirements, questions } = await loadBidPage(bidId);
  const capabilities = await getBidCapabilities(ctx.organization.id, bid);
  const base = `/app/bids/${bid.id}`;
  const done = bid.status === "ready" || bid.status === "archived";
  const coverage = coverageSummary(files, bid.packStats);
  const firstScored = questions.find((question) => isScoredQuestion(question)) ?? questions[0];
  const answersReady = questions.filter((question) => question.draftText?.trim()).length;
  const packFiles = files.filter((file) => file.kind !== "zip");

  return (
    <div className="bid-scope flex flex-col">
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-(--bid-muted)">
        <Link href="/app/bids" className="bid-link-quiet">
          Bids
        </Link>
        <span aria-hidden>/</span>
        {bid.buyerName ? (
          <>
            <span className="max-w-[16rem] truncate">{bid.buyerName}</span>
            <span aria-hidden>/</span>
          </>
        ) : null}
        <span>Bid check</span>
      </nav>

      <div className="mt-3.5 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-2">
          <p className="bid-mono text-xs text-(--bid-muted)" data-testid="bid-meta">
            Bid check
            {done && bid.readyAt ? ` · built ${builtAt(bid.readyAt)}` : bid.status === "processing" ? " · being built now" : bid.status === "failed" ? " · stopped before it finished" : ""}
            {coverage.read > 0 ? ` · ${coverage.headline}` : ""}
          </p>
          <h1 className="bid-h1" data-testid="bid-title">
            {bid.title}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
            <span>{bid.buyerName ?? "Buyer not read yet"}</span>
            {bid.reference ? (
              <>
                <span className="text-(--bid-muted)">· Reference</span>
                <span className="bid-mono text-[13px] text-(--bid-muted)">{bid.reference}</span>
              </>
            ) : null}
            {bid.status === "archived" ? <span className="bid-tag">Archived — read-only</span> : null}
            {bid.accessLevel === "brief" ? <span className="bid-tag">Check only</span> : null}
          </p>
        </div>
        <div className="bid-noprint flex flex-wrap items-center gap-2.5">
          {done ? <ExportMenu bidId={bid.id} canExportAnswers={capabilities.exportAnswers} answersReady={answersReady} /> : null}
          {done && questions.length > 0 ? (
            <Link href={firstScored ? `${base}/questions/${firstScored.id}` : `${base}/questions`} className="bid-btn bid-btn-primary" data-testid="open-answers">
              Open draft answers
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          ) : null}
          <BidActions bidId={bid.id} status={bid.status} />
        </div>
      </div>

      <div className="mt-6">
        <BidTabs
          tabs={[
            { href: base, label: "Brief", exact: true },
            { href: `${base}/requirements`, label: "Requirements", count: requirements.length },
            { href: `${base}/questions`, label: "Answers", count: questions.length },
            { href: `${base}/files`, label: "Pack files", count: packFiles.length },
          ]}
        />
      </div>
      <StandingNotice className="mt-3" />

      <div className="mt-7">{children}</div>

      <footer className="mt-16 rounded-[10px] bg-(--bid-paper-deep) px-5 py-4 text-[13px] text-(--bid-muted)">
        This check is built from the documents you uploaded. It is an aid to reading the pack, not a substitute for it. Bidfolio is independent of the buyer and of GOV.UK.
      </footer>
    </div>
  );
}
