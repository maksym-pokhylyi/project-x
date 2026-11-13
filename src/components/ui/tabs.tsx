"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { tabListClasses, tabTriggerClasses } from "./tab-classes"

/*
 * Tabs: the underline style of the supplier page and the bid brief. Labels are ink, 15 px
 * medium, 28–32 px apart on a hairline; the current tab carries a 2 px ink rule. Counts are
 * small mono figures. The list scrolls sideways on narrow screens instead of wrapping.
 * Arrow keys move between tabs (Radix).
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-6", className)} {...props} />
}

// The class recipes live in ./tab-classes (no "use client"): import them from there. They are
// not re-exported here, because a non-component export of a client module cannot be used by
// a server component, and only `pnpm build` would say so.

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
