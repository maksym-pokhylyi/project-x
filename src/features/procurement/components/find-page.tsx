import Link from "next/link";
import type { ReactNode } from "react";
import type { SupplierHit } from "../queries/suppliers";
import type { RadarSelection } from "../radar/selection";
import { CompanyResults, CompanySearchForm } from "./company-search";
import { ManualRadarForm } from "./manual-radar-form";

/**
 * "Find your company", as the Find and FindNoResult artboards draw it — the same body on the
 * public page (/find) and inside the app (/app/radar/find):
 *
 *   nothing typed     the search row and one sentence on what a company's page holds
 *   results           "N companies match …", one row per company
 *   no result         "No company matches …" and the manual set-up form, pre-filled with
 *                     what was typed
 *   ?manual=1         the manual set-up form on its own (a company with no contracts yet)
 */

/** The card that holds the manual set-up form, under its serif heading. */
export function ManualRadarCard({ selection, signedIn, children }: { selection: RadarSelection; signedIn: boolean; children?: ReactNode }) {
  return (
    <section id="manual" aria-labelledby="manual-h" className="flex scroll-mt-24 flex-col gap-6 rounded-card border border-line bg-surface p-5 md:p-7" data-testid="manual-radar">
      <h2 id="manual-h" className="type-h3 text-ink">
        Set up a radar manually
      </h2>
      {children}
      <ManualRadarForm selection={selection} signedIn={signedIn} headingId="manual-h" />
    </section>
  );
}

export function FindBody({
  action,
  query,
  hits,
  manual,
  signedIn,
  manualHref,
  title,
}: {
  /** The page itself: where the search submits. */
  action: string;
  query: string;
  hits: SupplierHit[];
  /** Show the manual set-up form without a search. */
  manual: boolean;
  signedIn: boolean;
  /** Address of this page with the manual form open. */
  manualHref: string;
  /** The page's h1, in the type role of the page it is on. */
  title: ReactNode;
}) {
  const typed = query.trim();
  const searched = typed.length >= 2;
  const selection: RadarSelection = { name: searched && hits.length === 0 ? typed.slice(0, 80) : "", trades: [], cpv: [], regions: [] };
  return (
    <div className="flex flex-col">
      {title}
      <CompanySearchForm action={action} defaultValue={query} autoFocus={!searched && !manual} className="mt-4 md:mt-6" />
      {typed.length === 1 ? (
        <p role="status" className="mt-3 text-sm text-ink-2">
          Type at least two characters of the name, or the whole Companies House number.
        </p>
      ) : null}

      {searched && hits.length > 0 ? (
        <div className="mt-7 md:mt-10">
          <CompanyResults query={typed} hits={hits} manualHref={manualHref} />
        </div>
      ) : null}

      {searched && hits.length === 0 ? (
        <div className="mt-7 flex flex-col gap-6 md:mt-10 md:gap-8" data-testid="no-result">
          <div className="flex max-w-[45rem] flex-col gap-2.5">
            <h2 className="type-section text-ink [overflow-wrap:anywhere]">No company matches “{typed}”</h2>
            <p className="text-15 text-ink md:type-reading">
              That usually means no notice on Find a Tender names your company yet. You can still set up a radar by choosing your trades and regions, and run a cited bid check on any tender pack.
            </p>
          </div>
          <ManualRadarCard selection={selection} signedIn={signedIn} />
        </div>
      ) : null}

      {!searched && manual ? (
        <div className="mt-7 md:mt-10">
          <ManualRadarCard selection={selection} signedIn={signedIn}>
            <p className="-mt-3 max-w-[45rem] text-15 text-ink">For a company no notice names yet: choose your trades and regions, and the radar shows the open tenders that match them.</p>
          </ManualRadarCard>
        </div>
      ) : null}

      {!searched && !manual ? (
        <div className="mt-6 flex max-w-[45rem] flex-col gap-3 text-ink">
          <p className="text-15 md:type-reading">If your company has won a public contract, it already has a page: your contract wins, the open tenders like them and the rival contracts that end soon.</p>
          <p className="text-sm text-ink-2">
            No public contracts yet?{" "}
            <Link href={manualHref} className="link font-medium">
              Set up a radar by trade and region
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
