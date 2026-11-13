import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";
import { DataAttribution } from "@/features/procurement/components/data-attribution";
import { recordDigestClick } from "@/features/notifications/clicks";
import { TenderDetailView } from "@/features/procurement/components/tender-detail";
import { formatDate } from "@/features/procurement/domain/format";
import { formatMoneyShort } from "@/features/procurement/domain/money";
import { loadTenderPage } from "@/features/procurement/public-data";
import { cleanRefCode, recordPageVisit } from "@/features/procurement/visits";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ r?: string | string[]; d?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tender = await loadTenderPage(id);
  if (!tender) return { title: "Tender not found", robots: { index: false } };
  const title = `${tender.title.slice(0, 90)} — ${tender.buyerName ?? "public tender"}`;
  const parts = [
    tender.buyerName,
    formatMoneyShort(tender.valueAmount, tender.currency),
    tender.isLive && tender.deadlineAt ? `closes ${formatDate(tender.deadlineAt)}` : null,
  ].filter(Boolean);
  const description = `${parts.join(" · ")}. ${(tender.description ?? "").replace(/\s+/g, " ").slice(0, 160)}`.trim();
  return {
    title,
    description,
    alternates: { canonical: `/tenders/${tender.ocid}` },
    // Only open tenders are worth indexing; closed and awarded procurements stay reachable but unindexed.
    robots: { index: tender.isLive, follow: true },
    openGraph: { title, description, type: "article", url: `/tenders/${tender.ocid}`, siteName: site.name },
  };
}

/** Public tender page: a summary of one procurement with a link to the source on Find a Tender. */
export default async function TenderPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tender = await loadTenderPage(id);
  if (!tender) notFound();
  // The canonical id is the ocid; a Find a Tender notice id redirects to it.
  if (id !== tender.ocid) permanentRedirect(`/tenders/${tender.ocid}${cleanRefCode(query.r) ? `?r=${cleanRefCode(query.r)}` : ""}`); // a link with a code keeps it, so the visit is still counted
  await recordPageVisit({ pageType: "tender", entityId: tender.ocid, refCode: cleanRefCode(query.r) });
  await recordDigestClick({ ocid: tender.ocid, notification: query.d }); // opened from a scheduled e-mail (?d=…)
  const now = new Date();
  const live = tender.stage === "tender" && tender.deadlineAt !== null && Date.parse(tender.deadlineAt) > now.getTime() && tender.isLive;

  return (
    <div className="space-y-10">
      <TenderDetailView
        tender={tender}
        now={now}
        actions={
          live ? (
            <>
              <Button asChild size="lg">
                <Link href={`/app/bids/new?notice=${encodeURIComponent(tender.ocid)}`}>Start a bid</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/free-bid-brief">Get a free bid brief</Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" size="lg">
              <Link href="/find">Find tenders that match your company</Link>
            </Button>
          )
        }
      />

      <section aria-label="What Bidfolio does" className="rounded-lg border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Deciding whether to bid?</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Upload the tender pack and get a brief with every pass/fail requirement quoted from the documents, the scoring model and the questions you must answer.
          The first brief is free.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/free-bid-brief">Get a free bid brief</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/find">Find your company</Link>
          </Button>
        </div>
      </section>

      <DataAttribution pagePath={`/tenders/${tender.ocid}`} />
    </div>
  );
}
