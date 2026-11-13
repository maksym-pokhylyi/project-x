"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Data table (DESIGN.md §5): sticky header on a sunken band, no zebra, row hover brand-tint,
 * numeric columns right-aligned with tabular figures (`numeric` on TableHead / TableCell).
 * Wrap in a bordered card with `<Table framed>` or place inside your own container.
 * To make the header stick, give the container a max height (e.g. className="max-h-[32rem]").
 */
function Table({
  className,
  containerClassName,
  framed = false,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string; framed?: boolean }) {
  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-auto", framed && "rounded-card border border-line bg-surface", containerClassName)}
    >
      <table data-slot="table" className={cn("w-full caption-bottom border-separate border-spacing-0 text-sm", className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("sticky top-0 z-10", className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child>*]:border-b-0", className)} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("bg-surface-sunken font-medium [&_td]:border-t [&_td]:border-b-0 [&_td]:border-line", className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "transition-colors duration-100 [tbody>&]:hover:bg-brand-tint/60 has-aria-expanded:bg-brand-tint/60 data-[state=selected]:bg-brand-tint",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, numeric = false, ...props }: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn(
        "h-10 border-b border-line bg-surface-sunken px-4 text-left align-middle text-13 font-medium whitespace-nowrap text-ink-2 [&:has([role=checkbox])]:pr-0",
        numeric && "text-right",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, numeric = false, ...props }: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "border-b border-line px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0",
        numeric && "text-right tabular-nums whitespace-nowrap",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("mt-3 px-4 pb-3 text-left text-13 text-ink-2", className)} {...props} />
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
