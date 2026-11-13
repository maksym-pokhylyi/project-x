"use client";

import { usePathname } from "next/navigation";
import { NavLink } from "@/components/ui/nav-link";
import { navLinkVariants } from "@/components/ui/nav-link-variants";
import { HeaderSessionLink } from "./header-session-link";
import { navHref, primaryNav } from "./site-nav";

/**
 * The links of the public header: every one a NavLink, so the page you are on is marked the
 * same way as everywhere else (semibold on a 2 px ink rule, as "Pricing" on the pricing
 * artboard). On /pricing, "Questions" leads to the billing questions of that page.
 * A small client island: the header around it stays static.
 */
export function SiteHeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-8">
      {primaryNav.map((item) => (
        <NavLink key={item.href} href={navHref(item.href, pathname)} variant="header" match="exact">
          {item.label}
        </NavLink>
      ))}
      <HeaderSessionLink className={navLinkVariants({ variant: "header" })} />
    </nav>
  );
}
