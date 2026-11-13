import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";
import { DataAttribution } from "@/features/procurement/components/data-attribution";
import { BuyerCard, ContractsTable, EndingSoonCard } from "@/features/procurement/components/lists";
import { EmptyState, Money, MoreCount, SectionHeading, StatBlock } from "@/features/procurement/components/primitives";
import { TenderCard } from "@/features/procurement/components/tender-card";
import { procurementConfig } from "@/features/procurement/config";
import { cpvDivisionLabel } from "@/features/procurement/domain/cpv";
import { formatDate, formatMonth, pluralise } from "@/features/procurement/domain/format";
import { formatMoneyShort } from "@/features/procurement/domain/money";
import { regionsLabel } from "@/features/procurement/domain/regions";
import { loadSupplierPage } from "@/features/procurement/public-data";
import { hasSupplierLink } from "@/features/procurement/radar/data";
import { cleanRefCode, recordPageVisit } from "@/features/procurement/visits";
import { getUser, requireOrg } from "@/server/session";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ r?: string | string[] }> };

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

/** Is the signed-in viewer's workspace already linked to this supplier? Never throws. */
async function viewerHasClaimed(supplierId: string): Promise<boolean> {
  try {
    if (!(await getUser())) return false;
    return await hasSupplierLink(await requireOrg(), supplierId);
  } catch {
    return false;
  }
}

/**
 * Public supplier page (DESIGN.md §6, SPEC §3.2). COMPANY-LEVEL DATA ONLY: nothing on this
 * page comes from supplier_contacts, and no contact name, e-mail address or telephone
 * number is rendered.
 */
export default async function SupplierPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const data = await loadSupplierPage(slug);
  if (!data) notFound();
  const { supplier } = data;
  if (supplier.mergedIntoSlug) permanentRedirect(`/suppliers/${supplier.mergedIntoSlug}`);
  // Sole traders, unidentified names and removed companies have no public page.
  if (!supplier.isPublic) notFound();

  await recordPageVisit({ pageType: "supplier", entityId: supplier.id, refCode: cleanRefCode(query.r) });
  const claimed = await viewerHasClaimed(supplier.id);
  const now = new Date();
  const claimHref = `/claim/${supplier.slug}`;
  const profile = supplier.profile;
  const trades = (profile?.cpvDivisions ?? []).slice(0, 2).map((division) => cpvDivisionLabel(division));
  const where = regionsLabel((profile?.regions ?? []).filter((region) => region !== "UK").slice(0, 3));
  const single = supplier.awardsCount === 1;
  const cta = claimed ? (
    <Button asChild size="lg">
      <Link href="/app">Open your radar</Link>
    </Button>
  ) : (
    <Button asChild size="lg">
      <Link href={claimHref} data-testid="claim-cta">
        Claim this page
      </Link>
    </Button>
  );

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Supplier · compiled from public contract notices</p>
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-4xl">{supplier.name}</h1>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {supplier.companyNumber ? (
            <span>
              Company number <span className="font-mono text-foreground">{supplier.companyNumber}</span>
            </span>
          ) : null}
          {supplier.locality ? <span>{supplier.locality}</span> : null}
          {trades.length > 0 ? <span>{trades.join(" · ")}</span> : null}
        </p>
        {profile?.summary ? <p className="max-w-prose text-base text-muted-foreground">{profile.summary}</p> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {cta}
          <Button asChild variant="outline" size="lg">
            <Link href="/free-bid-brief">Get a free bid brief</Link>
          </Button>
        </div>
        <p className="max-w-prose text-xs text-muted-foreground">
          This page is compiled by {site.name} from notices on Find a Tender. It is not the company&apos;s own page or an official record.
          {claimed ? " Your workspace is linked to this company." : " If this is your company, claim it to see every match and get alerts."}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <StatBlock
          value={supplier.awardsCount.toLocaleString("en-GB")}
          label={single ? "Contract" : "Contracts"}
          context={supplier.firstAwardAt ? `published since ${formatMonth(supplier.firstAwardAt)}` : undefined}
        />
        <StatBlock
          value={formatMoneyShort(supplier.totalValue) ?? "—"}
          label="Published value"
          context={supplier.totalValue > 0 ? "awards attributed to this supplier alone" : "values not published or shared between suppliers"}
        />
        <StatBlock value={supplier.buyersCount.toLocaleString("en-GB")} label={supplier.buyersCount === 1 ? "Buyer" : "Buyers"} context={where ?? undefined} />
        <StatBlock value={data.matches.total.toLocaleString("en-GB")} label="Open tenders in this trade" context="updated hourly" />
      </dl>

      <section aria-labelledby="matches" className="space-y-4">
        <SectionHeading
          id="matches"
          title="Open tenders like the ones you've won"
          count={data.matches.total}
          description="Live tender notices in the same CPV categories, ranked by how closely they match this company's awards, region and contract size."
        />
        {data.matches.items.length > 0 ? (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              {data.matches.items.map((item) => (
                <TenderCard key={item.ocid} item={item} href={`/tenders/${item.ocid}`} now={now} />
              ))}
            </div>
            {claimed ? (
              data.matches.total > data.matches.items.length ? (
                <p className="text-sm">
                  <Link href="/app" className="font-medium text-primary underline underline-offset-4">
                    See all {data.matches.total} matches on your radar
                  </Link>
                </p>
              ) : null
            ) : (
              <MoreCount hidden={data.matches.total - data.matches.items.length} noun="matching open tenders" href={claimHref} cta="Claim this page to see them all" />
            )}
          </>
        ) : (
          <EmptyState
            title="No open tenders match this company's awards right now"
            action={
              <Button asChild variant="outline">
                <Link href={claimed ? "/app" : claimHref}>{claimed ? "Open your radar" : "Claim this page to get an alert"}</Link>
              </Button>
            }
          >
            New tender notices are published every working day. We check them against this company&apos;s contract history every ten minutes.
          </EmptyState>
        )}
      </section>

      <section aria-labelledby="ending" className="space-y-4">
        <SectionHeading
          id="ending"
          title="Contracts ending soon in your trade"
          count={data.endingSoon.total}
          description="Other suppliers' contracts in the same trade whose stated end date falls in the next nine months. Buyers usually re-tender before then."
        />
        {data.endingSoon.items.length > 0 ? (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              {data.endingSoon.items.map((item) => (
                <EndingSoonCard key={`${item.ocid}:${item.supplierId}`} item={item} now={now} />
              ))}
            </div>
            {claimed ? null : <MoreCount hidden={data.endingSoon.total - data.endingSoon.items.length} noun="contracts ending soon" href={claimHref} cta="Claim this page to see them all" />}
          </>
        ) : (
          <EmptyState title="No contracts in this trade have a published end date in the next nine months" />
        )}
        {data.renewals.length > 0 ? (
          <div className="rounded-lg border bg-muted/40 p-4">
            <h3 className="text-sm font-semibold">This company&apos;s own contracts with an end date in the next 12 months</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {data.renewals.map((contract) => (
                <li key={contract.ocid} className="flex flex-wrap gap-x-2">
                  <span className="font-medium">{contract.title}</span>
                  <span className="text-muted-foreground">
                    {contract.buyerName} · end date stated in the notice: {formatDate(contract.contractEnd)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="buyers" className="space-y-4">
        <SectionHeading
          id="buyers"
          title="Buyers awarding in your trade"
          count={data.buyers.total}
          description="Public bodies that awarded contracts in the same trade in the last 24 months, and how many of those went out without an open tender."
        />
        {data.buyers.items.length > 0 ? (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              {data.buyers.items.map((item) => (
                <BuyerCard key={item.buyerId} item={item} />
              ))}
            </div>
            {claimed ? null : <MoreCount hidden={data.buyers.total - data.buyers.items.length} noun="buyers in this trade" href={claimHref} cta="Claim this page to see them all" />}
          </>
        ) : (
          <EmptyState title="No other awards in this trade have been published in the last 24 months" />
        )}
      </section>

      <section aria-labelledby="awards" className="space-y-4">
        <SectionHeading
          id="awards"
          title={single ? "Published contract award" : "Published contract awards"}
          count={data.contracts.total}
          description={
            <>
              As published by each buyer on Find a Tender; not verified by {site.name}.{" "}
              {supplier.totalValue > 0 ? (
                <>
                  Total attributed value <Money amount={supplier.totalValue} />.
                </>
              ) : null}
            </>
          }
        />
        {data.contracts.items.length > 0 ? (
          <>
            <ContractsTable items={data.contracts.items} caption={`Contract awards published for ${supplier.name}`} />
            {data.contracts.total > data.contracts.items.length ? (
              <p className="text-sm text-muted-foreground">
                Showing the {data.contracts.items.length} most recent of {pluralise(data.contracts.total, "contract")}.
              </p>
            ) : null}
          </>
        ) : (
          <EmptyState title="No contract awards are currently published for this company" />
        )}
      </section>

      {claimed ? null : (
        <section aria-label="Claim this page" className="rounded-lg border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Is this your company?</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Claim the page to see every matching tender with deadlines, the contracts ending in your trade and the buyers behind them — free. One free bid brief
            is included.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href={claimHref}>Claim this page</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/free-bid-brief">Get a free bid brief</Link>
            </Button>
          </div>
        </section>
      )}

      <DataAttribution pagePath={`/suppliers/${supplier.slug}`} />
    </div>
  );
}
