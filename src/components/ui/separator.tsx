"use client"

import * as React from "react"
import { Separator as SeparatorPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

/** Hairline rule. `strong` for dividers that must read (line-strong). */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  strong = false,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root> & { strong?: boolean }) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        strong ? "bg-line-strong" : "bg-line",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
