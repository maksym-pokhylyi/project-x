import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataAttribution } from "@/features/procurement/components/data-attribution";
import { TenderActions } from "@/features/procurement/components/radar-actions";
import { TenderDetailView } from "@/features/procurement/components/tender-detail";
import { getTender } from "@/features/procurement/queries/notices";
import { getRadarItemStates } from "@/features/procurement/radar/data";
import { requireOrgForPage } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const tender = await getTender((await params).id);
  return { title: tender ? tender.title.slice(0, 80) : "Tender" };
}

/** Tender detail inside the app: the same facts as the public page, plus Save and Start a bid. */
export default async function AppTenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgForPage({ returnTo: `/app/tenders/${id}` });
  const tender = await getTender(id);
  if (!tender) notFound();
  if (id !== tender.ocid) redirect(`/app/tenders/${tender.ocid}`);
  const states = await getRadarItemStates(ctx);
  const now = new Date();

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/app">← Back to radar</Link>
      </Button>
      <TenderDetailView
        tender={tender}
        now={now}
        actions={
          <div className="flex flex-wrap items-center gap-2" data-testid="tender-actions">
            <TenderActions ocid={tender.ocid} state={states.get(tender.ocid) ?? null} canBid={tender.isLive} />
          </div>
        }
      />
      {tender.isLive ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          Start a bid to upload the tender pack: you get a brief with every pass/fail requirement quoted from the documents, the scoring model and the questions
          to answer.
        </p>
      ) : (
        <p className="max-w-prose text-sm text-muted-foreground">This procurement is not open for tenders{tender.stage === "planning" ? " yet. Save it and we will keep it on your radar." : "."}</p>
      )}
      <DataAttribution pagePath={`/tenders/${tender.ocid}`} />
    </div>
  );
}
