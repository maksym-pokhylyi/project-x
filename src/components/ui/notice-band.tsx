import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Notice band: one line across the full width, directly under the top bar, as the
 * "Test mode" band in the billing artboard. A tint, a 20 px sign and a sentence at 14 px;
 * start the sentence with a short bold lead in a <strong> ("Test mode.", "Payment failed.").
 *
 *   info      info-tint     test mode, neutral notices
 *   warning   accent-tint   payment failed, a limit reached
 *   danger    danger-tint   something is blocked
 *
 * The lead takes the hue of the tone; the rest of the sentence is ink. It states a
 * condition of the whole page, so there is at most one of each kind. For a message inside
 * the page use <Alert>.
 */
const tones = {
  info: { band: "bg-info-tint", lead: "[&_strong:first-child]:text-info", icon: "stroke-info" },
  warning: { band: "bg-accent-tint", lead: "[&_strong:first-child]:text-accent-ink", icon: "stroke-accent" },
  danger: { band: "bg-danger-tint", lead: "[&_strong:first-child]:text-danger", icon: "stroke-danger" },
} as const

function NoticeBand({
  tone = "info",
  className,
  containerClassName = "container-app",
  children,
  ...props
}: React.ComponentProps<"div"> & {
  tone?: keyof typeof tones
  /** The column the band's text lines up with: `container-app` (default) or `container-content`. */
  containerClassName?: string
}) {
  const config = tones[tone]
  return (
    <div data-slot="notice-band" data-tone={tone} className={cn(config.band, className)} {...props}>
      <p className={cn("flex items-start gap-2.5 py-2.5 text-sm leading-[1.3125rem] text-ink", config.lead, containerClassName)}>
        <svg viewBox="0 0 20 20" aria-hidden className={cn("size-5 shrink-0 fill-none stroke-[1.8] [stroke-linecap:round]", config.icon)}>
          <circle cx="10" cy="10" r="8" />
          {tone === "info" ? <path d="M10 9.2v4.6M10 6v.4" /> : <path d="M10 5.8v5M10 13.8v.4" />}
        </svg>
        <span className="min-w-0">{children}</span>
      </p>
    </div>
  )
}

export { NoticeBand }
