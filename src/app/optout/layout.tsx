import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { NavLink } from "@/components/ui/nav-link";
import { site } from "@/config/site";
import { operatorFooterLine } from "@/features/outreach/config";
import { INDEPENDENCE_STATEMENT, OGL_ATTRIBUTION } from "@/features/procurement/config";

/**
 * Shell of the opt-out page, as in the "Unsubscribed" artboard (docs/design/handoff,
 * Unsubscribe-1440 / -390): the public header reduced to the lockup and two links, one
 * 640 px column, and a paper-deep band that says who operates the service. Nothing here
 * tries to sell anything.
 */
export default function OptOutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="container-content flex min-h-14 flex-wrap items-center justify-between gap-x-8 gap-y-1 md:min-h-[4.5rem]">
          <Logo />
          <nav aria-label="Main" className="flex flex-wrap items-center gap-x-5 md:gap-x-8">
            <NavLink href="/" variant="header">
              What is {site.name}?
            </NavLink>
            <NavLink href="/sign-in" variant="header">
              Sign in
            </NavLink>
          </nav>
        </div>
      </header>

      <main id="main" className="px-5 pt-8 pb-12 md:px-6 md:pt-16 md:pb-[4.5rem]">
        <div className="mx-auto flex w-full max-w-[40rem] flex-col">{children}</div>
      </main>

      <footer className="flex-1 bg-paper-deep" data-testid="optout-operator">
        <div className="container-content pt-8 pb-9">
          <p className="max-w-[61.25rem] text-13 text-ink-2">
            {operatorFooterLine()} · Payments are processed by Paddle. · {OGL_ATTRIBUTION} · {INDEPENDENCE_STATEMENT}
          </p>
        </div>
      </footer>
    </div>
  );
}
