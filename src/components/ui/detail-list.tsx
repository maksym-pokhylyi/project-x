import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Facts as "term — value" lines divided by hairlines, as on the checkout confirmation
 * ("Plan · Bid Desk", "First payment · £149 on 27 Nov 2026"): the term is small and muted
 * and sits in a 120 px column from 768 px (above the value on phones); values wrap, long
 * ids break anywhere, figures are tabular.
 *
 *   <DetailList rows={[{ term: "Plan", value: "Bid Desk" }, { term: "Price", value: "£149 a month" }]} />
 *
 *   framed   (default) a white card with a hairline edge; false: flush, inside a card of your own
 *   muted    values in muted ink: what is still being waited for
 *
 * A <dl>; each row is one <dt> with its <dd>.
 */
export type DetailRow = { term: string; value: React.ReactNode }

function DetailList({
  rows,
  framed = true,
  muted = false,
  className,
  ...props
}: Omit<React.ComponentProps<"dl">, "children"> & {
  rows: DetailRow[]
  framed?: boolean
  muted?: boolean
}) {
  return (
    <dl data-slot="detail-list" className={cn("flex flex-col tabular-nums", framed && "rounded-card border border-line bg-surface px-4 py-1 md:px-6 md:py-1.5", className)} {...props}>
      {rows.map((row, index) => (
        <div
          key={row.term}
          className={cn(
            "flex flex-col gap-0.5 py-3 md:flex-row md:flex-wrap md:items-baseline md:gap-x-6 md:py-3.25",
            index > 0 && "border-t border-line",
            !framed && "first:pt-0 last:pb-0",
          )}
        >
          <dt className="text-xs leading-[1.5] text-ink-2 md:flex-[0_0_7.5rem] md:text-sm md:leading-[1.5]">{row.term}</dt>
          <dd className={cn("min-w-0 text-15 leading-[1.5] [overflow-wrap:anywhere] md:flex-[1_1_20rem]", muted ? "text-ink-2" : "text-ink")}>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export { DetailList }
