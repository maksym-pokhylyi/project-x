import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";
import { DataAttribution } from "@/features/procurement/components/data-attribution";
import { ContractsTable } from "@/features/procurement/components/lists";
import { EmptyState, SectionHeading, StatBlock } from "@/features/procurement/components/primitives";
import { TenderCard } from "@/features/procurement/components/tender-card";
import { procurementConfig } from "@/features/procurement/config";
import { formatDate, pluralise } from "@/features/procurement/domain/format";
import { formatMoneyShort } from "@/features/procurement/domain/money";
import { regionLabel } from "@/features/procurement/domain/regions";
import { loadBuyerPage } from "@/features/procurement/public-data";
import { cleanRefCode, recordPageVisit } from "@/features/procurement/visits";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ r?: string | string[] }> };

const BUYER_TYPES: Record<string, string> = {
  publicAuthorityCentralGovernment: "Central government",
  publicAuthoritySubCentralGovernment: "Local or regional public body",
  publicUndertaking: "Public undertaking",
  privateUtility: "Private utility",
  BODY_PUBLIC: "Body governed by public law",
  REGIONAL_AUTHORITY: "Regional or local authority",
  MINISTRY: "Central government",
  NATIONAL_AGENCY: "National agency",
  REGIONAL_AGENCY: "Regional agency",
};

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

export default async function BuyerPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const data = await loadBuyerPage(slug);
  if (!data) notFound();
  const { buyer, mix } = data;
  if (buyer.mergedIntoSlug) permanentRedirect(`/buyers/${buyer.mergedIntoSlug}${cleanRefCode(query.r) ? `?r=${cleanRefCode(query.r)}` : ""}`); // a link with a code keeps it, so the visit is still counted
  await recordPageVisit({ pageType: "buyer", entityId: buyer.id, refCode: cleanRefCode(query.r) });
  const now = new Date();
  const withoutOpen = mix.direct + mix.limited;
  const type = buyer.buyerType ? BUYER_TYPES[buyer.buyerType] : null;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Buyer · compiled from public contract notices</p>
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-4xl">{buyer.name}</h1>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {type ? <span>{type}</span> : null}
          {buyer.locality ? <span>{buyer.locality}</span> : null}
          {buyer.region && regionLabel(buyer.region) ? <span>{regionLabel(buyer.region)}</span> : null}
          {buyer.lastNoticeAt ? <span>Last notice {formatDate(buyer.lastNoticeAt)}</span> : null}
        </p>
        <p className="max-w-prose text-xs text-muted-foreground">
          This page is compiled by {site.name} from notices on Find a Tender. It is not the buyer&apos;s own page or an official record.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <StatBlock value={data.live.length.toLocaleString("en-GB")} label="Open tenders" context="deadline still ahead" />
        <StatBlock value={buyer.awardsCount.toLocaleString("en-GB")} label="Contracts awarded" context={formatMoneyShort(buyer.awardsValue) ? `${formatMoneyShort(buyer.awardsValue)} published value` : "in published notices"} />
        <StatBlock
          value={mix.awards > 0 ? `${Math.round((withoutOpen / mix.awards) * 100)}%` : "—"}
          label="Awarded without an open tender"
          context={mix.awards > 0 ? `${withoutOpen} of ${mix.awards} in the last 24 months` : "no awards in the last 24 months"}
        />
        <StatBlock value={data.planning.length.toLocaleString("en-GB")} label="Early notices" context="pipeline and market engagement" />
      </dl>

      <section aria-labelledby="live" className="space-y-4">
        <SectionHeading id="live" title="Open tenders" count={data.live.length} description="Tender notices from this buyer with a deadline still ahead." />
        {data.live.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.live.map((item) => (
              <TenderCard key={item.ocid} item={item} href={`/tenders/${item.ocid}`} now={now} />
            ))}
          </div>
        ) : (
          <EmptyState title="This buyer has no open tenders right now">Its past awards below show what it buys and how.</EmptyState>
        )}
      </section>

      {data.planning.length > 0 ? (
        <section aria-labelledby="planning" className="space-y-4">
          <SectionHeading id="planning" title="Early notices" count={data.planning.length} description="Pipeline, market-engagement and planned-procurement notices that have not reached a tender yet." />
          <div className="grid gap-3 lg:grid-cols-2">
            {data.planning.map((item) => (
              <TenderCard key={item.ocid} item={item} href={`/tenders/${item.ocid}`} now={now} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="awards" className="space-y-4">
        <SectionHeading
          id="awards"
          title="Recent contract awards"
          count={data.contracts.total}
          description={
            mix.awards > 0
              ? `In the last 24 months: ${mix.open} after an open tender, ${mix.limited} after inviting selected suppliers, ${mix.direct} awarded directly, ${mix.framework} called off a framework${mix.unknown ? `, ${mix.unknown} not stated` : ""}.`
              : "As published on Find a Tender."
          }
        />
        {data.contracts.items.length > 0 ? (
          <ContractsTable items={data.contracts.items} showBuyer={false} showSupplier caption={`Contracts awarded by ${buyer.name}`} />
        ) : (
          <EmptyState title="No contract awards are published for this buyer yet" />
        )}
      </section>

      <section aria-label="Find your company" className="rounded-lg border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Supply this buyer, or want to?</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">Find your company to see the open tenders that match what you have already won, and the contracts in your trade that end soon.</p>
        <div className="mt-4">
          <Button asChild>
            <Link href="/find">Find your company</Link>
          </Button>
        </div>
      </section>

      <DataAttribution pagePath={`/buyers/${buyer.slug}`} />
    </div>
  );
}
