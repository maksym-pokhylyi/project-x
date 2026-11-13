"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { PricingTable } from "@/components/billing/pricing-table";
import { Button } from "@/components/ui/button";
import { BID_PASS } from "@/config/plan-display";

/**
 * Bid Pass: a first-class option next to the plans, for firms that bid a few times a year.
 * Same card language and price size as the plans, laid out across the full width.
 */
export function BidPassCard() {
  return (
    <section aria-labelledby="bid-pass-title" data-testid="bid-pass" className="rounded-card border border-line bg-surface p-6 lg:p-8">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
        <div className="lg:col-span-4">
          <p className="type-eyebrow text-brand">Or pay by the bid</p>
          <h3 id="bid-pass-title" className="type-h3 mt-2 text-ink">
            {BID_PASS.name}
          </h3>
          <p className="mt-1 text-sm text-ink-2">
            {BID_PASS.summary} {BID_PASS.audience}
          </p>
        </div>
        <ul className="grid gap-x-6 gap-y-2.5 text-sm text-ink sm:grid-cols-2 lg:col-span-5">
          {BID_PASS.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <div className="lg:col-span-3">
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl leading-10 font-semibold text-ink tabular-nums" data-testid="price-bid-pass">
              {BID_PASS.price}
            </span>
            <span className="text-sm text-ink-2">{BID_PASS.period}</span>
          </p>
          <Button asChild className="mt-3 w-full">
            <Link href="/sign-up?next=/app/bids/new">
              Start a bid with a pass <ArrowRight aria-hidden />
            </Link>
          </Button>
          <p className="mt-2 text-xs text-ink-2">{BID_PASS.footnote}</p>
        </div>
      </div>
    </section>
  );
}

/** Pricing cards for signed-out visitors: every plan starts with creating an account. */
export function MarketingPricing() {
  return (
    <PricingTable
      after={<BidPassCard />}
      renderAction={(plan, interval) => (
        <Button asChild className="w-full" variant={plan.recommended ? "default" : "outline"}>
          <Link href={plan.key === "free" ? "/sign-up" : `/sign-up?plan=${plan.key}&interval=${interval}`}>
            {plan.key === "free" ? "Start free" : `Choose ${plan.name}`}
          </Link>
        </Button>
      )}
    />
  );
}
