import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { DataRequestForm } from "@/features/procurement/components/data-request-form";
import { INDEPENDENCE_STATEMENT, OGL_ATTRIBUTION, OGL_URL } from "@/features/procurement/config";

export const metadata: Metadata = {
  title: "About the data",
  description: `Where ${site.name}'s contract data comes from, how it is licensed, what we show and do not show, and how to request a correction or removal.`,
  alternates: { canonical: "/about-the-data" },
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-lg font-semibold tracking-tight sm:text-xl">
        {title}
      </h2>
      <div className="max-w-[68ch] space-y-3 text-sm leading-6 text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-medium [&_strong]:text-foreground">{children}</div>
    </section>
  );
}

export default async function AboutTheDataPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const raw = (await searchParams).page;
  const page = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  // Only same-site paths are pre-filled.
  const defaultPage = /^\/[A-Za-z0-9\-/_.]{1,200}$/.test(page) ? `https://${site.domain}${page}` : "";

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">About the data</h1>
        <p className="max-w-prose text-base text-muted-foreground">
          {site.name} shows public contract notices in a form small suppliers can use: who won what, which tenders are open, and which contracts end soon.
        </p>
      </header>

      <Section id="source" title="Where the data comes from">
        <p>
          Every notice on {site.name} comes from <a href="https://www.find-tender.service.gov.uk/">Find a Tender</a>, the UK&apos;s central platform for public
          procurement notices. We read its open data feed every ten minutes. Each tender, award and contract on our pages links to the original notice.
        </p>
        <p>
          <strong>
            <a href={OGL_URL}>{OGL_ATTRIBUTION}</a>
          </strong>{" "}
          Contract data: Find a Tender service, © Crown copyright.
        </p>
      </Section>

      <Section id="independence" title="We are independent">
        <p>
          <strong>{INDEPENDENCE_STATEMENT}</strong> We are a commercial service. We do not publish notices, run tenders or accept bids, and nothing here is an
          official record. To respond to a tender, follow the link to the notice and use the buyer&apos;s own portal.
        </p>
      </Section>

      <Section id="what-we-show" title="What we show, and what we leave out">
        <p>
          Company and buyer pages show <strong>company-level information only</strong>: the registered name, the Companies House number where the notice
          gives one, contract titles, values, dates, categories and the buyer. Figures are as published by each buyer; we do not verify them.
        </p>
        <p>
          We do <strong>not</strong> show contact names, email addresses or telephone numbers, even where a notice includes them. We do not publish pages for
          sole traders or for suppliers we cannot identify as a registered organisation.
        </p>
        <p>
          &quot;Contracts ending soon&quot; lists use the end date stated in the notice. They say nothing about how a contract is performing or whether it
          will be re-tendered.
        </p>
      </Section>

      <Section id="accuracy" title="How pages are built, and their limits">
        <p>
          We group notices by procurement and by supplier. A supplier is matched on its Companies House number first, then on the identifier Find a Tender
          assigns, then on its exact registered name. Buyers sometimes publish incomplete or placeholder values (£0, £1), update a notice later, or name a
          trading name. We treat placeholder values as &quot;not published&quot; and never add a shared framework value to one supplier&apos;s total.
        </p>
        <p>
          Matches between a company and open tenders are produced automatically from categories, wording, region and contract size. Where a reason is marked
          &quot;AI-assisted&quot;, a language model wrote the sentence from the same published facts. A match is a suggestion to look, not a view on whether
          you should bid or would win.
        </p>
      </Section>

      <section id="request" aria-labelledby="request-title" className="scroll-mt-20 space-y-4 rounded-lg border bg-card p-5 sm:p-6">
        <div className="space-y-2">
          <h2 id="request-title" className="text-lg font-semibold tracking-tight sm:text-xl">
            Request a correction or removal
          </h2>
          <p className="max-w-[68ch] text-sm leading-6 text-muted-foreground">
            If something about your organisation is wrong, or you want a page removed, tell us. We act on every request within five working days. You can also
            write to{" "}
            <a href={`mailto:${site.supportEmail}`} className="text-foreground underline underline-offset-4">
              {site.supportEmail}
            </a>
            . If the notice itself is wrong, the buyer who published it can correct it on Find a Tender, and our copy follows.
          </p>
        </div>
        <DataRequestForm defaultPage={defaultPage} supportEmail={site.supportEmail} />
      </section>

      <p className="text-sm text-muted-foreground">
        Looking for your own company?{" "}
        <Link href="/find" className="font-medium text-foreground underline underline-offset-4">
          Find your company
        </Link>
        .
      </p>
    </div>
  );
}
