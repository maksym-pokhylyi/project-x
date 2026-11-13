import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Filter chips, as above the requirements list in the bid brief: a row of toggle buttons,
 * 44 px tall. The chosen one is filled ink; the others are white with a line-strong edge.
 * A count follows the label ("Gaps 2").
 *
 *   <FilterChipGroup aria-label="Filter requirements">
 *     <FilterChip pressed count={23}>All</FilterChip>
 *     <FilterChip count={2}>Gaps</FilterChip>
 *   </FilterChipGroup>
 *
 * Each chip is a button with aria-pressed. For links (filters kept in the URL) pass `asChild`
 * semantics yourself: use `filterChipClasses(pressed)` on an <a aria-current>.
 */
export function filterChipClasses(pressed: boolean) {
  return cn(
    "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-control border px-3.5 text-sm whitespace-nowrap tabular-nums transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50",
    pressed ? "border-ink bg-ink font-semibold text-white" : "border-line-strong bg-surface font-medium text-ink hover:border-ink hover:bg-paper"
  )
}

function FilterChipGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="group" data-slot="filter-chip-group" className={cn("flex flex-wrap gap-2", className)} {...props} />
}

function FilterChip({
  pressed = false,
  count,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { pressed?: boolean; count?: number }) {
  return (
    <button type="button" data-slot="filter-chip" aria-pressed={pressed} className={cn(filterChipClasses(pressed), className)} {...props}>
      {children}
      {count != null ? <span>{count}</span> : null}
    </button>
  )
}

export { FilterChip, FilterChipGroup }
