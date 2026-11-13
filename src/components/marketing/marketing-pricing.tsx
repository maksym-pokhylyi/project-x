"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PricingTable } from "@/components/billing/pricing-table";
import { Button } from "@/components/ui/button";
import { BID_PASS_DISPLAY } from "@/config/plan-display";

/** Where a signed-out visitor starts a Bid Pass: an account first, then the new bid. */
export const BID_PASS_HREF = "/sign-up?next=/app/bids/new";

/**
 * Bid Pass: a first-class option beside the plans, for firms that bid a few times a year.
 * The brand-tint band of the pricing artboards: eyebrow, serif headline and one line on the
 * left; the price and the one green button on the right. On phones the price moves up beside
 * the eyebrow and the button takes the full width (the two groups dissolve into one grid).
 */
export function BidPassBand({
  href = BID_PASS_HREF,
  headingLevel = 3,
  short = false,
  action,
}: {
  href?: string;
  headingLevel?: 2 | 3;
  /** Use the shorter description on phones (the landing page). */
  short?: boolean;
  /** Replaces the default link button. */
  action?: ReactNode;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section
      id="bid-pass"
      aria-labelledby="bid-pass-title"
      data-testid="bid-pass"
      className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 rounded-card bg-brand-tint p-5 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-10 sm:gap-y-5 sm:px-7 sm:py-[1.625rem]"
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
          <span className="type-figure text-[1.875rem] leading-[1.15] tracking-[-0.02em] sm:text-[2.75rem] sm:leading-none" data-testid="price-bid-pass">
            {BID_PASS_DISPLAY.price}
          </span>
          <span className="text-13 leading-[1.5] sm:text-sm sm:leading-[1.5]">{BID_PASS_DISPLAY.period}</span>
        </p>
        <div className="col-span-2 max-sm:[&>*]:h-[2.875rem] max-sm:[&>*]:w-full">
          {action ?? (
            <Button asChild className="px-[1.1875rem]">
              <Link href={href}>{BID_PASS_DISPLAY.cta}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Plan cards for signed-out visitors. Free starts with finding your company; every paid plan
 * starts with creating an account, with the plan and billing period carried along. The Bid
 * Pass band follows the cards. The landing page shows monthly prices only
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
  return (
    <PricingTable
      toggle={toggle}
      headingLevel={headingLevel}
      smallPrint={smallPrint}
      after={<BidPassBand headingLevel={headingLevel} short={shortBidPass} />}
      renderAction={(plan, interval, { featured }) => (
        <Button asChild className="w-full max-sm:h-[2.875rem]" variant={featured ? "inverse" : "outline"}>
          <Link href={plan.key === "free" ? "/find" : `/sign-up?plan=${plan.key}&interval=${interval}`}>{plan.cta}</Link>
        </Button>
      )}
    />
  );
}
