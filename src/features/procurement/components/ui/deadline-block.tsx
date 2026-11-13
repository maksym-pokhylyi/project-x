import type { ReactNode } from "react";
import { DeadlineMarker } from "@/components/ui/deadline-marker";
import { cn } from "@/lib/utils";

/*
 * A deadline as a small block, for the "Closes" column of a row and the head of a tender
 * page — the stacked form of <DeadlineMarker>:
 *
 *   Closes                       label, 12 px muted (13 px in the large size)
 *   ● 27 Nov 2026                the date beside the amber dot
 *   12:00 noon  [14 days left]   the time, then the time left
 *
 * The date line IS a <DeadlineMarker>, so the dot, the colours and the closed state are
 * decided in one place and the two forms can never drift apart.
 *
 *   md   17 px semibold — a column of a list row
 *   lg   28 px serif    — the one key date of a page
 *
 * Candidate for src/components/ui (beside deadline-marker.tsx).
 */
export function DeadlineBlock({
  label = "Closes",
  date,
  dateTime,
  time,
  left,
  closed = false,
  size = "md",
  className,
  ...props
}: {
  label?: ReactNode;
  /** The absolute date as words: "27 Nov 2026". */
  date: ReactNode;
  /** ISO date-time for the <time> element. */
  dateTime?: string;
  /** "12:00 noon". */
  time?: ReactNode;
  /** "14 days left". Leave out once the deadline has passed. */
  left?: ReactNode;
  closed?: boolean;
  size?: "md" | "lg";
  className?: string;
  "data-testid"?: string;
  "data-state"?: string;
  "data-days"?: number;
}) {
  return (
    <div data-slot="deadline-block" className={cn("flex flex-col gap-0.5", className)} {...props}>
      <span className={cn("text-ink-2", size === "lg" ? "text-13" : "text-xs")}>{label}</span>
      <DeadlineMarker
        closed={closed}
        className={cn(size === "lg" ? "type-figure text-3xl [&>span]:gap-2.5" : "text-17 leading-6 font-semibold")}
      >
        {dateTime ? <time dateTime={dateTime}>{date}</time> : date}
      </DeadlineMarker>
      {time || left ? (
        <span className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-2", size === "lg" ? "text-sm" : "text-13")}>
          {time}
          {left ? <TimeLeft>{left}</TimeLeft> : null}
        </span>
      ) : null}
    </div>
  );
}

/** The amber-tint pill of <DeadlineMarker>, for a line that is not itself a marker ("12:00 noon [14 days left]"). */
export function TimeLeft({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span data-slot="time-left" className={cn("rounded-chip bg-accent-tint px-1.5 py-px text-xs leading-[1.125rem] font-semibold whitespace-nowrap text-ink", className)}>
      {children}
    </span>
  );
}
