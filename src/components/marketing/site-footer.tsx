import Link from "next/link";
import { Logo } from "@/components/logo";
import { site } from "@/config/site";
import { hasPlaceholder } from "./placeholders";
import { footerGroups } from "./site-nav";

const OGL_URL = "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";

/**
 * Footer of every public page, as in the landing artboard: paper-deep, the lockup and tagline
 * on the left, three short columns on the right, and one small-print block under a hairline
 * (data attribution, independence, payments, the registered company).
 */
export function SiteFooter() {
  const { company } = site;
  const registered = [company.legalName, company.registrationNumber, company.address];
  const pending = registered.some(hasPlaceholder);

  return (
    <footer data-slot="site-footer" className="bg-paper-deep">
      <div className="container-content flex flex-col gap-9 pt-12 pb-10">
        <div data-slot="site-footer-nav" className="flex flex-wrap justify-between gap-x-16 gap-y-8">
          <div className="flex min-w-0 flex-[1_1_17.5rem] flex-col items-start gap-2">
            <Logo />
            <p className="max-w-[18.75rem] text-sm text-ink-2">{site.tagline}.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-8 text-sm sm:flex sm:gap-x-[4.5rem]">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <p id={`footer-${group.title.toLowerCase()}`} className="pb-1.5 font-semibold text-ink">
                  {group.title}
                </p>
                <ul aria-labelledby={`footer-${group.title.toLowerCase()}`}>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="link-quiet inline-flex min-h-10 items-center rounded-sm md:min-h-[1.875rem]">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-line pt-5 text-13 text-ink-2">
          <p>
            Contains public sector information licensed under the{" "}
            <a href={OGL_URL} rel="license noopener">
              Open Government Licence v3.0
            </a>
            . Contract data: Find a Tender service, © Crown copyright.
          </p>
          <p>
            {site.name} is an independent service. It is not part of GOV.UK and is not affiliated with, or endorsed by, the UK Government. Payments are processed by
            Paddle.
          </p>
          <p className="pt-1.5">
            © {new Date().getFullYear()} {site.name}.{" "}
            {pending ? (
              <span className="font-mono text-xs [overflow-wrap:anywhere]">[Registered company name, number and office address.]</span>
            ) : (
              <span>
                {company.legalName}, company number {company.registrationNumber}. Registered office: {company.address}.
              </span>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
