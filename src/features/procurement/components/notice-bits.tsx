import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DeadlineMarker } from "@/components/ui/deadline-marker";
import { cn } from "@/lib/utils";
import { describeClosing } from "../domain/format";
import { formatMoney, formatMoneyExact } from "../domain/money";
import { noticeBadgeKind, NOTICE_TYPES, type NoticeStage } from "../domain/notice-types";
import type { ReasonChip } from "../domain/reasons";
import { DeadlineBlock } from "@/components/ui/deadline-block";
import { ScrollRow } from "@/components/ui/scroll-row";

/**
 * The small parts every procurement screen is made of — the kind of notice, its reference,
 * money, the reasons of a match, the closing date — each composed from the design system
 * (Badge, DeadlineMarker) and the local library in ./ui. They hold the DOMAIN decisions
 * ("Value not published", "Closes" / "Closed", which chip is the strong one); the looks
 * live in the components they compose.
 *
 * Server-safe and client-safe: no hooks, no server-only imports, so the same parts render
 * on a cached public page and inside the interactive radar list.
 */

// ---------------------------------------------------------------------------
// Kind of notice, reference, source
// ---------------------------------------------------------------------------

export type NoticeKindInput = { stage: string; noticeType: string | null; aboveThreshold: boolean | null; isFramework: boolean; status?: string | null };

const STAGE_LABEL: Record<NoticeStage, string> = {
  planning: "Early notice",
  tender: "Tender notice",
  award: "Award notice",
  contract: "Contract update",
  market: "Dynamic market notice",
};

/** The kind of notice in the buyer's own words: "Tender notice", "Planned procurement notice", "Contract award notice". */
export function noticeLabel(notice: NoticeKindInput): string {
  const kind = noticeBadgeKind({ ...notice, stage: notice.stage as NoticeStage });
  if (kind === "closed") return "Withdrawn";
  const official = notice.noticeType ? NOTICE_TYPES[notice.noticeType]?.officialName : undefined;
  return official ?? STAGE_LABEL[notice.stage as NoticeStage] ?? "Notice";
}

/** Notice type as an info chip (blue labels neutral facts only — never a link, never a status). */
export function NoticeTypeChip({ notice, className }: { notice: NoticeKindInput; className?: string }) {
  return (
    <Badge variant="info" className={className} data-kind={noticeBadgeKind({ ...notice, stage: notice.stage as NoticeStage })}>
      {noticeLabel(notice)}
    </Badge>
  );
}

/**
 * A notice's Find a Tender number in mono ("048213-2026"). With `href` it is the link to
 * the notice itself: the reference is the citation, one click from the source.
 */
export function NoticeRef({ id, href, className }: { id: string; href?: string | null; className?: string }) {
  if (!href) return <span className={cn("type-ref whitespace-nowrap text-ink-2", className)}>{id}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={cn("link-ref hit-40 rounded-sm whitespace-nowrap", className)} data-testid="source-link">
      <span className="sr-only">Notice </span>
      {id}
      <span className="sr-only"> on Find a Tender (opens in a new tab)</span>
    </a>
  );
}

/**
 * Link to the source notice on Find a Tender. ALWAYS rendered next to anything we show
 * about a notice — never behind sign-up, the free-plan cap or a paid plan.
 * `icon` adds the "opens elsewhere" arrow of the tender page.
 */
export function SourceLink({ href, label = "Original notice", icon = false, className }: { href: string; label?: ReactNode; icon?: boolean; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={cn("link inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium", className)} data-testid="source-link">
      <span>
        {label}
        <span className="sr-only"> on Find a Tender (opens in a new tab)</span>
      </span>
      {icon ? (
        <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 shrink-0 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]">
          <path d="M9 3h4v4M13 3L7.5 8.5M11 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2.5" />
        </svg>
      ) : null}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * `£4.2m` / `£780,000` in a row, the exact figure in a table (`exact`); "Value not
 * published" in words instead of zero or a £1 placeholder. The rounded form carries the
 * exact figure for screen readers.
 */
export function Money({
  amount,
  currency = "GBP",
  exact = false,
  className,
  fallback = "Value not published",
}: {
  amount: number | null;
  currency?: string | null;
  exact?: boolean;
  className?: string;
  fallback?: string;
}) {
  // Whole pounds: pence on a contract value are noise in a table and a lie of precision in a median.
  const full = formatMoneyExact(amount === null ? null : Math.round(amount), currency);
  const shown = exact ? full : formatMoney(amount, currency);
  if (!shown) return <span className={cn("font-normal text-ink-2", className)}>{fallback}</span>;
  if (!full || full === shown) return <span className={cn("tabular-nums", className)}>{shown}</span>;
  return (
    <span className={cn("tabular-nums", className)}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{full}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Why a tender matches
// ---------------------------------------------------------------------------

/**
 * The reasons of a match as chips: counted facts only, the strongest on brand tint, then
 * the place of delivery, then "Wider match" where the row is not one of the strong ones.
 * `scroll` lays them on one line that scrolls sideways inside a phone card (`bleed` = the
 * card's padding) and wraps from 672 px of container width.
 */
export function ReasonChips({
  reasons,
  place,
  placeNote,
  wider = false,
  scroll = false,
  className,
}: {
  reasons: ReasonChip[];
  /** "West Yorkshire", "London and South East", "UK-wide". */
  place?: string | null;
  /** Said to screen readers and on hover when the place is the buyer's address, not a delivery place. */
  placeNote?: string;
  wider?: boolean;
  scroll?: boolean;
  className?: string;
}) {
  if (reasons.length === 0 && !place && !wider) return null;
  const items = (
    <>
      {reasons.map((reason) => (
        <li key={reason.kind} className="flex min-w-0">
          <Badge variant={reason.strong ? "brand" : "secondary"}>{reason.label}</Badge>
        </li>
      ))}
      {place ? (
        <li className="flex min-w-0">
          <Badge variant="secondary" title={placeNote}>
            {place}
            {placeNote ? <span className="sr-only"> ({placeNote})</span> : null}
          </Badge>
        </li>
      ) : null}
      {wider ? (
        <li className="flex min-w-0">
          <Badge variant="outline" title="Outside your own line of work or regions: a neighbouring category, a broader code or a keyword.">
            Wider match
          </Badge>
        </li>
      ) : null}
    </>
  );
  if (scroll) {
    return (
      <ScrollRow as="ul" aria-label="Why this matches" bleed="4" wrapFrom="container-md" className={className} data-testid="match-reasons">
        {items}
      </ScrollRow>
    );
  }
  return (
    <ul aria-label="Why this matches" className={cn("flex flex-wrap gap-1.5", className)} data-testid="match-reasons">
      {items}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Closing date
// ---------------------------------------------------------------------------

/**
 * The closing date of a tender, the same on every screen (DESIGN.md §1.3):
 *
 *   line    ● Closes 27 Nov 2026, 12:00  [14 days left]     one line — cards, strips, locked rows
 *   block   Closes / ● 27 Nov 2026 / 12:00 noon [14 days left]   the "Closes" column of a row
 *   figure  the same block with the date as the page's one large date (tender page)
 *
 *   open     amber dot, the date, the time left ("Today", "Tomorrow", "N days left")
 *   closed   grey dot, muted "Closed 3 Nov 2026, 12:00", no pill
 *   unknown  "No deadline published" in words
 *
 * Colour is never the only signal: the words "Closes" / "Closed" and the pill carry it.
 */
export function Closes({
  deadline,
  now,
  form = "line",
  withTime = true,
  withPrefix = true,
  withLeft = true,
  size = "md",
  className,
}: {
  deadline: string | null;
  now: Date;
  form?: "line" | "block" | "figure";
  /** line: "27 Nov 2026, 12:00" (default) or the date alone. */
  withTime?: boolean;
  /** line: start with "Closes" / "Closed" (default); a strip under its own heading shows the bare date. */
  withPrefix?: boolean;
  /** line: the time-left pill (default). A locked row gives the date and no more. */
  withLeft?: boolean;
  /** line: the size of <DeadlineMarker>. */
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const closing = describeClosing(deadline, now);
  const closed = closing.state === "closed";
  const data = { "data-testid": "deadline", "data-state": closing.state, "data-days": closing.days ?? undefined };

  if (closing.state === "unknown") {
    if (form === "line") {
      return (
        <span className={cn("text-sm text-ink-2", className)} {...data}>
          No deadline published
        </span>
      );
    }
    return (
      <div className={cn("flex flex-col gap-0.5", className)} {...data}>
        <span className={cn("text-ink-2", form === "figure" ? "text-13" : "text-xs")}>Closes</span>
        <span className="text-sm text-ink-2">No deadline published</span>
      </div>
    );
  }

  if (form === "line") {
    const prefix = closed ? "Closed" : "Closes";
    return (
      <DeadlineMarker size={size} closed={closed} left={withLeft ? (closing.left ?? undefined) : undefined} className={cn(!closed && "font-semibold", className)} {...data}>
        <span>
          {withPrefix ? `${prefix} ` : <span className="sr-only">{prefix} </span>}
          <time dateTime={closing.iso ?? undefined}>{withTime ? closing.dateTime : closing.date}</time>
        </span>
      </DeadlineMarker>
    );
  }

  return (
    <DeadlineBlock
      label={closed ? "Closed" : "Closes"}
      date={closing.date}
      dateTime={closing.iso ?? undefined}
      time={closing.time}
      left={closing.left ?? undefined}
      closed={closed}
      size={form === "figure" ? "lg" : "md"}
      className={className}
      {...data}
    />
  );
}
