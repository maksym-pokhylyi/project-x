import Link from "next/link";
import type { ReactNode } from "react";
import { PlanTick } from "@/components/billing/pricing-table";
import { Logo } from "@/components/logo";
import { site } from "@/config/site";

const points = [
  "Your page is built from your own public contract wins.",
  "Every requirement in a bid check is quoted, with its file and page.",
  `Your files stay yours: stored in ${site.facts.hostingRegion.replace(/ \(.*\)$/, "")}, never used to train AI.`,
];

/**
 * Frame of the sign-in, sign-up and invitation pages.
 * Phones and tablets: one calm column on paper. From 1024 px: the form on the left and, on
 * the right, a brand-green panel with the tagline and three plain statements — the same
 * split as the social image. No imagery, no animation.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(24rem,36%)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex min-h-14 items-center border-b border-line px-5 md:min-h-[4.5rem] md:px-6 lg:px-12">
          <Logo />
        </header>
        <main id="main" className="flex flex-1 items-start justify-center px-5 pt-8 pb-12 md:pt-14 lg:items-center lg:py-12">
          {children}
        </main>
        <footer className="px-5 py-5 text-13 text-ink-2 md:px-6 lg:px-12">
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/legal/terms" className="link-quiet text-ink-2">
              Terms
            </Link>
            <Link href="/legal/privacy" className="link-quiet text-ink-2">
              Privacy
            </Link>
            <Link href="/contact" className="link-quiet text-ink-2">
              Contact
            </Link>
          </nav>
        </footer>
      </div>

      <aside aria-label={`About ${site.name}`} className="on-brand hidden bg-brand text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        <p className="font-mono text-sm font-medium text-brand-on-dark">{site.domain}</p>
        <div>
          <p className="font-display text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.02em] text-balance">{site.tagline}.</p>
          <ul className="mt-8 flex flex-col gap-3.5 text-base">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <PlanTick className="mt-1 text-white" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="max-w-sm text-13 text-brand-on-dark">{site.name} is an independent service. It is not part of GOV.UK and is not endorsed by the UK Government.</p>
      </aside>
    </div>
  );
}
