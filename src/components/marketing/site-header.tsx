import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button-link";
import { MobileNav } from "./mobile-nav";
import { SiteHeaderNav } from "./site-header-nav";
import { findCompany } from "./site-nav";

/**
 * Public header, as in the landing and pricing artboards: the lockup on the left; on the
 * right the links, "Sign in" and the one green button. 72 px tall on a hairline (56 px on
 * phones, where the links move into the menu).
 *
 * Static (no session read on the server) so public pages stay cacheable; the links (which
 * mark the current page through NavLink) and the sign-in link (which becomes "Open your
 * radar" for people who are signed in) are a small client island, SiteHeaderNav.
 */
export function SiteHeader() {
  return (
    <header data-slot="site-header" className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="container-content flex min-h-14 items-center justify-between gap-4 max-md:pr-2 md:min-h-[4.5rem]">
        <Logo />
        <div className="hidden items-center gap-8 md:flex">
          <SiteHeaderNav />
          <ButtonLink href={findCompany.href}>{findCompany.label}</ButtonLink>
        </div>
        <MobileNav />
      </div>
    </header>
  );
}
