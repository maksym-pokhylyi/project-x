"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Segmented toggle, as "Monthly | Annual" on the pricing artboard: two or more joined
 * buttons on the control scale (44 px; the group's size where one is set); the chosen one
 * is filled ink, the others are white with a line-strong edge. Each segment is a button
 * with aria-pressed inside a labelled group.
 *
 *   <SegmentedToggle
 *     aria-label="Billing period"
 *     value={interval}
 *     onValueChange={setInterval}
 *     options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Annual" }]}
 *   />
 *
 * Use it to switch a view between a few named states. For filters with counts use
 * <FilterChip>; for sections of a page use <Tabs>.
 */
export type SegmentedOption<T extends string> = {
  value: T
  label: React.ReactNode
  /** data-testid of the segment's button. */
  testId?: string
}

function SegmentedToggle<T extends string>({
  value,
  onValueChange,
  options,
  stretch = false,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  value: T
  onValueChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  /** Segments share the full width equally (phones). */
  stretch?: boolean
}) {
  return (
    <div role="group" data-slot="segmented-toggle" className={cn("flex", stretch && "w-full", className)} {...props}>
      {options.map((option) => {
        const pressed = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            data-testid={option.testId}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative -ml-px inline-flex h-(--control-h) min-w-[7.25rem] cursor-pointer items-center justify-center border px-5 text-(length:--control-text) whitespace-nowrap transition-colors duration-150 ease-out first:ml-0 first:rounded-l-control last:rounded-r-control focus-visible:z-20",
              stretch && "flex-1",
              pressed ? "z-10 border-ink bg-ink font-semibold text-white" : "border-line-strong bg-surface font-medium text-ink hover:bg-paper"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedToggle }
