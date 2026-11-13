import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { site } from "@/config/site";
import { INDEPENDENCE_STATEMENT, OGL_ATTRIBUTION, OGL_URL } from "../config";
import { FLAG_MISTAKE_HREF } from "../domain/links";
import { ActionBand } from "@/components/ui/action-band";
import { SectionHead } from "@/components/ui/section-head";

/**
 * "About the data": where the notices come from, how they are licensed, what the pages show
 * and leave out, and how they are built — in the page style of the other public pages.
 * Asking for a correction or a removal has its own page ("Flag a mistake").
 */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <SectionHead id={id} title={title} />
      <div className="type-reading flex max-w-[42.5rem] flex-col gap-3 text-ink [&_a]:underline [&_a]:decoration-brand [&_a]:decoration-1 [&_a]:underline-offset-[3px] [&_a:hover]:text-brand [&_strong]:font-semibold">{children}</div>
    </section>
  );
}

export function AboutTheData() {
  return (
    <div className="flex flex-col gap-10 md:gap-14">
      <header className="flex flex-col gap-3.5">
        <h1 className="type-h1 text-ink">About the data</h1>
        <p className="type-lead max-w-[45rem] text-ink">{site.name} shows public contract notices in a form small suppliers can use: who won what, which tenders are open, and which contracts end soon.</p>
      </header>

      <Section id="source" title="Where the data comes from">
        <p>
          Every notice on {site.name} comes from <a href="https://www.find-tender.service.gov.uk/">Find a Tender</a>, the UK’s central platform for public procurement notices. We read its open data feed every {site.facts.dataRefreshMinutes} minutes. Each tender, award and contract on our pages links to the original notice.
        </p>
        <p>
          <strong>
            <a href={OGL_URL} rel="license noopener">
              {OGL_ATTRIBUTION}
            </a>
          </strong>{" "}
          Contract data: Find a Tender service, © Crown copyright.
        </p>
      </Section>

      <Section id="independence" title="We are independent">
        <p>
          <strong>{INDEPENDENCE_STATEMENT}</strong> We are a commercial service. We do not publish notices, run tenders or accept bids, and nothing here is an official record. To respond to a tender, follow the link to the notice and use the buyer’s own portal.
        </p>
      </Section>

      <Section id="what-we-show" title="What we show, and what we leave out">
        <p>
          Company and buyer pages show <strong>company-level information only</strong>: the registered name, the Companies House number where the notice gives one, contract titles, values, dates, categories and the buyer. Figures are as published by each buyer; we do not verify them.
        </p>
        <p>
          We do <strong>not</strong> show contact names, email addresses or telephone numbers, even where a notice includes them. We do not publish pages for sole traders or for suppliers we cannot identify as a registered organisation.
        </p>
        <p>“Contracts ending soon” lists use the end date stated in the notice. They say nothing about how a contract is performing or whether it will be re-tendered.</p>
      </Section>

      <Section id="accuracy" title="How pages are built, and their limits">
        <p>
          We group notices by procurement and by supplier. A supplier is matched on its Companies House number first, then on the identifier Find a Tender assigns, then on its exact registered name. Buyers sometimes publish incomplete or placeholder values (£0, £1), update a notice later, or name a trading name. We treat placeholder values as “not published” and never add a shared framework value to one supplier’s total.
        </p>
        <p>
          A tender is listed as a match for a company when it is the same line of work as contracts the company has won (the same category in the buyers’ own classification), or comes from a buyer that has already awarded it a contract, in a region where it works. A match is a suggestion to look, not a view on whether you should bid or would win.
        </p>
      </Section>

      <ActionBand
        id="request"
        className="scroll-mt-24"
        headingLevel="h2"
        title="Something wrong about your company?"
        actions={
          <>
            <ButtonLink href={FLAG_MISTAKE_HREF} className="max-md:w-full" data-testid="flag-mistake-cta">
              Flag a mistake
            </ButtonLink>
            <Link href="/find" className="link inline-flex min-h-11 items-center justify-center rounded-sm text-sm font-medium">
              Find your company
            </Link>
          </>
        }
      >
        Tell us what to correct or hide. A person reviews every request within five working days. If the notice itself is wrong, the buyer who published it can correct it on Find a Tender, and our copy follows.
      </ActionBand>
    </div>
  );
}
