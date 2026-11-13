import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "./badge"

/** The padlock of the artboards (16 px, 1.6 px stroke, muted). */
function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn("size-4 shrink-0 fill-none stroke-ink-2 stroke-[1.6] [stroke-linecap:round]", className)}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  )
}

/*
 * Locked rows: what a higher plan would show, listed honestly under an upgrade band, as
 * "Matches shown with Radar Pro" on the Radar artboard. Each row gives only what is fair to
 * give away (a neutral title such as "Match 11", a region, the closing date) and names the
 * plan that opens it. Rows are not links and nothing is blurred: there is no content
 * underneath to tease.
 *
 *   <LockedList aria-label="Matches shown with Radar Pro">
 *     <LockedRow title="Match 11" plan="Radar Pro" meta={<Badge variant="secondary">West Yorkshire</Badge>}
 *                deadline={<DeadlineMarker size="sm">Closes 19 Jan 2027</DeadlineMarker>} />
 *   </LockedList>
 *
 * Where the list is 800 px wide or more a row is one line: padlock, title, meta, deadline,
 * plan. Narrower (phones, a side column): title and plan on the first line, deadline and
 * meta on the second. The switch follows the list's own width, not the window's.
 */
function LockedList({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="locked-list" className={cn("@container flex flex-col divide-y divide-line rounded-card border border-line bg-surface", className)} {...props} />
}

function LockedRow({
  title,
  plan,
  meta,
  deadline,
  className,
  ...props
}: Omit<React.ComponentProps<"li">, "title" | "children"> & {
  /** A neutral name for what is locked: "Match 11". Never the real title. */
  title: React.ReactNode
  /** The plan that shows it: "Radar Pro". */
  plan: string
  /** One quiet fact that is fair to show: a region chip. */
  meta?: React.ReactNode
  /** A <DeadlineMarker size="sm">. */
  deadline?: React.ReactNode
}) {
  return (
    <li data-slot="locked-row" className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3.5 @[50rem]:flex @[50rem]:gap-x-6 @[50rem]:px-6", className)} {...props}>
      <span className="flex min-w-0 items-center gap-2 text-15 leading-[1.5] font-semibold text-ink-2 @[50rem]:flex-[1_1_13rem] @[50rem]:gap-0">
        <span className="flex @[50rem]:w-12">
          <LockIcon />
        </span>
        <span className="min-w-0 truncate">{title}</span>
      </span>
      <span className="justify-self-end @[50rem]:order-last @[50rem]:flex @[50rem]:flex-[0_0_10rem] @[50rem]:justify-end">
        <Badge variant="secondary" className="text-ink-2">
          <span className="sr-only">Shown with </span>
          {plan}
        </Badge>
      </span>
      {deadline || meta ? (
        <span className="col-span-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 @[50rem]:contents">
          {deadline ? <span className="@[50rem]:order-3 @[50rem]:flex @[50rem]:flex-[0_0_11.25rem]">{deadline}</span> : null}
          {meta ? <span className="@[50rem]:order-2 @[50rem]:flex @[50rem]:flex-[0_0_10.625rem]">{meta}</span> : null}
        </span>
      ) : null}
    </li>
  )
}

export { LockedList, LockedRow, LockIcon }
