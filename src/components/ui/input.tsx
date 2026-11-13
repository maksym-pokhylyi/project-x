import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Shared look of text-like controls (input, textarea, select triggers), as in the artboards:
 * 6 px radius, a 1 px line-strong edge (at least 3:1), white surface, 44 px tall, 16 px text
 * (which also stops iOS zooming in on focus).
 */
export const controlClasses =
  "w-full min-w-0 rounded-control border border-line-strong bg-surface px-3.5 text-base text-ink transition-[border-color,background-color] duration-150 ease-out placeholder:text-ink-2 hover:border-ink focus-visible:border-brand disabled:cursor-not-allowed disabled:border-line disabled:bg-paper-deep disabled:text-ink-2 aria-invalid:border-danger aria-invalid:hover:border-danger [&[readonly]]:bg-paper-deep"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        controlClasses,
        "h-11 file:mr-3 file:h-full file:border-0 file:border-r file:border-line file:bg-transparent file:pr-3 file:text-sm file:font-medium file:text-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input }
