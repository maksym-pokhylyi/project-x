"use client"

import * as React from "react"
import { CheckIcon, MinusIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Checkbox: 20 px box with a 40 px hit area, 4 px radius, boundary at ≥3:1.
 * Always pair with a <Label htmlFor> (or wrap both in a <label>) so the text is clickable too.
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer hit-40 grid size-5 shrink-0 cursor-pointer place-items-center rounded-chip border border-line-strong bg-surface text-white transition-colors duration-150 hover:border-ink-2 disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-paper-deep aria-invalid:border-danger data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand disabled:data-[state=checked]:border-line-strong disabled:data-[state=checked]:bg-line-strong",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="grid place-items-center text-current">
        {props.checked === "indeterminate" ? <MinusIcon className="size-3.5" strokeWidth={3} /> : <CheckIcon className="size-3.5" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
