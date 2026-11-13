import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/*
 * A row that the current plan does not open: a padlock, what the row is ("Match 11") in
 * muted semibold, the little it may reveal (one chip, one date) and the plan that opens it
 * as a chip at the end. No title, no link — nothing in it can be clicked; the way to open
 * it is the upgrade band above the list. The padlock is decoration: "Locked" is said in words.
 *
 *   <LockedRow as="li" label="Match 11" plan="Radar Pro" chip={<Badge variant="secondary">West Yorkshire</Badge>} detail={<DeadlineMarker>Closes 19 Jan 2027</DeadlineMarker>} />
 *
 * The row lays itself out from its own width (container query):
 *   narrow          two lines — the label and the plan; then the date and the chip
 *   from 1024 px    one line on the columns of the list it follows, so a locked row reads as
 *                   the next row of that list: padlock · label · chip · date · plan.
 *                   `columnsClassName` sets those columns (five tracks; default: the label
 *                   takes the room and the rest are as wide as they are).
 *
 * Candidate for src/components/ui.
 */
export function LockedRow({
  label,
  plan,
  chip,
  detail,
  columnsClassName = "@5xl:grid-cols-[1.5rem_minmax(0,1fr)_auto_auto_auto]",
  as: Tag = "div",
  className,
}: {
  label: ReactNode;
  /** Name of the plan that opens the row. */
  plan: string;
  /** One small fact as a chip (a place). */
  chip?: ReactNode;
  /** One fact in words (a date). */
  detail?: ReactNode;
  columnsClassName?: string;
  as?: "div" | "li";
  className?: string;
}) {
  return (
    <Tag data-slot="locked-row" className={cn("@container", className)}>
      <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3.5 @2xl:px-6 @5xl:gap-x-6", columnsClassName)}>
        <span className="flex min-w-0 items-center gap-2 @5xl:contents">
          <svg viewBox="0 0 16 16" aria-hidden className="size-4 shrink-0 fill-none stroke-ink-2 stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round] @5xl:col-start-1 @5xl:row-start-1">
            <rect x="3" y="7" width="10" height="7" rx="1.5" />
            <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
          </svg>
          <span className="min-w-0 text-15 font-semibold text-ink-2 @5xl:col-start-2 @5xl:row-start-1">
            <span className="sr-only">Locked: </span>
            {label}
          </span>
        </span>
        <Badge variant="secondary" className="justify-self-end text-ink-2 @5xl:col-start-5 @5xl:row-start-1">
          {plan}
        </Badge>
        {chip || detail ? (
          <span className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 @5xl:contents">
            {detail ? <span className="flex min-w-0 @5xl:col-start-4 @5xl:row-start-1">{detail}</span> : null}
            {chip ? <span className="flex min-w-0 @5xl:col-start-3 @5xl:row-start-1">{chip}</span> : null}
          </span>
        ) : null}
      </div>
    </Tag>
  );
}
