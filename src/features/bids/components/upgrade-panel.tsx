import "./bid-theme.css";
import Link from "next/link";
import type { ReactNode } from "react";
import type { BidAccessSummary } from "@/features/bids/access";
import { OFFERS, PLANS_URL, TOP_PLAN_FULL_BIDS } from "@/features/bids/offers";
import { cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button-link";

const date = (value: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" }).format(value);
const month = (value: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(value);

function Offer({ offer, children, primary, testId }: { offer: (typeof OFFERS)[keyof typeof OFFERS]; children: ReactNode; primary?: boolean; testId: string }) {
  return (
    <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2 rounded-card border border-line bg-surface px-5 py-4" data-testid={testId}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-15 font-semibold">{offer.name}</span>
        <span className="bid-serif text-2xl leading-none font-semibold">{offer.price}</span>
        <span className="text-13 text-ink-2">{offer.cadence}</span>
      </p>
      <p className="text-sm text-ink">{children}</p>
      <ButtonLink href={offer.href} variant={primary ? "default" : "outline"} className="mt-auto self-start">
        {offer.action}
      </ButtonLink>
    </div>
  );
}

/**
 * The upgrade moments (design handoff: UpgradeFreeUsed, UpgradeBidsUsed, locked Brief):
 * what was used, when more arrives, and the two ways on. Every figure comes from
 * getBidAccess(); nothing is shown that we do not know.
 *
 *   "none_left"  New bid check with nothing left to start one
 *   "locked"     a cited check without drafting (Free / Radar Pro): the offer to make it a full bid
 */
export function UpgradePanel({
  access,
  moment,
  freeCheckUse,
  tenderClosesAt,
  children,
  className,
}: {
  access: BidAccessSummary;
  moment: "none_left" | "locked";
  /** The bid the workspace's free check went on, when known. */
  freeCheckUse?: { title: string; usedAt: Date } | null;
  /** Closing time of the tender being started, when the Radar knows it. */
  tenderClosesAt?: Date | null;
  /** Extra action (for example "Use a Bid Pass" when the workspace holds one). */
  children?: ReactNode;
  className?: string;
}) {
  const { fullBids, checks } = access;
  const onBidPlan = access.drafting;
  const limit = fullBids.limit ?? 0;
  const renews = date(fullBids.renewsAt);

  let title: string;
  let body: ReactNode;
  if (moment === "locked") {
    title = "Take this check on to a full bid";
    body = "Add the scored-question matrix with weights and word limits, a first draft of each answer from your documents, marking against the buyer’s scheme, and Word export.";
  } else if (onBidPlan && fullBids.trial) {
    title = limit === 1 ? "You have used the full bid in your trial" : `You have used the ${limit} full bids in your trial`;
    body = `Your plan’s monthly bids start when the trial ends on ${renews}.`;
  } else if (onBidPlan) {
    title = `You have used this month’s ${limit} bids`;
    body = `Your next ${limit} bids arrive on ${renews}.${tenderClosesAt ? ` This tender closes on ${date(tenderClosesAt)}.` : ""}`;
  } else if ((checks.limit ?? 0) > 0) {
    title = "You have used this month’s cited check";
    body = `Your next cited check arrives on ${date(checks.renewsAt)}.${tenderClosesAt ? ` This tender closes on ${date(tenderClosesAt)}.` : ""}`;
  } else {
    title = "Your free check is used";
    body = freeCheckUse ? (
      <>
        Your free cited bid check went on <strong className="font-semibold">{freeCheckUse.title}</strong> on {date(freeCheckUse.usedAt)}.
      </>
    ) : (
      "The Free plan includes one cited bid check."
    );
  }

  return (
    <section aria-labelledby="upgrade-h" className={cn("rounded-card bg-paper-deep px-5 py-5 sm:px-6", className)} data-testid="upgrade-panel" data-moment={moment}>
      <h2 id="upgrade-h" className="bid-h3">
        {title}
      </h2>
      <p className="mt-1.5 max-w-[720px] text-15" data-testid="quota-reached">
        {body}
      </p>
      {moment === "none_left" && onBidPlan && !fullBids.trial ? (
        <p className="mt-3 text-sm">
          <span className="font-semibold">Full bids</span> <span className="text-ink-2">· {month(new Date(fullBids.renewsAt.getTime() - 1))}</span>{" "}
          <span className="bid-mono ml-2 text-13">
            {fullBids.used} of {fullBids.used + (fullBids.remaining ?? 0)} used
          </span>
        </p>
      ) : null}
      {moment === "locked" ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href={OFFERS.bidPass.href}  data-testid="offer-bid-pass">
            {OFFERS.bidPass.action} · {OFFERS.bidPass.price}
          </ButtonLink>
          {onBidPlan ? null : (
            <ButtonLink variant="outline" href={OFFERS.trial.href}  data-testid="offer-trial">
              Start the 14-day Bid Desk trial
            </ButtonLink>
          )}
        </div>
      ) : (
      <div className="mt-4 flex flex-wrap gap-3">
        <Offer offer={OFFERS.bidPass} primary testId="offer-bid-pass">
          {onBidPlan
            ? "One more full bid now, on top of your plan."
            : "One full bid, no subscription: cited check, scored-question matrix, first drafts from your documents, marking against the buyer’s scheme and Word export."}
        </Offer>
        {onBidPlan ? (
          limit < TOP_PLAN_FULL_BIDS && !fullBids.trial ? (
            <Offer offer={OFFERS.plus} testId="offer-plus">
              10 full bids a month, 10 seats and separate client workspaces. You pay the difference for the rest of this month.
            </Offer>
          ) : null
        ) : (
          <Offer offer={OFFERS.trial} testId="offer-trial">
            3 full bids a month, 3 seats, unused bids roll over one month. Pause or cancel in two clicks.
          </Offer>
        )}
      </div>
      )}
      {children ? <div className="mt-4">{children}</div> : null}
      <p className="mt-4 text-13 text-ink-2">
        Prices exclude VAT. VAT is added at checkout where it applies.{" "}
        {moment === "none_left" && onBidPlan ? (
          <>Or wait until {renews}.</>
        ) : (
          <Link href={PLANS_URL} className="bid-link text-ink">
            {moment === "locked" ? "Compare the plans" : "Compare the plans in full"}
          </Link>
        )}
      </p>
    </section>
  );
}
