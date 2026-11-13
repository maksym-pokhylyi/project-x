"use client";

import { Check } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ANNUAL_FREE_MONTHS, planDisplay } from "@/config/plan-display";
import { radioGroupKeyDown } from "@/components/ui/radio-keys";
import { BILLING_INTERVALS, PLANS, PLAN_KEYS, type BillingInterval, type Plan, type PlanKey } from "@/config/plans";
import { cn } from "@/lib/utils";

/**
 * Plan cards with a monthly/annual toggle, rendered from the plan catalogue through the
 * display adapter (src/config/plan-display.ts).
 * Used on /pricing (sign-up actions) and in Settings → Billing (checkout / change-plan
 * actions): the caller decides what each card's action is through `renderAction`.
 */
export function PricingTable({
  renderAction,
  currentPlan,
  defaultInterval = "month",
  layout = "wide",
  after,
}: {
  renderAction: (plan: Plan, interval: BillingInterval) => ReactNode;
  currentPlan?: PlanKey;
  defaultInterval?: BillingInterval;
  /** "wide": four across from 1024 px (public pricing). "compact": two across (inside the app). */
  layout?: "wide" | "compact";
  /** Rendered between the cards and the small print (e.g. the Bid Pass). */
  after?: ReactNode;
}) {
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval);
  const groupId = useId();

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Billing interval" className="inline-flex rounded-card border border-line bg-surface-sunken p-1 text-sm">
          {(["month", "year"] as const).map((value) => {
            const checked = interval === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={checked}
                data-value={value}
                data-testid={`interval-${value}`}
                tabIndex={checked ? 0 : -1}
                onClick={() => setInterval(value)}
                onKeyDown={(event) => radioGroupKeyDown(event, BILLING_INTERVALS, interval, setInterval)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-control px-4 font-medium transition-colors duration-150",
                  checked ? "bg-surface text-ink shadow-raised" : "text-ink-2 hover:text-ink",
                )}
              >
                {value === "month" ? "Monthly" : "Annual"}
                {value === "year" ? <span className={cn("text-13 font-normal", checked ? "text-success" : "text-ink-2")}>{ANNUAL_FREE_MONTHS} months free</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <ul className={cn("grid gap-4 sm:grid-cols-2", layout === "wide" && "lg:grid-cols-4")}>
        {PLAN_KEYS.map((key) => {
          const display = planDisplay(key);
          const price = interval === "year" ? display.annual : display.monthly;
          const isCurrent = currentPlan === key;
          const titleId = `${groupId}-${key}`;
          return (
            <li
              key={key}
              data-testid={`plan-${key}`}
              aria-labelledby={titleId}
              className={cn(
                "relative flex flex-col rounded-card border bg-surface p-6",
                display.recommended ? "border-brand shadow-raised ring-1 ring-brand" : "border-line",
              )}
            >
              <div className="flex min-h-6 items-center justify-between gap-2">
                <h3 id={titleId} className="font-sans text-base leading-6 font-semibold text-ink">
                  {display.name}
                </h3>
                {isCurrent ? <Badge variant="secondary">Current plan</Badge> : display.recommended ? <Badge variant="brand">Recommended</Badge> : null}
              </div>
              <p className={cn("mt-1 text-sm text-ink-2", layout === "wide" && "lg:min-h-15")}>{display.summary}</p>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="font-display text-3xl leading-10 font-semibold text-ink tabular-nums" data-testid={`price-${key}`}>
                  {price.amount}
                </span>
                {price.period ? <span className="text-sm text-ink-2">{price.period}</span> : null}
              </p>
              <p className={cn("mt-1 text-13 text-ink-2", layout === "wide" && "lg:min-h-9")}>{price.note}</p>

              <div className="mt-5">{renderAction(PLANS[key], interval)}</div>
              {display.footnote ? <p className={cn("mt-2 text-xs text-ink-2", layout === "wide" && "lg:min-h-8")}>{display.footnote}</p> : null}

              <ul className="mt-5 flex-1 space-y-2.5 border-t border-line pt-5 text-sm text-ink">
                {display.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2.5">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {after}

      <p className="text-center text-13 text-ink-2">
        Prices in pounds sterling, excluding VAT. VAT is added at checkout where it applies. Payments are processed by Paddle, our merchant of
        record.
      </p>
    </div>
  );
}
