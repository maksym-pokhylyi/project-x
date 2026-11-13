import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "../domain/format";
import type { NoticeCard } from "../queries/shared";
import { DeadlineChip, Money, NoticeBadge, RegionText, SourceLink } from "./primitives";

export type TenderCardItem = NoticeCard & { reason?: string | null; reasonSource?: "rule" | "ai" };

/**
 * TenderCard (DESIGN.md §5): title (two lines at most), buyer, value, region, DeadlineChip,
 * match reason with a small "Why it matches" label, actions. The card is not a link; the
 * title is. The Find a Tender link is always present.
 */
export function TenderCard({
  item,
  href,
  now,
  actions,
  headingLevel = "h3",
  className,
}: {
  item: TenderCardItem;
  /** Where the title leads (public tender page or the in-app detail). */
  href: string;
  now?: Date;
  /** Save / Dismiss / Start a bid. */
  actions?: ReactNode;
  headingLevel?: "h3" | "h4";
  className?: string;
}) {
  const Heading = headingLevel;
  const isPlanning = item.stage === "planning";
  return (
    <article className={cn("rounded-lg border bg-card p-4 shadow-xs", className)} data-testid="tender-card" data-ocid={item.ocid}>
      <div className="flex flex-wrap items-center gap-2">
        <NoticeBadge notice={item} />
        {isPlanning ? (
          <span className="text-xs text-muted-foreground">
            {item.futureNoticeAt ? `Tender expected ${formatDate(item.futureNoticeAt)}` : item.engagementDeadlineAt ? `Engagement until ${formatDate(item.engagementDeadlineAt)}` : `Published ${formatDate(item.publishedAt)}`}
          </span>
        ) : (
          <DeadlineChip deadline={item.deadlineAt} now={now} />
        )}
      </div>
      <Heading className="mt-2 text-base font-semibold leading-snug">
        {/* Padding (cancelled by the negative margin) gives a one-line title a 40 px touch target. */}
        <Link href={href} className="-my-2.5 block py-2.5 underline-offset-4 hover:underline focus-visible:underline">
          <span className="line-clamp-2">{item.title}</span>
        </Link>
      </Heading>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
        {item.buyerName ? (
          item.buyerSlug ? (
            <Link href={`/buyers/${item.buyerSlug}`} className="text-foreground underline-offset-4 hover:underline">
              {item.buyerName}
            </Link>
          ) : (
            <span className="text-foreground">{item.buyerName}</span>
          )
        ) : null}
        <span aria-hidden>·</span>
        <Money amount={item.valueAmount} currency={item.currency} />
        {item.regions.length > 0 ? (
          <>
            <span aria-hidden>·</span>
            <RegionText regions={item.regions} source={item.regionSource} />
          </>
        ) : null}
      </p>
      {item.reason ? (
        <p className="mt-3 border-l-2 border-primary/40 pl-3 text-sm" data-testid="match-reason">
          <span className="block text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">Why it matches</span>
          {item.reason}
          {item.reasonSource === "ai" ? <span className="ml-1 text-xs text-muted-foreground">(AI-assisted)</span> : null}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SourceLink href={item.noticeUrl} />
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </article>
  );
}

/** Compact one-row variant for lists (saved, deadline strip, locked rows). */
export function TenderRow({ item, href, now, trailing, className }: { item: TenderCardItem; href: string; now?: Date; trailing?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between", className)} data-testid="tender-row" data-ocid={item.ocid}>
      <div className="min-w-0">
        <Link href={href} className="-my-2.5 block py-2.5 text-sm font-medium underline-offset-4 hover:underline">
          <span className="line-clamp-2">{item.title}</span>
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {item.buyerName ? <span>{item.buyerName}</span> : null}
          <span aria-hidden>·</span>
          <Money amount={item.valueAmount} currency={item.currency} />
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
        {item.stage === "planning" ? null : <DeadlineChip deadline={item.deadlineAt} now={now} />}
        <SourceLink href={item.noticeUrl} label="Find a Tender" />
        {trailing}
      </div>
    </div>
  );
}
