import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { site } from "@/config/site";
import { dismissFirstRunAction } from "../actions";
import { pluralise } from "../domain/format";
import { NEW_BID_CHECK_HREF } from "../domain/links";
import type { RadarFirstRun, RadarView } from "../radar/view";
import { tenderListFrameClasses } from "./match-row";
import { RadarEditTrigger } from "./radar-edit";
import { RadarList } from "./radar-list";
import { EmptyState } from "@/components/ui/empty-state";
import { ListCardFoot } from "@/components/ui/list-card";
import { NumberedCard } from "@/components/ui/numbered-card";
import { SectionHead } from "@/components/ui/section-head";

/**
 * The radar the first time it is opened — right after a claim or a manual set-up — as the
 * RadarFirstRun artboards draw it: what just happened, the three things worth doing first,
 * where the weekly digest goes, and the first matches.
 *
 * It is shown until the workspace hides it or has done all three things (radar/data.ts:
 * `first_run_pending`, steps read from analytics events). "See all N matches" and any tab
 * or filter open the full radar without ending the guide.
 */
export function RadarFirstRunGuide({
  view,
  firstRun,
  now,
  userEmail,
  allHref,
}: {
  view: RadarView;
  firstRun: RadarFirstRun;
  now: Date;
  /** The signed-in user's own address: where their digest goes. */
  userEmail: string;
  /** The full list of matches. */
  allHref: string;
}) {
  const source = view.active;
  const matching = view.matching;
  if (!source) return null;
  const claimed = source.kind === "supplier";
  const trades = matching ? (matching.trades.length > 0 ? matching.trades.map((trade) => trade.label) : matching.keywords.map((keyword) => `“${keyword}”`)) : [];
  const saved = [...view.states].filter(([, state]) => state === "saved").map(([ocid]) => ocid);

  return (
    <div className="flex flex-col" data-testid="first-run">
      <section aria-labelledby="first-run-h" className="flex flex-col rounded-modal bg-brand-tint p-5 md:px-8 md:py-7">
        {/* A phone reads it in another order (RadarFirstRun-390): the badge, the title, then the company and its address. */}
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-13 text-ink max-md:contents">
          <Badge className="max-md:order-1 max-md:self-start">
            <svg viewBox="0 0 12 12" aria-hidden className="fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]">
              <path d="M2 6.5l2.6 2.6L10 3.5" />
            </svg>
            {claimed ? "Claimed" : "Set up"}
          </Badge>
          <span className="font-semibold [overflow-wrap:anywhere] max-md:order-3 max-md:mt-2 max-md:text-15">{source.name}</span>
          {claimed ? (
            <span className="font-mono text-xs [overflow-wrap:anywhere] max-md:order-4 max-md:mt-0.5">
              {site.domain}/suppliers/{source.slug}
            </span>
          ) : null}
        </p>
        <h1 id="first-run-h" className="type-title mt-3 text-ink max-md:order-2 max-md:mt-2.5">
          {claimed ? "Your page is claimed." : "Your radar is set up."}
        </h1>
        <p className="mt-2 text-base text-ink max-md:order-5 max-md:mt-2.5 max-md:text-15">Here is your radar: open tenders that match {claimed ? "your past work" : "your trades and regions"}.</p>
      </section>

      <section aria-labelledby="first-things-h" className="mt-8 flex flex-col gap-4 md:mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <SectionHead id="first-things-h" title="Three things to do first" />
          <form action={dismissFirstRunAction}>
            <input type="hidden" name="key" value={source.key} />
            <Button type="submit" variant="link" className="hit-40 text-sm" data-testid="first-run-dismiss">
              Hide this guide
            </Button>
          </form>
        </div>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(21.25rem,100%),1fr))] gap-4 md:gap-5">
          <NumberedCard
            as="li"
            number={1}
            title="Check your trades and regions"
            done={firstRun.steps.profile}
            action={
              view.edit ? (
                <RadarEditTrigger data={view.edit} variant="outline">
                  Edit<span className="sr-only"> trades and regions</span>
                </RadarEditTrigger>
              ) : null
            }
          >
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-2">Trades</span>
              {trades.length > 0 ? (
                <ul aria-label="Trades" className="flex flex-wrap gap-1.5">
                  {trades.map((label) => (
                    <li key={label} className="flex max-w-full">
                      <Badge variant="secondary" className="max-w-full shrink">
                        <span className="truncate">{label}</span>
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink">None yet. Tick yours so the radar knows what to look for.</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-2">Regions</span>
              <ul aria-label="Regions" className="flex flex-wrap gap-1.5">
                {(matching?.regions ?? []).map((label) => (
                  <li key={label} className="flex">
                    <Badge variant="secondary">{label}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </NumberedCard>
          <NumberedCard
            as="li"
            number={2}
            title="Add your company documents"
            done={firstRun.steps.documents}
            action={
              <ButtonLink variant="outline" href="/app/library">
                Go to Documents
              </ButtonLink>
            }
          >
            <p>Checks compare the tender pack with what you upload: insurance, accounts, certificates, case studies.</p>
          </NumberedCard>
          <NumberedCard
            as="li"
            number={3}
            title="Run your free cited bid check"
            done={firstRun.steps.check}
            action={<ButtonLink href={NEW_BID_CHECK_HREF}>Start a bid check</ButtonLink>}
          >
            <p>Upload a tender pack and see every requirement quoted and cited, with a plain verdict.</p>
          </NumberedCard>
        </ol>
        <p className="flex flex-wrap items-center gap-x-2.5 text-sm text-ink-2">
          <span>
            Your weekly digest goes to <span className="font-semibold text-ink [overflow-wrap:anywhere]">{userEmail}</span>.
          </span>
          <Link href="/app/settings/notifications" className="link inline-flex min-h-11 items-center rounded-sm font-medium">
            Change
          </Link>
        </p>
      </section>

      <section aria-labelledby="first-matches-h" className="mt-6 flex flex-col gap-4 md:mt-9">
        <SectionHead id="first-matches-h" title="Your first matches" note={firstRun.matches.length > 0 ? "Matched on category, buyer and region. Soonest deadline first." : undefined} />
        {firstRun.matches.length > 0 ? (
          <>
            <div className={tenderListFrameClasses}>
              <RadarList items={firstRun.matches} saved={saved} now={now.toISOString()} firstRank={1} label="Your first matches" />
              {/* The last row of the card from 768 px; under the cards on a phone. */}
              <ListCardFoot className="max-md:px-0 max-md:pt-2 md:border-t md:border-line">
                <Link href={allHref} className="link inline-flex min-h-11 items-center rounded-sm text-sm font-medium" data-testid="first-run-all">
                  {firstRun.total === 1 ? "See your match on the radar" : `See all ${pluralise(firstRun.total, "match", "matches")}`}
                </Link>
              </ListCardFoot>
            </div>
          </>
        ) : (
          <EmptyState
            headingLevel="h3"
            title="No open tenders match right now"
            actions={
              <Link href={allHref} className="link inline-flex min-h-11 items-center rounded-sm text-15 font-medium" data-testid="first-run-all">
                Open the radar
              </Link>
            }
          >
            {trades.length > 0
              ? "Nothing on Find a Tender matches your trades and regions today. New notices are checked every day, and your weekly digest will tell you when one appears."
              : "The radar has no trade to match on yet. Tick your trades in step 1 and the matches appear here."}
          </EmptyState>
        )}
      </section>
    </div>
  );
}
