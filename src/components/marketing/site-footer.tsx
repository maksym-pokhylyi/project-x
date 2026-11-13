import Link from "next/link";
import { Logo } from "@/components/logo";
import { site } from "@/config/site";
import { hasPlaceholder } from "./placeholders";
import { footerGroups } from "./site-nav";

const OGL_URL = "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";

/** Footer of every marketing page: product and legal links, data attribution, independence line. */
export function SiteFooter() {
  return (
    <footer data-slot="site-footer" className="border-t border-line bg-surface-sunken">
      <div data-slot="site-footer-nav" className="container-content grid gap-x-8 gap-y-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-16">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-sm text-ink-2">{site.tagline}.</p>
          <p className="mt-4 text-sm text-ink-2">
            Questions?{" "}
            <a href={`mailto:${site.supportEmail}`} className="link">
              {site.supportEmail}
            </a>
          </p>
        </div>
        {footerGroups.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="font-sans text-sm leading-5 font-semibold text-ink">{group.title}</h2>
            <ul className="mt-2 text-sm text-ink-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="link-quiet inline-flex min-h-10 items-center rounded-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="container-content space-y-2 py-6 text-13 text-ink-2">
          <p>
            Contains public sector information licensed under the{" "}
            <a href={OGL_URL} className="link" rel="license noopener">
              Open Government Licence v3.0
            </a>
            . Contract data: Find a Tender service, © Crown copyright.
          </p>
          <p>{site.name} is an independent service and is not affiliated with, or endorsed by, the UK Government.</p>
          <p>Payments are processed by Paddle.</p>
          <p className="pt-2">
            © {new Date().getFullYear()} {hasPlaceholder(site.company.legalName) ? site.name : site.company.legalName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
