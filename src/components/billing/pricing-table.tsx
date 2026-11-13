"use client";

import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  PLANS,
  PLAN_KEYS,
  annualSavingsPercent,
  formatPrice,
  type BillingInterval,
  type Plan,
  type PlanKey,
} from "@/config/plans";
import { cn } from "@/lib/utils";

/**
 * Plan cards with a monthly/annual toggle, rendered straight from the plan catalogue.
 * Used on /pricing (sign-up CTAs) and in Settings → Billing (checkout / change-plan CTAs):
 * the caller decides what each card's action is through `renderAction`.
 */
export function PricingTable({
  renderAction,
  currentPlan,
  defaultInterval = "month",
}: {
  renderAction: (plan: Plan, interval: BillingInterval) => ReactNode;
  currentPlan?: PlanKey;
  defaultInterval?: BillingInterval;
}) {
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval);
  const maxSavings = Math.max(...PLAN_KEYS.map((key) => annualSavingsPercent(PLANS[key])));

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Billing interval" className="inline-flex rounded-lg border bg-muted p-1 text-sm">
          {(["month", "year"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              data-testid={`interval-${value}`}
              onClick={() => setInterval(value)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                interval === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "month" ? "Monthly" : "Annual"}
              {value === "year" && maxSavings > 0 ? (
                <span className="ml-1.5 text-xs font-normal text-success">save {maxSavings}%</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_KEYS.map((key) => {
          const plan = PLANS[key];
          const price = plan.prices ? plan.prices[interval] : 0;
          const perMonth = plan.prices && interval === "year" ? plan.prices.year / 12 : price;
          const isCurrent = currentPlan === key;
          return (
            <li
              key={key}
              data-testid={`plan-${key}`}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-5",
                plan.recommended && "border-primary shadow-sm",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{plan.name}</h3>
                {isCurrent ? <Badge variant="secondary">Current plan</Badge> : plan.recommended ? <Badge>Popular</Badge> : null}
              </div>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight" data-testid={`price-${key}`}>
                  {formatPrice(perMonth)}
                </span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </p>
              <p className="mt-1 min-h-5 text-xs text-muted-foreground">
                {!plan.prices ? "Free forever" : interval === "year" ? `${formatPrice(plan.prices.year)} billed annually` : "Billed monthly"}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5">{renderAction(plan, interval)}</div>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-xs text-muted-foreground">
        Prices in USD, excluding taxes. Payments are processed by Paddle, our merchant of record.
      </p>
    </div>
  );
}
