"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Tabs: the underline style of the supplier page and the bid brief. Labels are ink, 15 px
 * medium, 28–32 px apart on a hairline; the current tab carries a 2 px ink rule. Counts are
 * small mono figures. The list scrolls sideways on narrow screens instead of wrapping.
 * Arrow keys move between tabs (Radix).
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-6", className)} {...props} />
}

/**
 * Shared classes so link-based navigation (settings, a bid's sections) looks identical to Tabs.
 * The current tab must be obvious at a glance: ink, semibold and a 2 px ink underline; the others are
 * muted and turn ink on hover.
 */
export const tabListClasses = "flex gap-x-7 overflow-x-auto border-b border-line md:gap-x-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
export const tabTriggerClasses =
  "relative -mb-px inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 border-transparent text-15 font-medium whitespace-nowrap text-ink-2 -outline-offset-2 transition-colors duration-150 hover:text-ink disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-ink data-[state=active]:font-semibold data-[state=active]:text-ink aria-[current=page]:border-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink md:min-h-12 [&_svg]:size-4 [&_svg]:shrink-0"

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn(tabListClasses, className)} {...props} />
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger data-slot="tabs-trigger" className={cn(tabTriggerClasses, className)} {...props} />
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 rounded-sm", className)} {...props} />
}

/** Small count next to a tab label, e.g. the number of matches: mono 12, muted. */
function TabsCount({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="tabs-count" className={cn("font-mono text-xs leading-4 font-normal text-ink-2", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsCount }
