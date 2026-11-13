import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { site } from "@/config/site";

const points = [
  "Your radar is built from your own public contract wins.",
  "Every requirement in a bid check is quoted, with its file and page.",
  `Your files stay yours: stored in ${site.facts.hostingRegion.replace(/ \(.*\)$/, "")}, never used to train AI.`,
];

/**
 * Frame of the sign-in, sign-up and invitation pages.
 * Phones and tablets: one calm column. From 1024 px: the form on the left and, on the right,
 * a brand panel with a short value statement — no imagery, no animation.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(24rem,42%)]">
      <div className="flex min-h-dvh flex-col">
        <header className="px-4 py-5 sm:px-8 lg:px-12">
          <Logo />
        </header>
        <main id="main" className="flex flex-1 items-start justify-center px-4 pt-6 pb-12 sm:px-8 sm:pt-12 lg:items-center lg:pt-0 lg:pb-24">
          {children}
        </main>
        <footer className="px-4 py-5 text-13 text-ink-2 sm:px-8 lg:px-12">
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/legal/terms" className="link-quiet">
              Terms
            </Link>
            <Link href="/legal/privacy" className="link-quiet">
              Privacy
            </Link>
            <Link href="/contact" className="link-quiet">
              Contact
            </Link>
          </nav>
        </footer>
      </div>

      <aside aria-label={`About ${site.name}`} className="on-brand hidden bg-brand text-paper lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <p className="type-eyebrow text-brand-on-dark">{site.tagline}</p>
        <div>
          <p className="type-h1 text-paper">Know which public contracts are worth your time.</p>
          <ul className="mt-8 space-y-4">
            {points.map((point) => (
              <li key={point} className="grid grid-cols-[1.25rem_1fr] gap-x-3 text-base text-paper">
                <Check aria-hidden className="mt-0.5 size-5 text-brand-on-dark" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="max-w-sm text-13 text-brand-on-dark">
          {site.name} is an independent service. It is not affiliated with, or endorsed by, the UK Government.
        </p>
      </aside>
    </div>
  );
}
