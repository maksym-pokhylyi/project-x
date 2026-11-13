"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Tooltip: a short label for an icon-only control or an exact figure behind a rounded one
 * ("£102k" → "£101,950"). Shows on hover and on keyboard focus. Never put essential
 * information or interactive content in a tooltip — use a Popover for that.
 */
function TooltipProvider({ delayDuration = 300, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({ className, sideOffset = 6, children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          "z-50 w-fit max-w-64 origin-(--radix-tooltip-content-transform-origin) rounded-chip bg-ink px-2 py-1 text-xs leading-4 font-medium text-pretty text-paper duration-100 animate-in fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/**
 * A word or figure in running text that explains itself on hover and on keyboard focus:
 * "£102k" → "£101,950 as published". A dotted underline says there is more. It is a button
 * (so it can take focus) set inside the line, exempt from the control scale by design.
 */
function TooltipText({ tip, className, children, ...props }: Omit<React.ComponentProps<"button">, "type"> & { tip: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-inline-control=""
          className={cn("rounded-sm font-medium text-ink underline decoration-ink-2 decoration-dotted underline-offset-4", className)}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipText }
