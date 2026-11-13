import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BreadcrumbTrail } from "@/components/app/breadcrumbs";
import { getBidCapabilities } from "@/features/bids/access";
import { BidActions, ExportMenu } from "@/features/bids/components/bid-actions";
import { BidTabs } from "@/features/bids/components/bid-tabs";
import { StandingNotice } from "@/features/bids/components/ui";
import { loadBidPage } from "@/features/bids/server/page-data";
import { coverageSummary, isScoredQuestion } from "@/features/bids/view";
import { ButtonLink } from "@/components/ui/button-link";

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
      {/* The shell renders the trail above the title (and "‹ Bids" on phones). */}
      <BreadcrumbTrail items={[{ label: "Bids", href: "/app/bids" }, ...(bid.buyerName ? [{ label: bid.buyerName }] : []), { label: "Bid check" }]} />

      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-2">
          <p className="bid-mono text-xs text-ink-2" data-testid="bid-meta">
            Bid check
            {done && bid.readyAt ? ` · built ${builtAt(bid.readyAt)}` : bid.status === "processing" ? " · being built now" : bid.status === "failed" ? " · stopped before it finished" : ""}
            {coverage.read > 0 ? ` · ${coverage.headline}` : ""}
            {coverage.read > 0 ? (
              <>
                {" · "}
                <Link href={`${base}/files`} className="bid-link text-ink">
                  Coverage
                </Link>
              </>
            ) : null}
          </p>
          <h1 className="bid-h1" data-testid="bid-title">
            {bid.title}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-15">
            <span>{bid.buyerName ?? "Buyer not read yet"}</span>
            {bid.reference ? (
              <>
                <span className="text-ink-2">· Reference</span>
                <span className="bid-mono text-13 text-ink-2">{bid.reference}</span>
              </>
            ) : null}
            {bid.status === "archived" ? <span className="bid-tag">Archived — read-only</span> : null}
            {bid.accessLevel === "brief" ? <span className="bid-tag">Check only</span> : null}
          </p>
        </div>
        <div className="bid-noprint flex flex-wrap items-center gap-2.5">
          {done ? <ExportMenu bidId={bid.id} canExportAnswers={capabilities.exportAnswers} answersReady={answersReady} label={bid.accessLevel === "full" ? undefined : "Download the check (Word)"} /> : null}
          {done && bid.accessLevel !== "full" && bid.status === "ready" ? (
            <ButtonLink href={`${base}#upgrade-h`}  data-testid="unlock-full-bid">
              Unlock the full bid
            </ButtonLink>
          ) : done && questions.length > 0 ? (
            <ButtonLink href={firstScored ? `${base}/questions/${firstScored.id}` : `${base}/questions`}  data-testid="open-answers">
              Open draft answers
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
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
            { href: `${base}/files`, label: "Coverage", count: packFiles.length },
          ]}
        />
      </div>
      <StandingNotice className="mt-3" />

      <div className="mt-7">{children}</div>

      <footer className="mt-16 rounded-card bg-paper-deep px-5 py-4 text-13 text-ink-2">
        This check is built from the documents you uploaded. It is an aid to reading the pack, not a substitute for it. Bidfolio is independent of the buyer and of GOV.UK.
      </footer>
    </div>
  );
}
