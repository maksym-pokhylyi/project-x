import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { site } from "@/config/site";
import { builtFromNotices, DataHeader, DataMain, SourceFooter } from "@/features/procurement/components/public-chrome";
import { BuyersSection, OpenTendersSection, RivalsSection, SupplierAnchors, SupplierClaimCard, SupplierHead, SupplierSections, SupplierStats, WinsSection } from "@/features/procurement/components/supplier-page";
import { procurementConfig } from "@/features/procurement/config";
import { loadSupplierPage, loadSupplierWins } from "@/features/procurement/public-data";
import { hasSupplierLink } from "@/features/procurement/radar/data";
import { cleanRefCode, recordPageVisit } from "@/features/procurement/visits";
import { getUser, requireOrg } from "@/server/session";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ r?: string | string[]; wins?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadSupplierPage(slug);
  if (!data || !data.supplier.isPublic) return { title: "Supplier not found", robots: { index: false } };
  const { supplier } = data;
  const title = `${supplier.name} — public contracts and open tenders`;
  const description = supplier.profile?.summary ?? `Public contract awards published for ${supplier.name}, with open tenders in the same trade.`;
  // Supplier pages launch as noindex; pages with no awards are never indexed.
  const index = procurementConfig.publicDataPagesIndexable && supplier.awardsCount > 0;
  return {
    title,
    description,
    alternates: { canonical: `/suppliers/${supplier.slug}` },
    robots: { index, follow: index },
    openGraph: { title, description, type: "profile", url: `/suppliers/${supplier.slug}`, siteName: site.name },
  };
}

/** Who is looking: a visitor, somebody signed in, or a workspace that has claimed this page. Never throws. */
async function viewer(supplierId: string): Promise<{ signedIn: boolean; claimed: boolean }> {
  try {
    if (!(await getUser())) return { signedIn: false, claimed: false };
    return { signedIn: true, claimed: await hasSupplierLink(await requireOrg(), supplierId) };
  } catch {
    return { signedIn: false, claimed: false };
  }
}

/**
 * Public supplier page (docs/design/handoff: Supplier-1440 / Supplier-390). COMPANY-LEVEL
 * DATA ONLY: see components/supplier-page.tsx. The page renders on the server from cached
 * data; the only script it ships is the shared header link.
 */
export default async function SupplierPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const data = await loadSupplierPage(slug);
  if (!data) notFound();
  const { supplier } = data;
  if (supplier.mergedIntoSlug) permanentRedirect(`/suppliers/${supplier.mergedIntoSlug}${cleanRefCode(query.r) ? `?r=${cleanRefCode(query.r)}` : ""}`); // an outreach link keeps its code, so the visit is still counted
  // Sole traders, unidentified names and removed companies have no public page.
  if (!supplier.isPublic) notFound();

  await recordPageVisit({ pageType: "supplier", entityId: supplier.id, refCode: cleanRefCode(query.r) });
  const { signedIn, claimed } = await viewer(supplier.id);
  const now = new Date();

  // "Show all N contracts": ?wins=all is the first page of fifty, ?wins=2 the second.
  // A number past the end (an old link) is the last page there is.
  const winsParam = Array.isArray(query.wins) ? query.wins[0] : query.wins;
  const showingAll = winsParam === "all" || /^\d{1,3}$/.test(winsParam ?? "");
  const lastWinsPage = Math.max(1, Math.ceil(data.contracts.total / procurementConfig.publicWinsPageSize));
  const winsPage = showingAll && winsParam !== "all" ? Math.min(lastWinsPage, Math.max(1, Number(winsParam))) : 1;
  const wins = showingAll ? await loadSupplierWins(supplier.id, winsPage) : data.contracts;

  return (
    <>
      <DataHeader
        signedIn={signedIn}
        action={
          claimed ? (
            <ButtonLink href="/app">Open your radar</ButtonLink>
          ) : (
            <ButtonLink href="#claim" data-testid="header-claim">
              Claim this page
            </ButtonLink>
          )
        }
      />
      <DataMain>
        <SupplierHead supplier={supplier} updatedAt={data.updatedAt} claim={<SupplierClaimCard supplier={supplier} claimed={claimed} />} />
        <SupplierSections className="mt-5 gap-5 md:mt-9 md:gap-7">
          <SupplierStats supplier={supplier} openTenders={data.matches.total} />
          <SupplierAnchors data={data} />
        </SupplierSections>
        <SupplierSections className="mt-7 md:mt-10">
          <OpenTendersSection data={data} now={now} signedIn={signedIn} claimed={claimed} />
          <WinsSection supplier={supplier} wins={wins} now={now} showingAll={showingAll} page={winsPage} />
          <RivalsSection data={data} now={now} claimed={claimed} />
          <BuyersSection data={data} claimed={claimed} />
        </SupplierSections>
      </DataMain>
      <SourceFooter origin={builtFromNotices(supplier.noticesCount)} pagePath={`/suppliers/${supplier.slug}`} />
    </>
  );
}
