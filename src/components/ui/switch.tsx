"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Switch: for settings that take effect immediately (e.g. "Daily alerts"). For a choice that
 * is submitted with a form, use a Checkbox. Label it; the state must also be readable in words
 * nearby when it matters ("On" / "Off").
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer hit-40 inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-line-control bg-surface transition-colors duration-150 hover:border-ink-3 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-brand data-[state=checked]:bg-brand",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 translate-x-[3px] rounded-full bg-line-control transition-transform duration-150 ease-out data-[state=checked]:translate-x-[19px] data-[state=checked]:bg-white"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
