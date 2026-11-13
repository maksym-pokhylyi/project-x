"use client";

import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button-link";
import { MenuSheet } from "@/components/ui/menu-sheet";
import { NavLink } from "@/components/ui/nav-link";
import { authClient } from "@/lib/auth-client";
import { findCompany, navHref, primaryNav } from "./site-nav";

/**
 * Public navigation below 768 px: the menu sheet (src/components/ui/menu-sheet.tsx) with the
 * site's links and its two calls to action. Every row is 52 px tall; the page you are on is
 * marked by NavLink (semibold, with a dot at the end of the row).
 */
export function MobileNav() {
  const pathname = usePathname();
  const { data } = authClient.useSession();
  const signedIn = Boolean(data?.user);

  return (
    <MenuSheet brand={<Wordmark />} tone="paper" headClassName="container-content pr-2">
      {(close) => (
        <nav aria-label="Main" className="container-content pt-2 pb-6">
          <ul className="divide-y divide-line border-b border-line">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <NavLink href={navHref(item.href, pathname)} variant="menu" match="exact" onClick={close}>
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li>
              {/* The sheet never opens on these pages, so this row is never "where you are". */}
              <NavLink href={signedIn ? "/app" : "/sign-in"} variant="menu" current={false} onClick={close}>
                {signedIn ? "Open your radar" : "Sign in"}
              </NavLink>
            </li>
          </ul>
          <div className="mt-5 grid gap-2.5">
            <ButtonLink href={findCompany.href} size="lg" onClick={close}>
              {findCompany.label}
            </ButtonLink>
            <ButtonLink href="/free-bid-check" size="lg" variant="outline" onClick={close}>
              Get a free cited bid check
            </ButtonLink>
          </div>
        </nav>
      )}
    </MenuSheet>
  );
}
