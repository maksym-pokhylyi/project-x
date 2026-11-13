import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Toggle button: a button that is on or off. It always carries `aria-pressed`, so assistive
 * technology announces the state; the look never relies on colour alone.
 *
 *   variant="check"   a small labelled tick — "I have checked this" / "Confirmed by you":
 *                     dashed and muted while off, solid brand tint while on.
 *   variant="marker"  a numbered source marker inside or beside running text ("1", "E2"):
 *                     brand tint while off, solid brand while on; `tone="danger"` for a
 *                     marker that points at nothing (an unknown source).
 *
 * For a row of mutually exclusive choices use FilterChip; for an action use Button.
 */
const base =
  "inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55"

const variants = {
  check: (pressed: boolean) =>
    cn(
      "gap-1 rounded-chip border px-1.5 py-0.5 text-xs font-medium",
      pressed ? "border-brand/30 bg-brand-tint text-brand" : "border-dashed border-line-strong text-ink-2 hover:border-solid hover:text-ink"
    ),
  marker: (pressed: boolean, tone: "brand" | "danger") =>
    cn(
      "type-ref min-w-5 rounded-chip px-[0.3125rem] py-0.5 leading-none font-medium",
      tone === "danger" ? "bg-danger-tint text-danger" : pressed ? "bg-brand text-white" : "bg-brand-tint text-brand hover:bg-brand hover:text-white"
    ),
} as const

type ToggleButtonProps = Omit<React.ComponentProps<"button">, "type"> & {
  pressed: boolean
  variant?: keyof typeof variants
  /** Only for `variant="marker"`. */
  tone?: "brand" | "danger"
}

function ToggleButton({ pressed, variant = "check", tone = "brand", className, ...props }: ToggleButtonProps) {
  return (
    <button
      type="button"
      data-slot="toggle-button"
      data-variant={variant}
      aria-pressed={pressed}
      className={cn(base, variant === "marker" ? variants.marker(pressed, tone) : variants.check(pressed), className)}
      {...props}
    />
  )
}

export { ToggleButton }
export type { ToggleButtonProps }
