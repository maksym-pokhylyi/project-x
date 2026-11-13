import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { site } from "@/config/site";
import { FindBody } from "@/features/procurement/components/find-page";
import { DataMain, LegalFooter } from "@/features/procurement/components/public-chrome";
import { searchSuppliers } from "@/features/procurement/queries/suppliers";
import { getUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Find your company",
  description: "Search by company name or Companies House number to see your public contract wins, the open tenders that match them and the rival contracts ending soon.",
  alternates: { canonical: "/find" },
  openGraph: { title: `Find your company · ${site.name}`, description: "See the public contracts you have won and the open tenders that match them.", url: "/find" },
};

/**
 * Find your company (docs/design/handoff: Find, FindNoResult). A GET form: the search works
 * without script and its address can be shared. `?manual=1` opens the manual set-up form.
 */
export default async function FindPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; manual?: string | string[] }> }) {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = raw?.slice(0, 120) ?? "";
  const hits = query.trim().length >= 2 ? await searchSuppliers(query, { limit: 20 }) : [];
  const signedIn = Boolean(await getUser());

  return (
    <>
      <SiteHeader />
      <DataMain variant="task">
        <FindBody
          action="/find"
          query={query}
          hits={hits}
          manual={(Array.isArray(params.manual) ? params.manual[0] : params.manual) === "1"}
          signedIn={signedIn}
          manualHref="/find?manual=1#manual"
          title={<h1 className="type-h1 text-ink">Find your company</h1>}
        />
      </DataMain>
      <LegalFooter />
    </>
  );
}
