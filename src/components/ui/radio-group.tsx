"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

/* Radio group: 20 px circles with a 40 px hit area. Arrow keys move the selection (Radix). */
function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-3", className)} {...props} />
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "hit-40 grid aspect-square size-5 shrink-0 cursor-pointer place-items-center rounded-full border border-line-strong bg-surface transition-colors duration-150 hover:border-ink-2 disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-paper-deep aria-invalid:border-danger data-[state=checked]:border-brand",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator data-slot="radio-group-indicator" className="size-2.5 rounded-full bg-brand" />
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
