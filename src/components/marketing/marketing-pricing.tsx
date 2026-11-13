"use client";

import Link from "next/link";
import { PricingTable } from "@/components/billing/pricing-table";
import { Button } from "@/components/ui/button";

/** Pricing cards for signed-out visitors: every plan starts with creating an account. */
export function MarketingPricing() {
  return (
    <PricingTable
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
