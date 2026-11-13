import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatMonth, pluralise } from "../domain/format";
import type { SupplierHit } from "../queries/suppliers";
import { controlSize } from "./ui/control-size";
import { ListCard } from "@/components/ui/list-card";

/**
 * "Find your company", as the Find artboards draw it. A plain GET form: the question lives
 * in the address (`?q=`), the results are rendered on the server, and nothing here needs
 * script — it is the first thing a visitor from a cold e-mail may do.
 *
 * COMPANY-LEVEL DATA ONLY: a name, a town, a Companies House number and a count of
 * published contracts.
 */

/** The search row: one field and its button, the same 52 px (control sizes: "search rows"). */
export function CompanySearchForm({
  action,
  defaultValue = "",
  autoFocus = false,
  id = "company-q",
  className,
}: {
  /** Where the form submits: the page that shows the results. */
  action: string;
  defaultValue?: string;
  autoFocus?: boolean;
  id?: string;
  className?: string;
}) {
  const height = controlSize.search;
  return (
    <form action={action} method="get" role="search" className={cn("flex max-w-[45rem] flex-col gap-2", className)} data-testid="company-search">
      <Label htmlFor={id}>Company name or Companies House number</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          name="q"
          type="search"
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          autoComplete="organization"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={120}
          className={cn(height, "min-w-0 flex-1")}
          data-testid="company-search-input"
        />
        <Button type="submit" variant="outline" className={cn(height, "px-[1.125rem] text-base md:px-[1.375rem]")} data-testid="company-search-submit">
          <svg viewBox="0 0 16 16" aria-hidden className="size-4 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] max-md:hidden">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          Search
        </Button>
      </div>
    </form>
  );
}

function contractsLine(hit: SupplierHit): ReactNode {
  if (hit.awardsCount === 0) return "No public contracts found";
  const recent = formatMonth(hit.lastAwardAt);
  return `${pluralise(hit.awardsCount, "public contract")} found${recent && hit.awardsCount > 1 ? `, most recent ${recent}` : ""}`;
}

/**
 * The results: one white card, a row per company. The first row — the closest match —
 * carries the primary button; the others an outline one. A company without a public page
 * (no contract to its name, or one we do not publish) has no "View page", and says so.
 */
export function CompanyResults({ query, hits, manualHref }: { query: string; hits: SupplierHit[]; /** Where "set up a radar by trade and region" leads. */ manualHref: string }) {
  return (
    <section aria-labelledby="results-h" className="flex flex-col" data-testid="company-results">
      <div className="flex flex-col gap-x-6 gap-y-0.5 md:flex-row md:flex-wrap md:items-baseline md:justify-between">
        <h2 id="results-h" className="font-sans text-base leading-snug font-semibold text-ink md:text-17">
          {pluralise(hits.length, "company", "companies")} {hits.length === 1 ? "matches" : "match"} “{query}”
        </h2>
        <p className="text-13 text-ink-2 md:text-sm">Closest name first, then most public contracts.</p>
      </div>
      <ListCard aria-label="Companies" className="mt-3.5 tabular-nums">
        {hits.map((hit, index) => (
          <li key={hit.slug} className="flex flex-col gap-x-8 gap-y-3 p-4 lg:flex-row lg:items-center lg:px-6 lg:py-5" data-testid="company-result">
            <div className="flex min-w-0 flex-col gap-1 lg:flex-[1_1_25rem]">
              <h3 className="font-sans text-base leading-snug font-semibold text-ink [overflow-wrap:anywhere] md:text-17">{hit.name}</h3>
              <p className="text-13 text-ink-2 md:text-sm">
                {[hit.locality, hit.companyNumber ? "Companies House" : null].filter(Boolean).join(" · ")}
                {hit.companyNumber ? (
                  <>
                    {" "}
                    <span className="font-mono text-xs md:text-13">{hit.companyNumber}</span>
                  </>
                ) : null}
                {!hit.locality && !hit.companyNumber ? "No Companies House number published" : null}
              </p>
            </div>
            <div className="-mt-1.5 flex flex-col text-sm text-ink md:text-15 lg:mt-0 lg:w-[22.5rem] lg:shrink-0">
              <p>{contractsLine(hit)}</p>
              {hit.awardsCount === 0 ? (
                <p className="text-13 text-ink-2">No page yet. You can still set up a radar.</p>
              ) : !hit.isPublic ? (
                <p className="text-13 text-ink-2">No public page for this supplier.</p>
              ) : null}
            </div>
            <div className="flex items-center gap-4 lg:w-[18.125rem] lg:shrink-0 lg:flex-row-reverse lg:justify-start lg:gap-5">
              <ButtonLink href={`/claim/${hit.slug}`} variant={index === 0 ? "default" : "outline"} className="flex-1 lg:flex-none" aria-label={`This is my company: ${hit.name}`} data-testid="company-claim">
                This is my company
              </ButtonLink>
              {hit.isPublic ? (
                <Link href={`/suppliers/${hit.slug}`} className="link inline-flex min-h-11 items-center rounded-sm text-sm" aria-label={`View page for ${hit.name}`}>
                  View page
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ListCard>
      <p className="mt-4 text-sm text-ink md:mt-5 md:text-15">
        Can’t see your company? Try the Companies House number, or{" "}
        <Link href={manualHref} className="link">
          set up a radar by trade and region
        </Link>
        .
      </p>
    </section>
  );
}
