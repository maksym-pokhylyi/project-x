import { cva } from "class-variance-authority"
import { tabTriggerClasses } from "./tab-classes"

/*
 * The shared look of navigation links (see nav-link.tsx for the rule). Kept in a module
 * WITHOUT "use client" so server components can use the classes too (e.g. for a client
 * island that must look like its NavLink neighbours).
 */
export const navLinkVariants = cva("-outline-offset-2 transition-colors duration-150 aria-[current=page]:font-semibold aria-[current=page]:text-ink", {
  variants: {
    variant: {
      bar: "inline-flex min-h-14 shrink-0 items-center border-b-2 border-transparent pt-0.5 text-15 font-medium whitespace-nowrap text-ink-2 hover:text-ink aria-[current=page]:border-ink md:min-h-[3.75rem]",
      tab: tabTriggerClasses,
      header: "inline-flex min-h-11 items-center border-b-2 border-transparent text-15 font-medium text-ink hover:text-brand aria-[current=page]:border-ink aria-[current=page]:hover:text-ink",
      menu: "flex min-h-[3.25rem] items-center justify-between gap-3 text-17 font-medium text-ink after:size-2 after:shrink-0 after:rounded-full aria-[current=page]:after:bg-ink",
    },
  },
  defaultVariants: { variant: "bar" },
})
