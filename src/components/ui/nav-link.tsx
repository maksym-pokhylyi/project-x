"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { VariantProps } from "class-variance-authority"
import { isCurrentPath, type NavMatch } from "@/lib/nav"
import { cn } from "@/lib/utils"
import { navLinkVariants } from "./nav-link-variants"

/*
 * The ONE way to render a navigation link that can be "where you are now".
 *
 * Rule of the design system: in every navigation — top bars, tabs, section lists, phone
 * menus, public header — the current item must be obvious at a glance and is never marked
 * by a line alone. NavLink works that out from the URL, sets aria-current="page" and
 * applies the shared look, so no navigation styles its own active state:
 *
 *   bar     app and admin top bars     current: ink, semibold, 2 px ink rule on the bar's edge; others muted
 *   tab     link tabs under a title    same look as the Tabs primitive (settings, a bid's sections)
 *   header  public site header         current: semibold with a 2 px ink underline; others stay ink
 *   menu    stacked lists, phone menu  current: semibold with an ink dot at the end of the row
 *   plain   rows with their own layout  NavLink marks the current row (aria-current); the caller styles `aria-[current=page]:…`
 *
 * Do not hand-roll `usePathname()` comparisons in a component: add the link with NavLink
 * and, when a section spans several paths, pass `match`.
 */
type NavLinkProps = Omit<React.ComponentProps<typeof Link>, "href"> &
  VariantProps<typeof navLinkVariants> & {
    href: string
    /** How the URL decides that this link is current. Default: the path or anything below it. */
    match?: NavMatch
    /** Set it yourself when "current" lives outside the path (e.g. tabs driven by a ?tab= parameter). Overrides `match`. */
    current?: boolean
  }

function NavLink({ href, match = "prefix", current: currentOverride, variant = "bar", className, children, ...props }: NavLinkProps) {
  const pathname = usePathname()
  const current = currentOverride ?? isCurrentPath(pathname, href, match)
  return (
    <Link data-slot="nav-link" data-variant={variant} href={href} aria-current={current ? "page" : undefined} className={cn(navLinkVariants({ variant }), className)} {...props}>
      {children}
    </Link>
  )
}

export { NavLink }
export type { NavLinkProps }
