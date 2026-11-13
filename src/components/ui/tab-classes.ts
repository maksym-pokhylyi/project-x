/*
 * Tab look as plain class strings. This module has no "use client" on purpose: server
 * components (and the navigation recipes in nav-link-variants.ts) import it directly.
 */

/**
 * Shared classes so link-based navigation (settings, a bid's sections) looks identical to Tabs.
 * The current tab must be obvious at a glance: ink, semibold and a 2 px ink underline; the others are
 * muted and turn ink on hover.
 */
export const tabListClasses = "flex gap-x-7 overflow-x-auto border-b border-line md:gap-x-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
export const tabTriggerClasses =
  "relative -mb-px inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 border-transparent text-15 font-medium whitespace-nowrap text-ink-2 -outline-offset-2 transition-colors duration-150 hover:text-ink disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-ink data-[state=active]:font-semibold data-[state=active]:text-ink aria-[current=page]:border-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink md:min-h-12 [&_svg]:size-4 [&_svg]:shrink-0"
