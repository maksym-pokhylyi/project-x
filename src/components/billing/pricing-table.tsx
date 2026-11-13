"use client";

import { useId, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { filterChipClasses } from "@/components/ui/filter-chip";
import { radioGroupKeyDown } from "@/components/ui/radio-keys";
import { ANNUAL_FREE_MONTHS, planDisplay } from "@/config/plan-display";
import { BILLING_INTERVALS, PLANS, PLAN_KEYS, type BillingInterval, type Plan, type PlanKey } from "@/config/plans";
import { cn } from "@/lib/utils";

/** Context handed to `renderAction`: a featured card is brand green, so its button is white. */
export type PlanActionContext = { featured: boolean };

/** The tick of a plan's bullet list, as drawn in the artboards. */
export function PlanTick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn("mt-0.5 size-4 shrink-0 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]", className)}>
      <path d="M3 8.5l3.2 3.2L13 4.8" />
    </svg>
  );
}

/**
 * Plan cards, rendered from the plan catalogue through the display adapter
 * (src/config/plan-display.ts) and laid out as in the landing artboard: name and one line,
 * a large serif price, the action, then what the plan adds. The recommended plan is filled
 * brand green.
 *
 * Used on the landing page (monthly prices, no toggle), on /pricing (with the
 * monthly / annual toggle) and in Settings → Billing (checkout and change-plan actions):
 * the caller decides what each card's action is through `renderAction`.
 */
export function PricingTable({
  renderAction,
  currentPlan,
  defaultInterval = "month",
  layout = "wide",
  toggle = true,
  highlightRecommended = true,
  after,
  smallPrint,
}: {
  renderAction: (plan: Plan, interval: BillingInterval, context: PlanActionContext) => ReactNode;
  currentPlan?: PlanKey;
  defaultInterval?: BillingInterval;
  /** "wide": four across from 1024 px (public pages). "compact": two across (inside the app). */
  layout?: "wide" | "compact";
  /** The monthly / annual switch, with the note under each price. Off on the landing page. */
  toggle?: boolean;
  /** Fill the recommended plan brand green. Off inside the app, where the current plan leads. */
  highlightRecommended?: boolean;
  /** Rendered between the cards and the small print (e.g. the Bid Pass). */
  after?: ReactNode;
  /** Replaces the default line about VAT and Paddle. */
  smallPrint?: ReactNode;
}) {
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval);
  const groupId = useId();

  return (
    <div className="flex flex-col gap-5">
      {toggle ? (
        <div role="radiogroup" aria-label="Billing interval" className="flex flex-wrap gap-2">
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
                className={filterChipClasses(checked)}
              >
                {value === "month" ? "Monthly" : "Annual"}
                {value === "year" ? <span className={cn("font-normal", checked ? "text-white" : "text-ink-2")}>· {ANNUAL_FREE_MONTHS} months free</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <ul className={cn("grid gap-5 sm:grid-cols-2", layout === "wide" && "lg:grid-cols-4")}>
        {PLAN_KEYS.map((key) => {
          const display = planDisplay(key);
          const price = interval === "year" ? display.annual : display.monthly;
          const isCurrent = currentPlan === key;
          const featured = highlightRecommended && display.recommended;
          const titleId = `${groupId}-${key}`;
          return (
            <li
              key={key}
              data-testid={`plan-${key}`}
              aria-labelledby={titleId}
              className={cn(
                "flex flex-col gap-5 rounded-card border px-5 py-6 sm:px-6 sm:py-[1.625rem]",
                featured ? "on-brand border-brand bg-brand text-white" : "border-line bg-surface text-ink",
              )}
            >
              {/* Phones: name and price share a line. From 640 px: name, one line, then the price. */}
              <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 sm:grid-cols-1 sm:gap-y-0">
                <h3 id={titleId} className="type-h3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  {display.name}
                  {isCurrent ? (
                    <Badge variant="secondary" className={cn("font-sans tracking-normal", featured && "bg-white/15 text-white")}>
                      Current plan
                    </Badge>
                  ) : null}
                </h3>
                <p className={cn("col-span-2 row-start-2 text-sm leading-[1.3125rem] sm:col-span-1 sm:mt-1", layout === "wide" && "lg:min-h-[2.625rem]", !featured && "text-ink-2")}>
                  {display.summary}
                </p>
                <p className="col-start-2 row-start-1 flex items-baseline gap-1.5 sm:col-start-1 sm:row-start-3 sm:mt-5">
                  <span className="type-figure text-[1.75rem] leading-none tracking-[-0.02em] sm:text-[2.75rem]" data-testid={`price-${key}`}>
                    {price.amount}
                  </span>
                  {price.period ? <span className={cn("text-xs sm:text-sm", !featured && "text-ink-2")}>{price.period}</span> : null}
                </p>
                {toggle ? (
                  <p className={cn("col-span-2 row-start-3 text-13 sm:col-span-1 sm:row-start-4 sm:mt-2", !featured && "text-ink-2", layout === "wide" && "lg:min-h-10")}>
                    {price.note}
                  </p>
                ) : null}
              </div>

              <div className="order-last sm:order-none">
                {renderAction(PLANS[key], interval, { featured })}
                {toggle && display.footnote ? <p className={cn("mt-2 text-xs leading-[1.125rem]", !featured && "text-ink-2", layout === "wide" && "lg:min-h-9")}>{display.footnote}</p> : null}
              </div>

              <ul className="flex flex-1 flex-col gap-2.5 text-sm leading-[1.3125rem]">
                {display.leadIn ? <li className="font-semibold">{display.leadIn}</li> : null}
                {display.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2.5">
                    <PlanTick className={featured ? "text-white" : "text-brand"} />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {after}

      <p className="text-13 text-ink-2">
        {smallPrint ??
          "Prices in pounds sterling, excluding VAT. VAT is added at checkout where it applies. Payments are processed by Paddle, our merchant of record."}
      </p>
    </div>
  );
}
