import Link from "next/link";
import { Logo } from "@/components/logo";
import { identity, site } from "@/config/site";
import { footerGroups, footerPhoneLinks } from "./site-nav";

/** A link inside the muted identity line: it keeps the line's grey and takes a quiet underline. */
const quietLink = "underline decoration-line-strong decoration-1 underline-offset-[3px] transition-colors duration-150 hover:text-ink hover:decoration-brand";

/**
 * Footer of every public page, as in the artboards: paper-deep, the lockup and tagline on
 * the left, three short columns on the right (one wrapping row of links on phones), and the
 * identity line under a hairline: who operates the service, how to reach them, payments,
 * the data licence and the independence statement. All of it comes from src/config/site.ts.
 */
export function SiteFooter() {
  const { contact, licence } = identity;

  return (
    <footer data-slot="site-footer" className="bg-paper-deep">
      <div className="container-content flex flex-col gap-5 pt-9 pb-8 sm:gap-9 sm:pt-12 sm:pb-10">
        <div data-slot="site-footer-nav" className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:justify-between sm:gap-x-16 sm:gap-y-8">
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-[1_1_17.5rem] sm:gap-3">
            {/* The link keeps its 8 px of padding as a hit area; the margin takes it out of the layout. */}
            <Logo className="-my-2" />
            <p className="max-w-[18.75rem] text-sm leading-[1.5] text-ink-2">{site.tagline}.</p>
          </div>

          {/* Phones: one wrapping row. */}
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 text-sm sm:hidden">
            {footerPhoneLinks.map((link) => (
              <Link key={link.href} href={link.href} className="link-quiet inline-flex min-h-11 items-center rounded-sm leading-[1.5]">
                {link.label}
              </Link>
            ))}
          </nav>

          {/* From 640 px: three columns. */}
          <nav aria-label="Footer" className="hidden flex-wrap gap-x-[4.5rem] gap-y-6 text-sm sm:flex">
            {footerGroups.map((group) => {
              const id = `footer-${group.title.toLowerCase()}`;
              return (
                <div key={group.title}>
                  <p id={id} className="pb-1 leading-[1.3125rem] font-semibold text-ink">
                    {group.title}
                  </p>
                  <ul aria-labelledby={id} className="mt-1 flex flex-col gap-1">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="link-quiet inline-flex min-h-10 items-center rounded-sm leading-[1.3125rem] md:min-h-[1.9375rem]">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-line pt-4 sm:pt-5">
          <p data-testid="site-identity" className="max-w-[61.25rem] text-13 leading-[1.6] text-ink-2">
            {identity.operator} {contact.label}{" "}
            <a href={`mailto:${contact.email}`} className={quietLink}>
              {contact.email}
            </a>{" "}
            · {identity.ukRepresentative} · {identity.payments} · {licence.before}
            <a href={licence.url} rel="license noopener" className={quietLink}>
              {licence.name}
            </a>
            {licence.after} · {identity.independence}
          </p>
        </div>
      </div>
    </footer>
  );
}
