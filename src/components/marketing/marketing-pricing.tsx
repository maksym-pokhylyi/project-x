"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PricingTable, PlanTick } from "@/components/billing/pricing-table";
import { Button } from "@/components/ui/button";
import { landing } from "@/config/landing";
import { BID_PASS } from "@/config/plan-display";

/**
 * Bid Pass: a first-class option next to the plans, for firms with one tender on the table.
 * A brand-tint panel across the full width, with the same serif price as the plan cards.
 * `detailed` adds the list of what one pass covers (the pricing page).
 */
export function BidPassCard({ detailed = false }: { detailed?: boolean }) {
  const { bidPass } = landing;
  return (
    <section aria-labelledby="bid-pass-title" data-testid="bid-pass" id="bid-pass" className="rounded-modal bg-brand-tint px-5 py-6 sm:px-8 sm:py-7">
      <div className="flex flex-col gap-x-14 gap-y-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-[42.5rem]">
          <p className="type-eyebrow">{bidPass.eyebrow}</p>
          <h3 id="bid-pass-title" className="type-h3 mt-1.5 text-ink">
            {bidPass.title}
          </h3>
          <p className="mt-2 text-15 text-ink">{bidPass.body}</p>
          {detailed ? (
            <ul className="mt-4 grid gap-x-8 gap-y-2 text-sm leading-[1.3125rem] text-ink sm:grid-cols-2">
              {BID_PASS.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5">
                  <PlanTick className="text-brand" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-3 lg:w-72">
          <p className="flex items-baseline gap-1.5">
            <span className="type-figure text-[2.75rem] leading-none tracking-[-0.02em] text-ink" data-testid="price-bid-pass">
              {BID_PASS.price}
            </span>
            <span className="text-sm text-ink-2">{BID_PASS.period}</span>
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href={bidPass.cta.href}>{bidPass.cta.label}</Link>
          </Button>
          <p className="text-13 text-ink-2">{bidPass.note}</p>
        </div>
      </div>
    </section>
  );
}

/**
 * Plan cards for signed-out visitors. Free starts with finding your page; every paid plan
 * starts with creating an account. The landing page shows monthly prices only
 * (`toggle={false}`); /pricing adds the monthly / annual switch.
 */
export function MarketingPricing({ toggle = true, smallPrint }: { toggle?: boolean; smallPrint?: ReactNode }) {
  return (
    <PricingTable
      toggle={toggle}
      smallPrint={smallPrint}
      after={<BidPassCard detailed={toggle} />}
      renderAction={(plan, interval, { featured }) => (
        <Button asChild className="w-full" variant={featured ? "inverse" : "outline"}>
          <Link href={plan.key === "free" ? "/find" : `/sign-up?plan=${plan.key}&interval=${interval}`}>{plan.key === "free" ? "Find your page" : `Start ${plan.name}`}</Link>
        </Button>
      )}
    />
  );
}
