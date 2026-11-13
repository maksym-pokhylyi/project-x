import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CompanySearch, type CompanyHit } from "@/features/procurement/components/company-search";
import { searchSuppliers } from "@/features/procurement/queries/suppliers";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "Find your company" };

/** In-app "Find your company": pick the supplier record that is you, then confirm the claim. */
export default async function RadarFindPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  await requireOrgForPage({ returnTo: "/app/radar/find" });
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 120) ?? "";
  // Inside the app the search also covers suppliers that have no public page.
  const hits = query.trim().length >= 2 ? await searchSuppliers(query, { limit: 20, includeUnpublished: true }) : [];
  const initialResults: CompanyHit[] = hits.map((hit) => ({ slug: hit.slug, name: hit.name, companyNumber: hit.companyNumber, locality: hit.locality, awardsCount: hit.awardsCount, isPublic: hit.isPublic }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Find your company</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search the suppliers named in published contract awards. Your radar is built from the awards of the company you pick.</p>
      </div>
      <CompanySearch
        key={query}
        initialQuery={query}
        initialResults={initialResults}
        resultHref="claim"
        endpoint="/api/procurement/search?scope=all"
        action="/app/radar/find"
        manualHref="/app/radar/setup"
        actionLabel="This is my company"
      />
      <div className="rounded-lg border bg-card p-4 text-sm">
        <p className="font-medium">We haven&apos;t won public contracts yet</p>
        <p className="mt-1 text-muted-foreground">Describe your trade and regions instead, and get the same radar.</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/app/radar/setup">Set up a radar manually</Link>
        </Button>
      </div>
    </div>
  );
}
