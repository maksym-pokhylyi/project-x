import * as React from "react"
import Link from "next/link"
import type { VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { buttonVariants } from "./button"

/*
 * A link that looks like a button.
 *
 * Rule of the design system: if the control NAVIGATES (it has an href) it is a ButtonLink;
 * if it DOES something on the page it is a Button. Never put button classes on an <a> by
 * hand, and never nest a <button> inside a link. "Upgrade", "See plans", "Start a bid
 * check", "Find your company" are ButtonLinks.
 *
 * It renders an <a>, so it opens in a new tab on demand, is announced as a link and shows
 * the pointer cursor like every other clickable control. Variants and sizes are the
 * Button's own (same heights: a ButtonLink next to a field follows the field's height).
 *
 *   internal href          -> next/link
 *   external / mailto / tel -> plain <a>; `newTab` adds target="_blank" rel="noopener noreferrer"
 *   disabled               -> a <span aria-disabled="true"> with the same look, not focusable
 */
type Href = React.ComponentProps<typeof Link>["href"]

type ButtonLinkProps = Omit<React.ComponentProps<"a">, "href"> &
  VariantProps<typeof buttonVariants> & {
    href: Href
    /** Open in a new tab (external links only do so when asked). */
    newTab?: boolean
    disabled?: boolean
    prefetch?: React.ComponentProps<typeof Link>["prefetch"]
  }

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/)/i

function ButtonLink({ className, variant = "default", size = "default", href, newTab = false, disabled = false, prefetch, children, ...props }: ButtonLinkProps) {
  const classes = cn(buttonVariants({ variant, size }), "cursor-pointer", className)

  if (disabled) {
    return (
      <span data-slot="button-link" data-variant={variant} data-size={size} role="link" aria-disabled="true" className={cn(classes, "pointer-events-none cursor-not-allowed opacity-50")}>
        {children}
      </span>
    )
  }

  const tabProps = newTab ? { target: "_blank", rel: "noopener noreferrer" } : null
  if (typeof href === "string" && EXTERNAL.test(href)) {
    return (
      <a data-slot="button-link" data-variant={variant} data-size={size} href={href} className={classes} {...tabProps} {...props}>
        {children}
      </a>
    )
  }

  return (
    <Link data-slot="button-link" data-variant={variant} data-size={size} href={href} prefetch={prefetch} className={classes} {...tabProps} {...props}>
      {children}
    </Link>
  )
}

export { ButtonLink }
export type { ButtonLinkProps }
