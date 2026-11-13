import * as React from "react"
import { cn } from "@/lib/utils"
import { Dot } from "./dot"

/*
 * Deadline marker, the same on every screen (Foundations, rule 1: "Amber marks, amber ink
 * writes"): an amber dot, the date in amber ink semibold, and a small amber-tint chip with
 * the time left ("14 days left"). Amber itself (#B4690E) is only the dot; the words are
 * amber ink (#925207), which passes AA on paper, on white and on the tint.
 *
 *   <DeadlineMarker left="14 days left">Closes 27 Nov 2026</DeadlineMarker>
 *   <DeadlineMarker size="lg" left={timeLeft(deadline)}>27 Nov 2026, 12:00 noon</DeadlineMarker>
 *   <DeadlineMarker closed>Closed 3 Nov 2026</DeadlineMarker>
 *
 * Always include the absolute date in the text: the chip alone means nothing in print.
 * Figures are proportional here; inside a table they line up (tables set tabular figures).
 * By default date and chip sit on one line and wrap together; `stacked` puts the chip under
 * the date, right-aligned (the end of a table row).
 */
function DeadlineMarker({
  children,
  left,
  size = "md",
  closed = false,
  stacked = false,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  /** The date as words: "Closes 27 Nov 2026". */
  children: React.ReactNode
  /** Time left: "14 days left". Leave out when the deadline has passed. */
  left?: React.ReactNode
  /** sm 13 px (rows in a card), md 14 px (lists, e-mail), lg 15 px (key dates). */
  size?: "sm" | "md" | "lg"
  /** A deadline that has passed: grey dot, muted words. */
  closed?: boolean
  /** Chip under the date, both aligned to the end. */
  stacked?: boolean
}) {
  return (
    <span
      data-slot="deadline-marker"
      data-closed={closed ? "" : undefined}
      className={cn(
        "inline-flex font-semibold",
        stacked ? "flex-col items-end gap-1" : "flex-wrap items-center gap-x-2 gap-y-1",
        size === "sm" && "text-13 leading-[1.5]",
        size === "md" && "text-sm leading-[1.5]",
        size === "lg" && "text-15 leading-[1.5]",
        closed ? "text-ink-2" : "text-accent-ink",
        className
      )}
      {...props}
    >
      <span className={cn("inline-flex items-center whitespace-nowrap", size === "sm" ? "gap-1.5" : "gap-[0.4375rem]")}>
        <Dot size={size === "sm" ? "sm" : "md"} tone={closed ? "muted" : "accent"} />
        {children}
      </span>
      {left ? <span className="rounded-chip bg-accent-tint px-1.5 py-px text-xs leading-[1.5] whitespace-nowrap">{left}</span> : null}
    </span>
  )
}

/** "14 days left", "1 day left", "Closes today"; null once the deadline has passed. */
function timeLeft(deadline: Date, now: Date = new Date()): string | null {
  const ms = deadline.getTime() - now.getTime()
  if (ms < 0) return null
  const days = Math.floor(ms / 86_400_000)
  if (days === 0) return "Closes today"
  return days === 1 ? "1 day left" : `${days} days left`
}

export { DeadlineMarker, timeLeft }
