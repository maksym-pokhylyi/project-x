"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navHref, primaryNav } from "./site-nav";

/**
 * The links of the public header. The page you are on carries a 2 px ink rule under its
 * label, as "Pricing" does on the pricing artboard (and aria-current for screen readers).
 * A small client island: the header around it stays static.
 */
export function SiteNavLinks({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <>
      {primaryNav.map((item) => {
        const current = item.href === pathname;
        return (
          <Link
            key={item.href}
            href={navHref(item.href, pathname)}
            aria-current={current ? "page" : undefined}
            /* A transparent rule above balances the one below, so the label does not move. */
            className={cn(className, current && "rounded-none border-y-2 border-t-transparent border-b-ink")}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
