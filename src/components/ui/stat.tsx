import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Stat row: a few figures side by side, each a serif numeral over a muted label, divided
 * by hairlines ("14 public contracts won since 2021 | £6.4m total awarded value | 9 public
 * buyers"). One component for the supplier summary, the claim card and the sample page on
 * the landing page.
 *
 *   <StatRow frame="rules">                    a hairline above and below, inside a card
 *     <Stat value="14" label="public contracts won since 2021" />
 *     <Stat value="£6.4m" label="total awarded value" />
 *     <Stat value="9" label="public buyers" />
 *   </StatRow>
 *
 *   frame   card    a white card with a hairline edge (supplier and buyer summaries):
 *                   two tiles per row on phones, then as many as fit (220 px each at least),
 *                   or exactly `columns` per row from 1024 px (8 figures read best as 4 + 4)
 *           rules   one row between two hairlines, flush with the text around it
 *           aside   `rules` on phones; from 768 px a frameless row that sits beside a title,
 *                   every tile led by a hairline (the claim card)
 *
 *   size    sm      24 → 28 px numerals, 12 px labels (a miniature: the landing sample)
 *           md      24 → 28 px numerals, 12 → 13 px labels
 *           lg      28 → 34 px numerals, 12 → 13 px labels (the supplier summary)
 *
 * Spacing is part of the component, never of the call site: a tile keeps 16 px or more
 * between its text and a divider on BOTH sides (in a flush row the first tile has none on
 * its outer edge and the last none on its right), labels wrap and are never clipped, and
 * numerals are lining and tabular. Markup is a <dl>: label = <dt>, figure = <dd>; an
 * optional `hint` is a second, smaller <dd> under the label ("published since Mar 2021").
 *
 * No context and no client code: the row says its frame and size in data attributes and
 * the tiles read them through the `group/stats` selector, so both work in server components.
 * (A group-data rule outweighs a plain utility, so the per-frame values override the base
 * ones without relying on the order of the stylesheet.)
 */
type Frame = "card" | "rules" | "aside"
type Size = "sm" | "md" | "lg"

const rowClasses: Record<Frame, string> = {
  // Tiles draw a hairline at their right and bottom; the frame clips the outer ones, so any
  // wrap is right and a short last row still reads as a table.
  card: "-mr-px -mb-px grid grid-cols-2",
  rules: "grid auto-cols-fr grid-flow-col border-y border-line",
  aside: "grid auto-cols-fr grid-flow-col border-y border-line md:flex md:border-y-0",
}

const tile = cn(
  "flex min-w-0 flex-col gap-0.5 border-line",
  // card: padded on every side, hairline at the right and bottom (the frame clips the outer ones)
  "group-data-[frame=card]/stats:border-r group-data-[frame=card]/stats:border-b group-data-[frame=card]/stats:px-4 group-data-[frame=card]/stats:py-3.5 sm:group-data-[frame=card]/stats:px-6 sm:group-data-[frame=card]/stats:py-4.5",
  // flush rows (rules, aside): 16 px on both sides of a divider; nothing at the row's two ends
  "group-data-[flush]/stats:border-l group-data-[flush]/stats:px-4 group-data-[flush]/stats:py-2.5 group-data-[flush]/stats:first:border-l-0 group-data-[flush]/stats:first:pl-0 group-data-[flush]/stats:last:pr-0",
  "sm:group-data-[frame=rules]/stats:py-3",
  // aside from 768 px: beside a title, every tile led by a hairline, 28 px each side
  "md:group-data-[frame=aside]/stats:px-7 md:group-data-[frame=aside]/stats:py-0 md:group-data-[frame=aside]/stats:first:border-l md:group-data-[frame=aside]/stats:first:pl-7 md:group-data-[frame=aside]/stats:last:pr-0",
)

const numeral = cn(
  "type-figure text-2xl leading-[1.15] tracking-normal text-ink tabular-nums sm:text-3xl sm:leading-[1.15] sm:tracking-normal",
  "group-data-[size=lg]/stats:text-3xl group-data-[size=lg]/stats:leading-[1.15] group-data-[size=lg]/stats:tracking-[-0.01em] sm:group-data-[size=lg]/stats:text-34 sm:group-data-[size=lg]/stats:leading-[1.15] sm:group-data-[size=lg]/stats:tracking-[-0.01em]",
)

const labelText =
  "text-xs leading-[1.5] text-balance text-ink-2 sm:group-data-[size=lg]/stats:text-13 sm:group-data-[size=lg]/stats:leading-[1.5] sm:group-data-[size=md]/stats:text-13 sm:group-data-[size=md]/stats:leading-[1.5]"

const cardColumns = {
  auto: "sm:grid-cols-[repeat(auto-fit,minmax(min(13.75rem,100%),1fr))]",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
} as const

function StatRow({
  frame = "rules",
  size = "md",
  columns = "auto",
  className,
  ...props
}: React.ComponentProps<"dl"> & {
  frame?: Frame
  size?: Size
  /** `card` only: tiles per row from 1024 px (two per row below that). Default: as many as fit. */
  columns?: keyof typeof cardColumns
}) {
  const row = (
    <dl
      data-slot="stat-row"
      data-frame={frame}
      data-size={size}
      data-flush={frame === "card" ? undefined : ""}
      className={cn("group/stats", rowClasses[frame], frame === "card" ? cardColumns[columns] : className)}
      {...props}
    />
  )
  if (frame !== "card") return row
  return <div className={cn("overflow-hidden rounded-card border border-line bg-surface", className)}>{row}</div>
}

function Stat({
  value,
  label,
  hint,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  /** The figure, already formatted: "14", "£6.4m". Use "—", never 0, for a value that is not known. */
  value: React.ReactNode
  /** What it counts, in lower case: "public buyers". It wraps when the tile is narrow. */
  label: React.ReactNode
  /** One more muted line under the label: where the figure comes from, or its period. */
  hint?: React.ReactNode
}) {
  // The term comes first in the markup; the figure is shown above it.
  return (
    <div data-slot="stat" className={cn(tile, className)} {...props}>
      <dt className={cn("order-2", labelText)}>{label}</dt>
      <dd className={cn("order-1", numeral)}>{value}</dd>
      {hint ? <dd className="order-3 text-xs leading-[1.5] text-ink-2">{hint}</dd> : null}
    </div>
  )
}

export { Stat, StatRow }
