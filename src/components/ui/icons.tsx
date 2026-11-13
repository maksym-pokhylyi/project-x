import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * The small signs of the artboards, drawn exactly as the designer drew them: one weight
 * (1.8 px, round caps and joins) on a 16 px grid unless noted. They take the colour of the
 * text around them (stroke = currentColor): set it with a text-* class.
 *
 *   <TickIcon className="text-brand" />            a plan line, "Verified", a met requirement
 *   <ArrowRightIcon />                              inside a primary button, after the label
 *
 * Decorative by default (aria-hidden). When a sign stands alone and carries meaning, pass
 * `label`: it becomes role="img" with that name ("Included", "Not included").
 * For anything not in this file use lucide-react at strokeWidth 1.8.
 */
type IconProps = Omit<React.ComponentProps<"svg">, "children"> & {
  /** Accessible name when the sign stands alone. */
  label?: string
}

function icon(displayName: string, viewBox: string, size: string, body: React.ReactNode, strokeWidth = 1.8) {
  function Icon({ label, className, ...props }: IconProps) {
    return (
      <svg
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
        className={cn("shrink-0", size, className)}
        {...props}
      >
        {body}
      </svg>
    )
  }
  Icon.displayName = displayName
  return Icon
}

/** 16 px tick: plan lines, "included", a met requirement. */
export const TickIcon = icon("TickIcon", "0 0 16 16", "size-4", <path d="M3 8.5l3.2 3.2L13 4.8" />)
/** 12 px tick: inside chips and beside 13 px text ("Verified."). */
export const TickSmallIcon = icon("TickSmallIcon", "0 0 12 12", "size-3", <path d="M2 6.5l2.6 2.6L10 3.5" />)
/** A short dash: "not included" in a table. */
export const DashIcon = icon("DashIcon", "0 0 16 16", "size-4", <path d="M4 8h8" />, 1.6)
/** Arrow after the label of a primary action. */
export const ArrowRightIcon = icon("ArrowRightIcon", "0 0 16 16", "size-4", <path d="M3 8h10M9 4l4 4-4 4" />)
/** Arrow between two stacked pictures ("appears in your check as"). */
export const ArrowDownIcon = icon("ArrowDownIcon", "0 0 16 16", "size-4", <path d="M8 3v10M4 9l4 4 4-4" />)
/** Chevron of a disclosure or a menu button; turn it over with rotate-180. */
export const ChevronDownIcon = icon("ChevronDownIcon", "0 0 16 16", "size-[1.125rem]", <path d="M3.5 6l4.5 4.5L12.5 6" />)
/** Magnifier inside a search field. */
export const SearchIcon = icon(
  "SearchIcon",
  "0 0 16 16",
  "size-4",
  <>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </>,
  1.6,
)
/** "Scroll sideways": a line with an arrowhead at each end. */
export const ScrollSidewaysIcon = icon("ScrollSidewaysIcon", "0 0 16 16", "size-4", <path d="M2.5 8h11M5 5.5L2.5 8 5 10.5M11 5.5L13.5 8 11 10.5" />, 1.6)
/** 20 px circle with an exclamation mark: a gap, a danger notice. */
export const AlertCircleIcon = icon(
  "AlertCircleIcon",
  "0 0 20 20",
  "size-5",
  <>
    <circle cx="10" cy="10" r="8" />
    <path d="M10 5.8v5M10 13.8v.4" />
  </>,
)
/** 20 px circle with an "i": a neutral notice (test mode). */
export const InfoCircleIcon = icon(
  "InfoCircleIcon",
  "0 0 20 20",
  "size-5",
  <>
    <circle cx="10" cy="10" r="8" />
    <path d="M10 9.2v4.6M10 6v.4" />
  </>,
)
/** 22 px payment card: the payment method in Billing. */
export const CardIcon = icon(
  "CardIcon",
  "0 0 24 24",
  "size-[1.375rem]",
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M2.5 9.5h19M6 15h4" />
  </>,
  1.6,
)
