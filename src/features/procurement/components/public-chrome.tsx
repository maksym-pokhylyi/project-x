import Link from "next/link";
import type { ReactNode } from "react";
import { Placeholders } from "@/components/marketing/placeholders";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";
import { DATA_SOURCES_HREF, flagMistakeHref, PRIVACY_HREF } from "../domain/links";
import { pluralise } from "../domain/format";
import { FooterBand } from "./ui/footer-band";
import { LeanHeader, type LeanHeaderLink } from "./ui/lean-header";

/**
 * The frame of the public data pages, as the artboards draw it:
 *
 *   supplier, tender, flag a mistake   <DataHeader> (lean: one or two links and one button)
 *                                      + <SourceFooter> ("Where this comes from." and three links)
 *   find, claim, about the data        the marketing <SiteHeader> + <LegalFooter> (one small-print line)
 *   radar, tender inside the app       <AppSourceNote> at the foot of the page
 *
 * No personal data here or anywhere on these pages: the operator's own details in the
 * legal line come from src/config/site.ts, like every other legal text.
 */

/**
 * Lean header of a page reached from an e-mail or a search result. `signedIn` swaps "Sign in"
 * for the way back to the radar. What a phone keeps beside the lockup is the page's choice,
 * as its artboard draws it:
 *
 *   question   "What is this?" alone (a supplier or buyer page: its first screen has the action)
 *   action     "Sign in" and the button (a tender)
 *   links      "What is Bidfolio?" and "Sign in" (a form: nothing competes with it)
 */
export function DataHeader({ action, signedIn = false, phone = "question" }: { action?: ReactNode; signedIn?: boolean; phone?: "question" | "action" | "links" }) {
  const account = signedIn ? { href: "/app", label: "Open your radar" } : { href: "/sign-in", label: "Sign in" };
  const links: LeanHeaderLink[] = [
    { href: "/", label: `What is ${site.name}?`, phoneLabel: phone === "question" ? "What is this?" : undefined, wideOnly: phone === "action" },
    { ...account, wideOnly: phone === "question" },
  ];
  return <LeanHeader links={links} action={action} phoneAction={phone === "action"} />;
}

/**
 * The <main> of a public data page: the 1200 px column with the artboards' top and bottom
 * space — a `record` (a supplier, a buyer, a tender: 24/48 on phones, 44/72 on a desk) or a
 * `task` page under the marketing header (find, claim, flag a mistake: 28/40 and 48/72).
 */
export function DataMain({ children, variant = "record", className }: { children: ReactNode; variant?: "record" | "task"; className?: string }) {
  return (
    <main id="main" className={cn("container-content", variant === "task" ? "pt-7 pb-10 md:pt-12 md:pb-18" : "pt-6 pb-12 md:pt-11 md:pb-18", className)}>
      {children}
    </main>
  );
}

const INDEPENDENCE = `Contains public sector information licensed under the Open Government Licence v3.0. ${site.name} is an independent service and is not affiliated with, or endorsed by, the UK Government.`;

/**
 * "Where this comes from." — the closing band of a page built from notices, with the three
 * links every such page carries. `pagePath` pre-fills the "Flag a mistake" form.
 */
export function SourceFooter({ origin, pagePath }: { /** "Built from 37 notices published on Find a Tender." */ origin: string; pagePath?: string }) {
  return (
    <FooterBand data-testid="data-attribution">
      <div className="flex flex-col gap-x-16 gap-y-2 md:flex-row md:flex-wrap md:justify-between md:gap-y-4">
        <p className="max-w-[47.5rem] min-w-0 md:flex-[1_1_32.5rem]">
          <strong className="font-semibold text-ink">Where this comes from.</strong> {origin} {INDEPENDENCE} Check the original notice before you rely on anything here.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap items-start gap-x-6">
          <Link href={flagMistakeHref(pagePath)} className="link inline-flex min-h-11 items-center rounded-sm md:min-h-0 md:py-1">
            Flag a mistake
          </Link>
          <Link href={DATA_SOURCES_HREF} className="link inline-flex min-h-11 items-center rounded-sm md:min-h-0 md:py-1">
            Data sources
          </Link>
          <Link href={PRIVACY_HREF} className="link inline-flex min-h-11 items-center rounded-sm md:min-h-0 md:py-1">
            Privacy
          </Link>
        </nav>
      </div>
    </FooterBand>
  );
}

/** How many notices a page is built from, as its "Where this comes from" sentence. */
export function builtFromNotices(count: number): string {
  return count > 0 ? `Built from ${pluralise(count, "notice")} published on Find a Tender.` : "Built from notices published on Find a Tender.";
}

/**
 * The one small-print paragraph that closes Find, Claim and "Flag a mistake": who operates
 * the service, how to reach them, who takes payments, where the data comes from.
 */
export function LegalFooter() {
  const { company, facts } = site;
  return (
    <FooterBand data-testid="legal-footer">
      <p className="max-w-[61.25rem]">
        {site.name} is operated by <Placeholders text={company.legalName} />, an independent sole trader based in {facts.operatorCountry}. Contact:{" "}
        <a href={`mailto:${site.supportEmail}`} className="link">
          {site.supportEmail}
        </a>{" "}
        · UK representative: <Placeholders text={company.ukRepresentative} /> · Payments are processed by Paddle. · {INDEPENDENCE}
      </p>
    </FooterBand>
  );
}

/** The attribution line at the foot of an app page that shows notices (the app shell has no footer of its own). */
export function AppSourceNote() {
  return (
    <FooterBand variant="inset" data-testid="data-attribution">
      <p>Notices from Find a Tender. {INDEPENDENCE}</p>
    </FooterBand>
  );
}
