import type { Metadata } from "next";
import { BreadcrumbTrail } from "@/components/app/breadcrumbs";
import { FindBody } from "@/features/procurement/components/find-page";
import { AppSourceNote } from "@/features/procurement/components/public-chrome";
import { searchSuppliers } from "@/features/procurement/queries/suppliers";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "Find your company" };

/** "Find your company" inside the app: pick the record that is you, then confirm the claim. The search also covers suppliers without a public page. */
export default async function RadarFindPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; manual?: string | string[] }> }) {
  await requireOrgForPage({ returnTo: "/app/radar/find" });
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = raw?.slice(0, 120) ?? "";
  const hits = query.trim().length >= 2 ? await searchSuppliers(query, { limit: 20, includeUnpublished: true }) : [];

  return (
    <div className="flex flex-col">
      <BreadcrumbTrail items={[{ label: "Radar", href: "/app" }, { label: "Find your company" }]} />
      <FindBody
        action="/app/radar/find"
        query={query}
        hits={hits}
        manual={(Array.isArray(params.manual) ? params.manual[0] : params.manual) === "1"}
        signedIn
        manualHref="/app/radar/find?manual=1#manual"
        title={<h1 className="type-title text-ink">Find your company</h1>}
      />
      <AppSourceNote />
    </div>
  );
}
