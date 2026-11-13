"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Tabs: underline style on a hairline. Triggers are 40 px tall; the active tab is ink with a
 * 2 px brand rule. The list scrolls sideways on narrow screens instead of wrapping.
 * Arrow keys move between tabs (Radix).
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />
}

/** Shared classes so link-based navigation (e.g. settings) can look identical to Tabs. */
export const tabListClasses = "flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
export const tabTriggerClasses =
  "relative -mb-px inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-ink-2 -outline-offset-2 transition-colors duration-150 hover:text-ink disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-brand data-[state=active]:text-ink aria-[current=page]:border-brand aria-[current=page]:text-ink [&_svg]:size-4 [&_svg]:shrink-0"

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn(tabListClasses, className)} {...props} />
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger data-slot="tabs-trigger" className={cn(tabTriggerClasses, className)} {...props} />
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 rounded-sm", className)} {...props} />
}

/** Small count next to a tab label, e.g. the number of matches. */
function TabsCount({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="tabs-count" className={cn("rounded-control bg-surface-sunken px-1.5 text-xs leading-5 font-medium text-ink-2 tabular-nums", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsCount }
