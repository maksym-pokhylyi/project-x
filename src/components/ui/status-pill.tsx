import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Status pill of a requirement, as in the bid brief artboard: 13 px semibold on a tint, 4 px
 * radius, with a 12 px sign so that the state never rests on colour alone.
 *
 *   gap      "Gap"                 danger on danger-tint, exclamation mark
 *   confirm  "For you to confirm"  info on info-tint, question mark
 *   met      "Met"                 brand green on success-tint, tick (there is no separate
 *                                  success colour: "met" is brand green with a tick)
 *   unknown  "Not checked"         muted on paper-deep, dash
 *
 * The default label can be replaced with children ("Gap: no evidence found").
 */
const statuses = {
  gap: {
    label: "Gap",
    className: "bg-danger-tint text-danger",
    icon: <path d="M6 2.2v4.6M6 9.4v.4" strokeWidth="1.8" />,
  },
  confirm: {
    label: "For you to confirm",
    className: "bg-info-tint text-info",
    icon: <path d="M4 4.4a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.5M6 9.6v.3" strokeWidth="1.6" />,
  },
  met: {
    label: "Met",
    className: "bg-success-tint text-brand",
    icon: <path d="M2 6.5l2.6 2.6L10 3.5" strokeWidth="1.8" />,
  },
  unknown: {
    label: "Not checked",
    className: "bg-paper-deep text-ink-2",
    icon: <path d="M3 6h6" strokeWidth="1.8" />,
  },
} as const

export type RequirementStatus = keyof typeof statuses

function StatusPill({
  status,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { status: RequirementStatus; children?: React.ReactNode }) {
  const config = statuses[status]
  return (
    <span
      data-slot="status-pill"
      data-status={status}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-chip px-2 py-[0.1875rem] text-13 leading-[1.125rem] font-semibold whitespace-nowrap",
        config.className,
        className
      )}
      {...props}
    >
      <svg viewBox="0 0 12 12" aria-hidden className="size-3 shrink-0 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round]">
        {config.icon}
      </svg>
      {children ?? config.label}
    </span>
  )
}

export { StatusPill }
