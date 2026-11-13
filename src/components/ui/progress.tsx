"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

const tones = {
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-accent",
  danger: "bg-danger",
} as const

/**
 * Progress bar (usage against a limit, word count, weighting).
 * `tone` carries meaning alongside the number next to it — never on its own.
 */
function Progress({
  className,
  value,
  tone = "brand",
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { tone?: keyof typeof tones }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      data-tone={tone}
      value={value}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-line", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("h-full w-full flex-1 rounded-full transition-transform duration-200 ease-out", tones[tone])}
        style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value || 0))}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
