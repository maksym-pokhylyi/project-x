import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/ui/nav-link";
import { navLinkVariants } from "@/components/ui/nav-link-variants";
import { HeaderSessionLink } from "./header-session-link";
import { MobileNav } from "./mobile-nav";
import { findCompany, primaryNav } from "./site-nav";

const navLink = navLinkVariants({ variant: "header" });

/**
 * Public header, as in the landing artboard: the lockup on the left; on the right the
 * links, "Sign in" and the one green button. 72 px tall on a hairline (56 px on phones,
 * where the links move into the menu).
 *
 * Static (no session read on the server) so public pages stay cacheable; the sign-in link
 * is a small client island that becomes "Open your radar" for people who are signed in.
 */
export function SiteHeader() {
  return (
    <header data-slot="site-header" className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="container-content flex min-h-14 items-center justify-between gap-4 max-md:pr-2 md:min-h-[4.5rem]">
        <Logo />
        <div className="hidden items-center gap-8 md:flex">
          <nav aria-label="Main" className="flex items-center gap-8">
            {primaryNav.map((item) => (
              <NavLink key={item.href} href={item.href} variant="header" match="exact">
                {item.label}
              </NavLink>
            ))}
            <HeaderSessionLink className={navLink} />
          </nav>
          <Button asChild>
            <Link href={findCompany.href}>{findCompany.label}</Link>
          </Button>
        </div>
        <MobileNav />
      </div>
    </header>
  );
}
