import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { HeaderSessionLink } from "./header-session-link";
import { MobileNav } from "./mobile-nav";
import { findCompany, primaryNav } from "./site-nav";

const navLink =
  "inline-flex h-10 items-center rounded-control px-3 text-sm font-medium text-ink-2 transition-colors duration-150 hover:bg-surface-sunken hover:text-ink";

/**
 * Marketing header. Static (no session read on the server) so marketing pages stay
 * cacheable; the sign-in link is a small client island that becomes "Open your radar"
 * for people who are already signed in.
 */
export function SiteHeader() {
  return (
    <header data-slot="site-header" className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="container-content flex h-16 items-center gap-3">
        <Logo />
        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 lg:flex">
          {primaryNav.map((item) => (
            <Link key={item.href} href={item.href} className={navLink}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <HeaderSessionLink className={`${navLink} hidden sm:inline-flex`} />
          <Button asChild className="hidden sm:inline-flex">
            <Link href={findCompany.href}>{findCompany.label}</Link>
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
