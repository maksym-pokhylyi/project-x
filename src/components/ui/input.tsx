import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Shared look of text-like controls (input, textarea, select triggers):
 * 4 px radius, 1 px boundary at ≥3:1 (line-control), white surface, 40 px tall.
 * 16 px text on phones (prevents iOS zoom), 14 px from md.
 */
export const controlClasses =
  "w-full min-w-0 rounded-control border border-line-control bg-surface px-3 text-base text-ink transition-[border-color,background-color] duration-150 ease-out placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-focus disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-surface-sunken disabled:text-ink-2 aria-invalid:border-danger aria-invalid:hover:border-danger read-only:bg-surface-sunken md:text-sm"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        controlClasses,
        "h-10 file:mr-3 file:h-full file:border-0 file:border-r file:border-line file:bg-transparent file:pr-3 file:text-sm file:font-medium file:text-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input }
