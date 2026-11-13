import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Card: white surface, hairline edge, 10 px radius, no shadow. Borders do the work — pass
 * `raised` only when a card must sit above its neighbours.
 */
function Card({ className, raised = false, ...props }: React.ComponentProps<"div"> & { raised?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn("flex flex-col gap-5 rounded-card border border-line bg-surface py-6 text-ink", raised && "shadow-raised", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-5",
        className
      )}
      {...props}
    />
  )
}

/**
 * Heading of a card: display serif, 20/26, 600 ("Is this your company?"). For a utility card
 * (a file list, a filter panel) add `font-sans text-base`.
 */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("font-display text-xl font-semibold text-ink", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-sm text-ink-2", className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center gap-3 px-6 [.border-t]:pt-5", className)} {...props} />
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
