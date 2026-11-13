import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Deadline marker, the same on every screen: an amber dot, the date in ink, and a small
 * amber-tint pill with the time left ("14 days left"). Amber is only the marker; the words
 * are ink, so the date is readable at any size (amber text fails contrast when small).
 *
 *   <DeadlineMarker left="14 days left">Closes 27 Nov 2026</DeadlineMarker>
 *   <DeadlineMarker size="lg" left={timeLeft(deadline)}>27 Nov 2026, 12:00 noon</DeadlineMarker>
 *   <DeadlineMarker closed>Closed 3 Nov 2026</DeadlineMarker>
 *
 * Always include the absolute date in the text: the pill alone means nothing in print.
 */
function DeadlineMarker({
  children,
  left,
  size = "md",
  closed = false,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  /** The date as words: "Closes 27 Nov 2026". */
  children: React.ReactNode
  /** Time left: "14 days left". Leave out when the deadline has passed. */
  left?: React.ReactNode
  /** sm 13 px (rows in a card), md 14 px (toolbars), lg 15 px semibold (key dates). */
  size?: "sm" | "md" | "lg"
  /** A deadline that has passed: grey dot, muted words. */
  closed?: boolean
}) {
  return (
    <span
      data-slot="deadline-marker"
      data-closed={closed ? "" : undefined}
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums",
        size === "sm" && "text-13 font-medium",
        size === "md" && "text-sm font-medium",
        size === "lg" && "text-15 font-semibold",
        closed ? "text-ink-2" : "text-ink",
        className
      )}
      {...props}
    >
      <span className={cn("inline-flex items-center whitespace-nowrap", size === "sm" ? "gap-1.5" : "gap-2")}>
        <span aria-hidden className={cn("shrink-0 rounded-full", size === "sm" ? "size-2" : "size-[0.5625rem]", closed ? "bg-line-strong" : "bg-accent")} />
        {children}
      </span>
      {left ? <span className="rounded-chip bg-accent-tint px-1.5 py-px text-xs leading-[1.125rem] font-semibold whitespace-nowrap text-ink">{left}</span> : null}
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
