import { Check, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { libraryDocs } from "@/db/schema";
import { BreadcrumbTrail } from "@/components/app/breadcrumbs";
import { getBidAccess, getFreeCheckUse, type BidAccessSummary } from "@/features/bids/access";
import { NewBidForm, type ExistingFile } from "@/features/bids/components/new-bid-form";
import { UpgradePanel } from "@/features/bids/components/upgrade-panel";
import { getBid, listBidFiles } from "@/features/bids/server/bids";
import { factsConfirmed } from "@/features/bids/server/page-data";
import { lookupTender } from "@/features/bids/server/tender";
import { cleanTenderReference } from "@/features/bids/tender-lookup";
import { NotFoundError } from "@/lib/errors";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "New bid check" };
export const dynamic = "force-dynamic";
// Starting the check nudges the worker from a Server Action on this page.
export const maxDuration = 60;

/** What starting this check uses, as the plan card states it: sentence, what is left, and the bar. */
function usage(access: BidAccessSummary): { plan: string; lead: string; rest: string; segments: number; filled: number } | null {
  switch (access.next?.source) {
    case "plan_bid": {
      const limit = access.fullBids.limit;
      const left = access.fullBids.remaining === null ? null : Math.max(0, access.fullBids.remaining - 1);
      return {
        plan: `${access.planName} plan`,
        lead: limit === null ? "Uses 1 full bid." : `Uses 1 of your ${limit} full bids this month.`,
        rest: left === null ? "Your plan has no monthly limit." : `${left} left after this.`,
        segments: limit === null ? 0 : Math.min(limit, 12),
        filled: access.fullBids.used + 1,
      };
    }
    case "plan_brief":
      return { plan: `${access.planName} plan`, lead: "Uses your bid check for this month.", rest: "Drafting and marking need Bid Desk or a Bid Pass.", segments: access.checks.limit ?? 0, filled: access.checks.used + 1 };
    case "free_brief":
      return {
        plan: `${access.planName} plan`,
        lead: "Uses your free bid check.",
        rest: access.bidPasses > 0 ? `You also hold ${access.bidPasses} Bid Pass${access.bidPasses === 1 ? "" : "es"}: apply one afterwards to add drafting and marking.` : "Drafting and marking need Bid Desk or a Bid Pass.",
        segments: 1,
        filled: 1,
      };
    case "credit":
      return { plan: "Bid Pass", lead: `Uses 1 of your ${access.bidPasses} Bid Pass${access.bidPasses === 1 ? "" : "es"}.`, rest: `${access.bidPasses - 1} left after this.`, segments: Math.min(access.bidPasses, 12), filled: 1 };
    default:
      return null;
  }
}

export default async function NewBidPage({ searchParams }: { searchParams: Promise<{ tender?: string; notice?: string; bid?: string }> }) {
  const ctx = await requireOrgForPage({ returnTo: "/app/bids/new" });
  const { tender: tenderParam, notice, bid: draftId } = await searchParams;
  const [access, confirmed, [docCount]] = await Promise.all([
    getBidAccess(ctx.organization.id),
    factsConfirmed(ctx.organization.id),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(libraryDocs)
      .where(and(eq(libraryDocs.organizationId, ctx.organization.id), eq(libraryDocs.status, "ready"))),
  ]);

  // A draft being resumed (refresh during upload, or opened from the list).
  let existing: ExistingFile[] = [];
  let initialBidId: string | null = null;
  // The Radar's "Start a bid check" passes ?tender=<notice id or slug>; ?notice= is the older name.
  let noticeId = cleanTenderReference(tenderParam) ?? cleanTenderReference(notice);
  if (draftId) {
    try {
      const draft = await getBid(ctx, draftId);
      if (draft.status !== "draft") redirect(`/app/bids/${draft.id}`);
      initialBidId = draft.id;
      noticeId = noticeId ?? draft.noticeId;
      existing = (await listBidFiles(ctx, draft.id)).map((file) => ({ id: file.id, name: file.name, size: file.size }));
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }
  const tender = noticeId ? await lookupTender(noticeId) : null;
  const freeCheckUse = access.next ? null : await getFreeCheckUse(ctx.organization.id);
  const plan = usage(access);
  const documents = docCount?.count ?? 0;
  const full = access.next?.level === "full";

  return (
    <div className="bid-scope flex flex-col">
      <BreadcrumbTrail items={[{ label: "Bids", href: "/app/bids" }, { label: "New bid check" }]} />
      <h1 className="bid-h1">New bid check</h1>
      <p className="mt-2 max-w-[760px] text-[17px] leading-[1.45]">Upload the tender pack as the buyer sent it. You get every requirement quoted and cited, checked against your company, with a plain verdict.</p>


      <div className="mt-9 flex flex-wrap items-start gap-x-8 gap-y-10">
        <div className="min-w-0 flex-[999_1_640px]">
          <NewBidForm
            notice={access.next ? null : <UpgradePanel access={access} moment="none_left" freeCheckUse={freeCheckUse} tenderClosesAt={tender?.closesAt ?? null} />}
            initialBidId={initialBidId}
            initialFiles={existing}
            noticeId={noticeId}
            tender={tender ? { ...tender, closesAt: tender.closesAt ? tender.closesAt.toISOString() : null } : null}
            disabled={!access.next}
          />
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <section aria-labelledby="get-h" className="bid-card px-5 py-5">
            <h2 id="get-h" className="bid-h3">
              What you get
            </h2>
            <ul className="mt-3 flex flex-col gap-3 text-[15px]">
              {[
                <>Every requirement quoted word for word, with file and page</>,
                <>
                  Each one checked against {confirmed ? "your confirmed company facts" : "your company facts, once you confirm them"}
                  {documents > 0 ? ` and ${documents} company document${documents === 1 ? "" : "s"}` : ""} ·{" "}
                  <Link href="/app/library" className="bid-link">
                    Documents
                  </Link>
                </>,
                <>A plain, cautious verdict on where you stand</>,
                full ? <>The scored questions, drafts and marking, as part of this full bid</> : <>The scored questions listed. Drafting and marking need Bid Desk or a Bid Pass.</>,
              ].map((item, index) => (
                <li key={index} className="flex gap-2.5">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-(--bid-brand)" strokeWidth={2.4} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-(--bid-line) pt-3 text-[13px]">
              <Link href="/sample-check" className="bid-link font-medium">
                See a sample check
              </Link>{" "}
              built from a council&rsquo;s published pack.
            </p>
          </section>

          {plan ? (
            <section aria-label="What this uses" className="bid-card flex flex-col gap-2.5 px-5 py-5" data-testid="allowance-note">
              <span className="text-xs text-(--bid-muted)">{plan.plan}</span>
              <p className="text-[15px]">
                <span className="font-semibold">{plan.lead}</span> {plan.rest}
              </p>
              {plan.segments > 0 ? (
                <div role="img" aria-label={`${Math.min(plan.filled, plan.segments)} of ${plan.segments} used with this check`} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${plan.segments}, minmax(0, 1fr))` }}>
                  {Array.from({ length: plan.segments }, (_, index) => (
                    <span key={index} className={`h-1.5 rounded-[3px] ${index < plan.filled ? "bg-(--bid-ink)" : "bg-(--bid-line)"}`} />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <p className="flex gap-2.5 px-1 text-[13px] text-(--bid-muted)">
            <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            Stored in the EU (Frankfurt), encrypted in transit and at rest, never used to train AI models.
          </p>
        </aside>
      </div>

      <footer className="mt-16 rounded-[10px] bg-(--bid-paper-deep) px-5 py-4 text-[13px] text-(--bid-muted)">
        A bid check is built from the documents you upload. It is an aid to reading the pack, not a substitute for it. Bidfolio is an independent service and is not affiliated with the buyer or the UK Government.
      </footer>
    </div>
  );
}
