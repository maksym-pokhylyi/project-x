import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Source mark: the small numbered marker after a sentence in a draft that says "this rests
 * on source 3". A mono figure on brand-tint, set inside the line of text; pressing it opens
 * the passage it rests on (use it as the child of a PopoverTrigger, or give it `onClick`).
 *
 *   <Popover>
 *     <PopoverTrigger asChild>
 *       <SourceMark number={3} label="KPI report Q4 2025-26.pdf, page 3" />
 *     </PopoverTrigger>
 *     <PopoverContent>…the quoted passage and its <ReferenceChip />…</PopoverContent>
 *   </Popover>
 *
 * It is 20 px tall so that it does not push the lines apart; its hit area is extended to
 * 40 px (hit-40). `label` completes the accessible name: "Source 3: KPI report …, page 3".
 * It is an inline control and is exempt from the 44 / 48 / 52 scale by design.
 */
function SourceMark({
  number,
  label,
  className,
  type = "button",
  ...props
}: Omit<React.ComponentProps<"button">, "children" | "aria-label"> & {
  number: number
  /** What the source is, for assistive technology: file and page. */
  label?: string
}) {
  return (
    <button
      type={type}
      data-slot="citation"
      aria-label={label ? `Source ${number}: ${label}` : `Source ${number}`}
      className={cn(
        "hit-40 inline-flex min-w-5 cursor-pointer items-center justify-center rounded-[3px] bg-brand-tint px-1 font-mono text-xs leading-5 font-medium text-brand transition-colors duration-150 hover:bg-brand-mark data-[state=open]:bg-brand data-[state=open]:text-white",
        className
      )}
      {...props}
      /* After the props: a Radix trigger around it sets its own data-slot, and this must survive. */
      data-inline-control=""
    >
      {number}
    </button>
  )
}

export { SourceMark }
