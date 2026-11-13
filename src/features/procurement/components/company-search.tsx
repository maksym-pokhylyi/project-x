"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type CompanyHit = {
  slug: string;
  name: string;
  companyNumber: string | null;
  locality: string | null;
  awardsCount: number;
  isPublic: boolean;
};

type Status = "idle" | "typing" | "loading" | "done" | "error";

/**
 * "Find your company": search by name or Companies House number.
 * Works without JavaScript as a plain GET form (`?q=`); with it, results update as you type.
 * States (DESIGN.md §6): empty, typing, no result, many results, error.
 */
export function CompanySearch({
  initialQuery,
  initialResults,
  resultHref,
  endpoint,
  action,
  manualHref,
  actionLabel = "View page",
}: {
  initialQuery: string;
  initialResults: CompanyHit[];
  /** Builds the link of a result. */
  resultHref: "public" | "claim";
  /** JSON endpoint for type-ahead. */
  endpoint: string;
  /** Path the form submits to without JavaScript. */
  action: string;
  /** Where "set up a radar manually" leads. */
  manualHref: string;
  actionLabel?: string;
}) {
  const inputId = useId();
  const [query, setQuery] = useState(initialQuery);
  // What the list currently shows, and for which search term it was loaded.
  const [loaded, setLoaded] = useState<{ term: string; results: CompanyHit[] }>({ term: initialQuery.trim(), results: initialResults });
  const [failedTerm, setFailedTerm] = useState<string | null>(null);
  const latest = useRef(0);
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2 || term === loaded.term) return;
    const ticket = ++latest.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set("q", term);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { results: CompanyHit[] };
        if (ticket !== latest.current) return;
        setLoaded({ term, results: body.results });
        setFailedTerm(null);
      } catch (error) {
        if ((error as Error).name === "AbortError" || ticket !== latest.current) return;
        setFailedTerm(term);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, endpoint, loaded.term]);

  // Everything the user sees is derived from the term and what has been loaded for it.
  const status: Status = term.length === 0 ? "idle" : term.length < 2 ? "typing" : failedTerm === term ? "error" : loaded.term === term ? "done" : "loading";
  const results = status === "done" ? loaded.results : [];

  const hrefOf = (hit: CompanyHit) => (resultHref === "claim" ? `/claim/${hit.slug}` : `/suppliers/${hit.slug}`);

  return (
    <div className="space-y-4">
      <form action={action} method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
            Company name or Companies House number
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={inputId}
              name="q"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. Acme Grounds Maintenance or 01234567"
              autoComplete="organization"
              className="h-11 pl-9"
              aria-describedby={`${inputId}-status`}
              data-testid="company-search-input"
            />
          </div>
        </div>
        <Button type="submit" size="lg" className="h-11 sm:self-end">
          Search
        </Button>
      </form>

      <div id={`${inputId}-status`} aria-live="polite" className="text-sm text-muted-foreground" data-testid="company-search-status" data-status={status}>
        {status === "idle" ? "Type at least two characters. We list suppliers named in published contract awards." : null}
        {status === "typing" ? "Keep typing…" : null}
        {status === "loading" ? "Searching…" : null}
        {status === "error" ? "Search is not available right now. Press Search to try again." : null}
        {status === "done" && results.length > 0 ? `${results.length === 20 ? "Top 20 results" : `${results.length} result${results.length === 1 ? "" : "s"}`} for “${query.trim()}”` : null}
      </div>

      {status === "done" && results.length === 0 ? (
        <div className="rounded-lg border border-dashed px-5 py-8 text-center" data-testid="company-search-empty">
          <p className="text-sm font-medium">No company found for “{query.trim()}”</p>
          <p className="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">
            We only list suppliers with published awards. Check the spelling or try the company number — or set up a radar manually.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={manualHref}>Set up a radar manually</Link>
          </Button>
        </div>
      ) : null}

      {results.length > 0 ? (
        <ul className="divide-y rounded-lg border" data-testid="company-search-results">
          {results.map((hit) => (
            <li key={hit.slug} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-medium">{hit.name}</p>
                <p className="text-sm text-muted-foreground">
                  {[hit.companyNumber ? `Company no. ${hit.companyNumber}` : null, hit.locality, `${hit.awardsCount} published award${hit.awardsCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              {resultHref === "public" && !hit.isPublic ? null : (
                <Button asChild variant="outline" size="sm" className="shrink-0 self-start sm:self-auto">
                  <Link href={hrefOf(hit)}>{actionLabel}</Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
