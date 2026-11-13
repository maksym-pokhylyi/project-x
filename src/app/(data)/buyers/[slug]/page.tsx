import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { site } from "@/config/site";
import { BuyerAnchors, BuyerAwards, BuyerBand, BuyerEarlyNotices, BuyerHead, BuyerOpenTenders, BuyerStats } from "@/features/procurement/components/buyer-page";
import { builtFromNotices, DataHeader, DataMain, SourceFooter } from "@/features/procurement/components/public-chrome";
import { SupplierSections } from "@/features/procurement/components/supplier-page";
import { procurementConfig } from "@/features/procurement/config";
import { pluralise } from "@/features/procurement/domain/format";
import { loadBuyerPage } from "@/features/procurement/public-data";
import { cleanRefCode, recordPageVisit } from "@/features/procurement/visits";
import { getUser } from "@/server/session";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ r?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadBuyerPage(slug);
  if (!data) return { title: "Buyer not found", robots: { index: false } };
  const { buyer } = data;
  const title = `${buyer.name} — tenders and contract awards`;
  const description = `Open tenders, early notices and ${pluralise(buyer.awardsCount, "published contract award")} from ${buyer.name}, and how it awards: open tender, invited quotes or direct award.`;
  const index = procurementConfig.publicDataPagesIndexable && buyer.noticesCount > 0;
  return {
    title,
    description,
    alternates: { canonical: `/buyers/${buyer.slug}` },
    robots: { index, follow: index },
    openGraph: { title, description, type: "website", url: `/buyers/${buyer.slug}`, siteName: site.name },
  };
}

/** Public page of a buyer: what it has open, how it awards, whom it has awarded to. */
export default async function BuyerPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const data = await loadBuyerPage(slug);
  if (!data) notFound();
  const { buyer } = data;
  if (buyer.mergedIntoSlug) permanentRedirect(`/buyers/${buyer.mergedIntoSlug}`);
  await recordPageVisit({ pageType: "buyer", entityId: buyer.id, refCode: cleanRefCode(query.r) });
  const signedIn = Boolean(await getUser());
  const now = new Date();

  return (
    <>
      <DataHeader signedIn={signedIn} action={<ButtonLink href="/find">Find your company</ButtonLink>} />
      <DataMain>
        <BuyerHead data={data} />
        <SupplierSections className="mt-5 gap-5 md:mt-9 md:gap-7">
          <BuyerStats data={data} />
          <BuyerAnchors data={data} />
        </SupplierSections>
        <SupplierSections className="mt-7 md:mt-10">
          <BuyerOpenTenders data={data} now={now} signedIn={signedIn} />
          <BuyerEarlyNotices data={data} now={now} signedIn={signedIn} />
          <BuyerAwards data={data} />
          <BuyerBand />
        </SupplierSections>
      </DataMain>
      <SourceFooter origin={builtFromNotices(buyer.noticesCount)} pagePath={`/buyers/${buyer.slug}`} />
    </>
  );
}
