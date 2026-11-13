import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BreadcrumbTrail } from "@/components/app/breadcrumbs";
import { AppSourceNote } from "@/features/procurement/components/public-chrome";
import { TenderView } from "@/features/procurement/components/tender-detail";
import { getSimilarAwardsFromBuyer } from "@/features/procurement/queries/contracts";
import { getMatchForNotice } from "@/features/procurement/queries/matches";
import { getTender } from "@/features/procurement/queries/notices";
import { getRadarItemStates, listRadarSources, pickSource, specForSource } from "@/features/procurement/radar/data";
import { requireOrgForPage } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const tender = await getTender((await params).id);
  return { title: tender ? tender.title.slice(0, 80) : "Tender" };
}

/**
 * A tender inside the app (docs/design/handoff: TenderSignedIn): the public facts, plus why
 * it matches the workspace's radar, who won similar work from this buyer, and Save with its
 * real state. `?profile=` picks the radar it is matched against when the workspace has several.
 */
export default async function AppTenderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ profile?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const ctx = await requireOrgForPage({ returnTo: `/app/tenders/${id}` });
  const now = new Date();
  const tender = await getTender(id, now);
  if (!tender) notFound();
  if (id !== tender.ocid) redirect(`/app/tenders/${tender.ocid}`);

  const profile = Array.isArray(query.profile) ? query.profile[0] : query.profile;
  const [states, sources] = await Promise.all([getRadarItemStates(ctx), listRadarSources(ctx)]);
  const active = pickSource(sources, profile);
  const spec = active ? await specForSource(active) : null;
  const [match, similar] = await Promise.all([
    spec ? getMatchForNotice(spec, tender.ocid, now) : Promise.resolve(null),
    tender.buyerId ? getSimilarAwardsFromBuyer(tender.buyerId, tender.cpvCodes, { now, excludeOcid: tender.ocid }) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col">
      {/* The shell draws the way back: "‹ Radar" on a phone, the trail on a desk. */}
      <BreadcrumbTrail items={[{ label: "Radar", href: "/app" }, { label: "Tender" }]} />
      <TenderView
        tender={tender}
        now={now}
        viewer={{
          kind: "member",
          saved: states.get(tender.ocid) === "saved",
          match,
          similar,
          ownSupplierIds: sources.flatMap((source) => (source.kind === "supplier" ? [source.supplierId] : [])),
        }}
      />
      <AppSourceNote />
    </div>
  );
}
