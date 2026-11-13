"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { PricingViewer } from "@/app/api/pricing/viewer/route";
import { PricingTable } from "@/components/billing/pricing-table";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { BID_PASS_DISPLAY } from "@/config/plan-display";
import { isPlanKey, type BillingInterval, type Plan, type PlanKey } from "@/config/plans";
import { authClient } from "@/lib/auth-client";
import { BILLING_PATH, billingHandoff, signUpThenBilling } from "@/lib/billing/handoff";

/**
 * Who is looking at the prices. Signed out (the default, and what the static page renders):
 * null. Signed in: the plan of their active workspace and whether they may change it, asked
 * from /api/pricing/viewer once the session is known.
 */
function usePricingViewer(): PricingViewer | null {
  const { data } = authClient.useSession();
  const signedIn = Boolean(data?.user);
  const [viewer, setViewer] = useState<PricingViewer | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetch("/api/pricing/viewer", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<PricingViewer>) : null))
      .then((value) => {
        if (!cancelled) setViewer(value);
      })
      .catch(() => {
        // Not being able to tell is not an error for the visitor: the signed-out buttons stay.
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  return signedIn ? viewer : null;
}

const ownerOnly = (
  <p className="flex min-h-(--control-h) items-center text-13 leading-[1.5]" data-testid="plan-owner-only">
    A workspace owner can change the plan.
  </p>
);

/**
 * Bid Pass: a first-class option beside the plans, for firms that bid a few times a year.
 * The brand-tint band of the pricing artboards: eyebrow, serif headline and one line on the
 * left; the price and the one green button on the right. On phones the price moves up beside
 * the eyebrow and the button takes the full width (the two groups dissolve into one grid).
 */
export function BidPassBand({
  headingLevel = 3,
  short = false,
  action,
}: {
  headingLevel?: 2 | 3;
  /** Use the shorter description on phones (the landing page). */
  short?: boolean;
  /** The button: where it leads depends on who is looking (see MarketingPricing). */
  action: ReactNode;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section
      id="bid-pass"
      aria-labelledby="bid-pass-title"
      data-testid="bid-pass"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 rounded-card bg-brand-tint p-5 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-10 sm:gap-y-5 sm:px-7 sm:py-[1.625rem]"
    >
      <div className="contents sm:flex sm:min-w-0 sm:flex-[1_1_28.75rem] sm:flex-col sm:gap-1.5">
        <p className="type-eyebrow">{BID_PASS_DISPLAY.name}</p>
        <Heading id="bid-pass-title" className="col-span-2 font-display text-2xl leading-[1.2] font-semibold tracking-[-0.01em] text-ink sm:text-3xl sm:leading-[1.2]">
          {BID_PASS_DISPLAY.headline}
        </Heading>
        <p className="col-span-2 max-w-[38.75rem] text-sm leading-[1.5] text-ink sm:text-15 sm:leading-[1.5]">
          {short ? (
            <>
              <span className="sm:hidden">{BID_PASS_DISPLAY.descriptionShort}</span>
              <span className="hidden sm:inline">{BID_PASS_DISPLAY.description}</span>
            </>
          ) : (
            BID_PASS_DISPLAY.description
          )}
        </p>
      </div>
      <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-x-7 sm:gap-y-4">
        <p className="col-start-2 row-start-1 flex items-baseline gap-[0.3125rem] text-ink sm:gap-1.5">
          <span className="type-figure text-30 leading-[1.15] tracking-[-0.02em] sm:text-44 sm:leading-none" data-testid="price-bid-pass">
            {BID_PASS_DISPLAY.price}
          </span>
          <span className="text-13 leading-[1.5] sm:text-sm sm:leading-[1.5]">{BID_PASS_DISPLAY.period}</span>
        </p>
        <div className="col-span-2 max-sm:[&>*]:w-full">{action}</div>
      </div>
    </section>
  );
}

/**
 * The plan cards of the public site: the one place where plans are compared and chosen.
 * The buttons depend on who is looking:
 *
 *   signed out     Free → /find; a paid plan or the Bid Pass → sign-up, then the hand-off
 *                  to Billing (src/lib/billing/handoff.ts)
 *   signed in      the workspace's plan is marked "Current plan" (button disabled); the
 *                  others link straight to the hand-off, where the change is confirmed
 *   not an owner   no buttons: a sentence says who can change the plan
 *
 * The Bid Pass band follows the cards. The landing page shows monthly prices only
 * (`toggle={false}`); /pricing adds the Monthly / Annual toggle.
 */
export function MarketingPricing({
  toggle = true,
  headingLevel,
  smallPrint,
  shortBidPass = false,
}: {
  toggle?: boolean;
  headingLevel?: 2 | 3;
  smallPrint?: ReactNode;
  /** The landing page words the Bid Pass more briefly on phones. */
  shortBidPass?: boolean;
}) {
  const viewer = usePricingViewer();
  const currentPlan: PlanKey | undefined = viewer && isPlanKey(viewer.planKey) ? viewer.planKey : undefined;

  function planAction(plan: Plan, interval: BillingInterval, featured: boolean) {
    const variant = featured ? "inverse" : "outline";
    if (!viewer) {
      return (
        <ButtonLink href={plan.key === "free" ? "/find" : signUpThenBilling({ plan: plan.key, interval })} className="w-full" variant={variant}>
          {plan.cta}
        </ButtonLink>
      );
    }
    const isCurrent = plan.key === currentPlan && (plan.key === "free" || !viewer.interval || viewer.interval === interval);
    if (isCurrent) {
      return (
        <Button className="w-full" variant={variant} disabled>
          Current plan
        </Button>
      );
    }
    if (!viewer.canManageBilling) return ownerOnly;
    if (plan.key === "free") {
      return (
        <ButtonLink href={BILLING_PATH} className="w-full" variant={variant}>
          Cancel from Billing
        </ButtonLink>
      );
    }
    return (
      <ButtonLink href={billingHandoff({ plan: plan.key, interval })} className="w-full" variant={variant}>
        {viewer.hasSubscription ? (plan.key === currentPlan ? `Switch to ${interval === "year" ? "annual" : "monthly"}` : `Change to ${plan.name}`) : plan.cta}
      </ButtonLink>
    );
  }

  const bidPassAction =
    viewer && !viewer.canManageBilling ? (
      ownerOnly
    ) : (
      <ButtonLink href={viewer ? billingHandoff({ buy: "bid_pass" }) : signUpThenBilling({ buy: "bid_pass" })} className="px-[1.1875rem]">
        {BID_PASS_DISPLAY.cta}
      </ButtonLink>
    );

  return (
    <PricingTable
      toggle={toggle}
      headingLevel={headingLevel}
      smallPrint={smallPrint}
      currentPlan={currentPlan}
      after={<BidPassBand headingLevel={headingLevel} short={shortBidPass} action={bidPassAction} />}
      renderAction={(plan, interval, { featured }) => planAction(plan, interval, featured)}
    />
  );
}
