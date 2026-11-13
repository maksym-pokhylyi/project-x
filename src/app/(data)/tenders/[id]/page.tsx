import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { site } from "@/config/site";
import { recordDigestClick } from "@/features/notifications/clicks";
import { DataHeader, DataMain, SourceFooter } from "@/features/procurement/components/public-chrome";
import { TenderView } from "@/features/procurement/components/tender-detail";
import { ActionBand } from "@/features/procurement/components/ui/action-band";
import { formatDate } from "@/features/procurement/domain/format";
import { formatMoneyShort } from "@/features/procurement/domain/money";
import { loadTenderPage } from "@/features/procurement/public-data";
import { cleanRefCode, recordPageVisit } from "@/features/procurement/visits";
import { getUser } from "@/server/session";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ r?: string | string[]; d?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tender = await loadTenderPage(id);
  if (!tender) return { title: "Tender not found", robots: { index: false } };
  const title = `${tender.title.slice(0, 90)} — ${tender.buyerName ?? "public tender"}`;
  const parts = [tender.buyerName, formatMoneyShort(tender.valueAmount, tender.currency), tender.isLive && tender.deadlineAt ? `closes ${formatDate(tender.deadlineAt)}` : null].filter(Boolean);
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

/**
 * Public tender page (docs/design/handoff: Tender-1440 / Tender-390): one procurement, read
 * from its notice, with the way to the official notice always in sight. A signed-in viewer
 * is offered the same tender inside the app, where it is matched against their radar.
 */
export default async function TenderPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tender = await loadTenderPage(id);
  if (!tender) notFound();
  // The canonical id is the ocid; a Find a Tender notice id redirects to it.
  if (id !== tender.ocid) permanentRedirect(`/tenders/${tender.ocid}${cleanRefCode(query.r) ? `?r=${cleanRefCode(query.r)}` : ""}`); // a link with a code keeps it, so the visit is still counted
  await recordPageVisit({ pageType: "tender", entityId: tender.ocid, refCode: cleanRefCode(query.r) });
  await recordDigestClick({ ocid: tender.ocid, notification: query.d }); // opened from a scheduled e-mail (?d=…)
  const signedIn = Boolean(await getUser());
  const now = new Date();

  return (
    <>
      <DataHeader
        signedIn={signedIn}
        phone="action"
        action={
          <ButtonLink href="/find" className="max-md:px-3 max-md:text-sm">
            Find your company
          </ButtonLink>
        }
      />
      <DataMain>
        <TenderView
          tender={tender}
          now={now}
          viewer={{ kind: "visitor" }}
          after={
            signedIn ? (
              <ActionBand
                className="mt-10"
                headingLevel="h2"
                title="See how this matches your radar"
                actions={
                  <ButtonLink variant="outline" href={`/app/tenders/${tender.ocid}`} className="max-md:w-full">
                    Open it in your radar
                  </ButtonLink>
                }
              >
                Inside your radar this tender is checked against your contract wins, and you can save it.
              </ActionBand>
            ) : (
              <ActionBand
                className="mt-10"
                headingLevel="h2"
                title="Could you win this?"
                actions={
                  <ButtonLink variant="outline" href="/find" className="max-md:w-full" data-testid="find-company-cta">
                    Find your company
                  </ButtonLink>
                }
              >
                Find your company to see how this tender matches your past work.
              </ActionBand>
            )
          }
        />
      </DataMain>
      <SourceFooter origin="Taken from the notice published on Find a Tender." pagePath={`/tenders/${tender.ocid}`} />
    </>
  );
}
