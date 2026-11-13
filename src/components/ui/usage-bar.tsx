import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Usage bar, as on the Billing artboard: what is counted on the left, "2 of 3 used" on the
 * right, and an 8 px bar under them — ink on line, never a traffic light. The words carry
 * the number; the bar is decoration (aria-hidden). Put a note under it as children: the
 * rollover line, the people who hold a seat.
 *
 *   <UsageBar label="Full bids" used={2} limit={3} />
 *   <UsageBar label="Seats" used={2} limit={3}>…</UsageBar>
 *   <UsageBar label="Full bids" value="3 a month" />          no count known: words only, no bar
 *
 * `limit={null}` means unlimited: the count is shown without a bar.
 */
function UsageBar({
  label,
  used,
  limit,
  value,
  unit = "used",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode
  /** How many have been used. Leave out (with `limit`) when it is not known: pass `value` instead. */
  used?: number
  /** The allowance; null = unlimited. */
  limit?: number | null
  /** Replaces "2 of 3 used" (and drops the bar unless both numbers are given). */
  value?: React.ReactNode
  /** The word after the numbers: "used", "in use". */
  unit?: string
  children?: React.ReactNode
}) {
  const counted = typeof used === "number" && typeof limit === "number"
  const share = counted && limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0
  const text = value ?? (typeof used === "number" ? (typeof limit === "number" ? `${used} of ${limit} ${unit}` : `${used} ${unit}`) : null)
  return (
    <div data-slot="usage-bar" className={cn("flex flex-col gap-2", className)} {...props}>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-15 leading-[1.5] font-semibold text-ink">{label}</span>
        {text ? <span className="text-sm leading-[1.5] text-ink tabular-nums">{text}</span> : null}
      </p>
      {counted ? (
        <div aria-hidden className="h-2 overflow-hidden rounded-chip bg-line">
          <div className="h-2 rounded-chip bg-ink" style={{ width: `${share}%` }} />
        </div>
      ) : null}
      {children}
    </div>
  )
}

export { UsageBar }
