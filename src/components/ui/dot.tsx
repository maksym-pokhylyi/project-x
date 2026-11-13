import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * The small filled disc that goes before a few words to say what kind of thing they are:
 * amber for "there is a date on this" (a deadline, a trial, bids to use by a date), muted
 * once it has passed. Decorative: it is hidden from assistive technology and never the only
 * signal — the words beside it carry the meaning.
 *
 *   <Dot />                 amber, 9 px
 *   <Dot size="sm" />       8 px, in 12–13 px text
 *   <Dot tone="muted" />    a closed deadline
 *
 * In a line of text put it in a flex row with `items-baseline` (it sits on the baseline) or
 * `items-center`.
 */
const tones = {
  accent: "bg-accent",
  muted: "bg-line-strong",
  brand: "bg-brand",
  danger: "bg-danger",
  info: "bg-info",
} as const

function Dot({ tone = "accent", size = "md", className, ...props }: React.ComponentProps<"span"> & { tone?: keyof typeof tones; size?: "sm" | "md" }) {
  return <span aria-hidden data-slot="dot" className={cn("inline-block shrink-0 rounded-full", size === "sm" ? "size-2" : "size-[0.5625rem]", tones[tone], className)} {...props} />
}

export { Dot }
