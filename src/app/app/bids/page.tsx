import "@/features/bids/components/bid-theme.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getBidAccess, UPGRADE_URL, type BidAccessSummary } from "@/features/bids/access";
import { daysLeftLabel, formatDeadline } from "@/features/bids/components/ui";
import { isRecent } from "@/features/bids/locations";
import { listBids, type BidListItem } from "@/features/bids/server/bids";
import { VERDICT_LABELS, type VerdictKey } from "@/features/bids/types";
import { cn } from "@/lib/utils";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "Bids" };
export const dynamic = "force-dynamic";

const VERDICT_PILL: Record<VerdictKey, string> = { looks_biddable: "bid-pill-met", biddable_with_gaps: "bid-pill-amber", likely_not_eligible: "bid-pill-gap", not_enough_information: "bid-pill-neutral" };
const day = (date: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" }).format(date);
const plural = (count: number, one: string, many = `${one}s`) => (count === 1 ? one : many);

/** Where the bid stands, from what is stored about it (nothing here is a guess). */
function stageOf(bid: BidListItem): string {
  if (bid.status === "draft") return "Not started";
  if (bid.status === "processing") return "Check in progress";
  if (bid.status === "failed") return "Check stopped";
  if (bid.status === "archived") return "Archived";
  if (bid.questionCount > 0 && bid.finalCount === bid.questionCount) return "Answers final";
  if (bid.draftedCount > 0) return `Drafting ${bid.draftedCount} of ${bid.questionCount} ${plural(bid.questionCount, "answer")}`;
  return "Check ready";
}

function lastActivity(date: Date, now: Date): string {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(date);
  return day(date) === day(now) ? `Today, ${time}` : day(date);
}

/** The usage line beside "New bid check": what the plan includes, what is used, what was carried over. */
function UsageLine({ access }: { access: BidAccessSummary }) {
  const { fullBids, checks } = access;
  let lead: string;
  let rest: string | null = null;
  if (access.drafting && fullBids.limit !== null) {
    lead = `${fullBids.used} of ${fullBids.limit}`;
    rest = fullBids.trial ? `full ${plural(fullBids.limit, "bid")} used in your trial` : "full bids used this month";
  } else if (access.drafting) {
    lead = `${fullBids.used}`;
    rest = "full bids used this month";
  } else if ((checks.limit ?? 0) > 0) {
    lead = `${checks.used} of ${checks.limit}`;
    rest = `cited ${plural(checks.limit ?? 0, "check")} used this month`;
  } else {
    lead = access.freeCheckAvailable ? "1 free" : "Free";
    rest = access.freeCheckAvailable ? "cited bid check to use" : "cited bid check used";
  }
  return (
    <p className="text-sm" data-testid="usage-line">
      <span className="bid-serif text-xl font-semibold">{lead}</span> <span>{rest}</span>
      {fullBids.rolledOver ? (
        <span className="text-ink-2">
          {" · "}
          {fullBids.rolledOver.count} unused {plural(fullBids.rolledOver.count, "bid")} rolled over from {fullBids.rolledOver.fromLabel}: use {fullBids.rolledOver.count === 1 ? "it" : "them"} by {day(fullBids.rolledOver.useBy)}
        </span>
      ) : null}
      {access.bidPasses > 0 ? (
        <span className="text-ink-2">
          {" · "}
          {access.bidPasses} Bid {plural(access.bidPasses, "Pass", "Passes")}
        </span>
      ) : null}
      {" · "}
      <Link href={UPGRADE_URL} className="bid-link text-ink">
        Billing
      </Link>
    </p>
  );
}

/** Bids list (design handoff: Bids, BidsEmpty). */
export default async function BidsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const ctx = await requireOrgForPage({ returnTo: "/app/bids" });
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const [bids, access] = await Promise.all([listBids(ctx, { includeArchived: showArchived }), getBidAccess(ctx.organization.id)]);
  // Abandoned upload drafts drop off the list after a day.
  const visible = bids.filter((bid) => bid.status !== "draft" || isRecent(bid.createdAt, 86_400_000));
  const now = new Date();

  return (
    <div className="bid-scope flex flex-col">
      <div className="bid-toolbar flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <h1 className="bid-h1">Bids</h1>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <UsageLine access={access} />
          <Link href="/app/bids/new" className="bid-btn bid-btn-primary" data-testid="new-bid">
            New bid check
          </Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <section className="bid-card mt-7 flex flex-col items-start gap-4 px-6 py-9 sm:px-9" data-testid="bids-empty">
          <h2 className="bid-h2">No bids yet</h2>
          <p className="max-w-[620px] text-17 leading-[1.45]">Upload a tender pack and get every requirement quoted and cited, checked against your company, with a plain verdict.</p>
          <div className="bid-toolbar flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/app/bids/new" className="bid-btn bid-btn-primary">
              New bid check
            </Link>
            <Link href="/sample-check" className="bid-link text-15 font-medium text-ink">
              See a sample check
            </Link>
          </div>
          <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-15 text-ink-2">
            {["Upload the pack", "Read the check", "Draft and mark your answers"].map((step, index) => (
              <li key={step} className="flex items-center gap-2">
                <span className="bid-mono flex size-6 items-center justify-center rounded-full border border-line-strong text-xs text-ink">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <div className="bid-card mt-7 overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] gap-x-6 border-b border-line px-6 py-3 text-13 font-semibold text-ink-2 min-[900px]:grid" aria-hidden>
            <span>Tender</span>
            <span>Deadline</span>
            <span>Stage</span>
            <span>Verdict</span>
            <span>Last activity</span>
          </div>
          <ul data-testid="bids-list">
            {visible.map((bid, index) => {
              const href = bid.status === "draft" ? `/app/bids/new?bid=${bid.id}` : `/app/bids/${bid.id}`;
              const left = bid.submissionDeadline ? daysLeftLabel(bid.submissionDeadline, now) : null;
              const verdict = bid.verdict && (bid.status === "ready" || bid.status === "archived") ? bid.verdict.verdict : null;
              return (
                <li
                  key={bid.id}
                  className={cn(
                    "grid grid-cols-1 gap-x-6 gap-y-2 px-5 py-4 sm:px-6 min-[900px]:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] min-[900px]:items-center",
                    index > 0 ? "bid-rule" : "",
                  )}
                  data-testid="bid-row"
                >
                  <div className="min-w-0">
                    <h2 className="text-15 leading-[1.35] font-semibold">
                      <Link href={href} className="bid-link text-ink">
                        {bid.title}
                      </Link>
                    </h2>
                    <p className="mt-0.5 truncate text-sm text-ink-2">{bid.buyerName ?? "Buyer not read yet"}</p>
                  </div>
                  <p className="text-sm">
                    {bid.submissionDeadline && left ? (
                      left.past ? (
                        <span className="text-ink-2">Closed {formatDeadline(bid.submissionDeadline, false)}</span>
                      ) : (
                        <>
                          <span className="font-medium">{formatDeadline(bid.submissionDeadline, false)}</span>
                          <span className={cn("ml-2 text-13", left.urgent ? "font-semibold text-accent-ink" : "text-ink-2")}>{left.label}</span>
                        </>
                      )
                    ) : (
                      <span className="text-ink-2">{bid.status === "ready" ? "Not read from the pack" : "—"}</span>
                    )}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className={bid.status === "failed" ? "font-medium text-danger" : undefined}>{stageOf(bid)}</span>
                    {bid.accessSource === "credit" ? <span className="bid-tag">Bid Pass</span> : null}
                    {bid.accessLevel === "brief" && bid.status === "ready" ? <span className="bid-tag">Check only</span> : null}
                  </p>
                  <p className="text-sm">{verdict ? <span className={cn("bid-pill", VERDICT_PILL[verdict])}>{VERDICT_LABELS[verdict]}</span> : <span className="text-ink-2">No verdict yet</span>}</p>
                  <p className="text-sm text-ink-2">{lastActivity(bid.updatedAt, now)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-5 text-sm text-ink-2">
        A bid starts as a cited bid check. Drafts and marking are added as you work through it.{" "}
        <Link href={showArchived ? "/app/bids" : "/app/bids?archived=1"} className="bid-link text-ink">
          {showArchived ? "Hide archived bids" : "Show archived bids"}
        </Link>
      </p>
      <footer className="mt-10 rounded-card bg-paper-deep px-5 py-4 text-13 text-ink-2">
        <strong className="font-semibold text-ink">Where your files are kept.</strong> Your tender packs and company documents are stored in the EU (Frankfurt) and encrypted in transit and at rest. Only people in your workspace
        can open them. They are never used to train AI models.
      </footer>
    </div>
  );
}
