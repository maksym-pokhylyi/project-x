import type { Metadata } from "next";
import { site } from "@/config/site";
import { CompanySearch, type CompanyHit } from "@/features/procurement/components/company-search";
import { DataAttribution } from "@/features/procurement/components/data-attribution";
import { searchSuppliers } from "@/features/procurement/queries/suppliers";

export const metadata: Metadata = {
  title: "Find your company",
  description: "Search by company name or Companies House number to see your public contract awards, the open tenders that match them and the contracts ending soon in your trade.",
  alternates: { canonical: "/find" },
  openGraph: { title: `Find your company · ${site.name}`, description: "See the public contracts you have won and the open tenders that match them.", url: "/find" },
};

/** Find your company (DESIGN.md §6): search box, results with award counts, all states. */
export default async function FindPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 120) ?? "";
  const hits = query.trim().length >= 2 ? await searchSuppliers(query, { limit: 20 }) : [];
  const initialResults: CompanyHit[] = hits.map((hit) => ({ slug: hit.slug, name: hit.name, companyNumber: hit.companyNumber, locality: hit.locality, awardsCount: hit.awardsCount, isPublic: hit.isPublic }));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">Find your company</h1>
        <p className="max-w-prose text-base text-muted-foreground">
          If your company has won a public contract, it already has a page: your awards, the open tenders that match them and the contracts in your trade that
          end soon.
        </p>
      </header>
      <CompanySearch
        key={query}
        initialQuery={query}
        initialResults={initialResults}
        resultHref="public"
        endpoint="/api/procurement/search"
        action="/find"
        manualHref="/sign-up?redirect=%2Fapp%2Fradar%2Fsetup"
      />
      <DataAttribution pagePath="/find" />
    </div>
  );
}
