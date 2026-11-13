import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { CompanySearch } from "@/components/marketing/company-search";
import { IdentityLine } from "@/components/marketing/identity-line";
import { site } from "@/config/site";

const headerLink = "link inline-flex min-h-11 items-center rounded-sm text-sm font-medium whitespace-nowrap md:link-quiet md:text-15 md:no-underline";

/**
 * Frame for the pages nobody wants to see, as in the NotFound artboards: not found, no
 * access, something broke, maintenance. The public header's bar with two links, then one
 * calm column: a mono reference line, what happened in plain words, what to do next, and
 * the identity line on paper-deep at the foot of the window.
 */
export function SystemPage({
  code,
  title,
  children,
  search = false,
  actions,
  links,
  reference,
}: {
  /** Short reference line above the title: "404", "403", "Error". */
  code: string;
  title: string;
  children: ReactNode;
  /** Offer the company search (the 404 page: most lost visitors were looking for a company). */
  search?: boolean;
  /** Buttons under the text. */
  actions?: ReactNode;
  /** Quiet links under the actions: "Go to the home page". */
  links?: { label: string; href: string }[];
  /** A reference the person can quote to support. */
  reference?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="container-content flex min-h-14 items-center justify-between gap-4 md:min-h-[4.5rem]">
          <Logo />
          <nav aria-label="Main" className="flex items-center gap-[1.125rem] md:gap-8">
            <Link href="/" className={headerLink}>
              What is {site.name}?
            </Link>
            <Link href="/sign-in" className={headerLink}>
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="px-5 pt-10 pb-12 sm:px-6 md:py-[5.5rem]">
        <div className="mx-auto flex w-full max-w-[40rem] flex-col">
          <p className="font-mono text-13 leading-[1.5] text-ink-2">{code}</p>
          <h1 className="type-h1 mt-2.5 text-ink md:mt-3">{title}</h1>
          <div className="type-lead mt-2.5 flex flex-col gap-3 text-ink md:mt-3.5">{children}</div>
          {search ? <CompanySearch id="lost-company" label="Find your company" submit="Search" variant="outline" className="mt-6 md:mt-8" /> : null}
          {actions ? <div className="mt-6 flex flex-col gap-2.5 sm:flex-row md:mt-8">{actions}</div> : null}
          {links?.length ? (
            <nav aria-label="Other pages" className="mt-3 flex flex-wrap gap-x-6 md:mt-4 md:gap-x-7">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="link inline-flex min-h-11 items-center rounded-sm text-15">
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {reference ? <p className="mt-8 border-t border-line pt-4 text-13 leading-[1.6] text-ink-2">{reference}</p> : null}
        </div>
      </main>

      <footer className="flex-1 bg-paper-deep">
        <div className="container-content pt-7 pb-8 sm:pt-8 sm:pb-9">
          <IdentityLine />
        </div>
      </footer>
    </div>
  );
}
