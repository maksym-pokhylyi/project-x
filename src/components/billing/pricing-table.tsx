"use client";

import { useId, type ReactNode } from "react";
import { useBillingInterval } from "@/components/billing/billing-interval";
import { Badge } from "@/components/ui/badge";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { ANNUAL_SAVING, planDisplay } from "@/config/plan-display";
import { PLANS, PLAN_KEYS, type BillingInterval, type Plan, type PlanKey } from "@/config/plans";
import { cn } from "@/lib/utils";

/** Context handed to `renderAction`: a featured card is brand green, so its button is white. */
export type PlanActionContext = { featured: boolean };

/** The tick of a plan's feature list, as drawn in the artboards. */
export function PlanTick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn("mt-0.5 size-4 shrink-0 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]", className)}>
      <path d="M3 8.5l3.2 3.2L13 4.8" />
    </svg>
  );
}

const INTERVAL_OPTIONS = [
  { value: "month", label: "Monthly", testId: "interval-month" },
  { value: "year", label: "Annual", testId: "interval-year" },
] as const;


/**
 * Plan cards, rendered from the plan catalogue (src/config/plans.ts, through the display
 * adapter) and laid out as on the pricing artboards: name and one line, a large serif price
 * with the other billing period under it, the action, then the feature lines. The
 * recommended plan is filled brand green and carries a "Recommended" chip.
 *
 * Used on the landing page (monthly prices, no toggle), on /pricing (Monthly / Annual
 * toggle) and on Billing (checkout and change-plan actions): the caller decides what each
 * card's action is through `renderAction`. The chosen period is shared with the rest of the
 * page when it is wrapped in <BillingIntervalProvider>.
 */
export function PricingTable({
  renderAction,
  currentPlan,
  defaultInterval = "month",
  layout = "wide",
  toggle = true,
  highlightRecommended = true,
  headingLevel = 3,
  after,
  smallPrint,
}: {
  renderAction: (plan: Plan, interval: BillingInterval, context: PlanActionContext) => ReactNode;
  currentPlan?: PlanKey;
  defaultInterval?: BillingInterval;
  /** "wide": four across from 1024 px (public pages). "compact": two across (inside the app). */
  layout?: "wide" | "compact";
  /** The Monthly / Annual toggle. Off on the landing page, which shows monthly prices. */
  toggle?: boolean;
  /** Fill the recommended plan brand green. Off inside the app, where the current plan leads. */
  highlightRecommended?: boolean;
  /** Level of the plan names: 2 when the cards sit directly under the page title. */
  headingLevel?: 2 | 3;
  /** A full-width band after the cards (the Bid Pass). On phones it sits before the last plan, as in the artboard. */
  after?: ReactNode;
  /** The line under the cards. Defaults to the VAT line; pass `null` for none. */
  smallPrint?: ReactNode;
}) {
  const [interval, setInterval] = useBillingInterval(defaultInterval);
  const groupId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    /* Phones: the toggle and every action in the cards are 48 px (the 390 px boards); 44 px from 640 px. */
    <div className="flex flex-col gap-5 max-sm:controls-md">
      {toggle ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SegmentedToggle
            aria-label="Billing period"
            value={interval}
            onValueChange={setInterval}
            options={INTERVAL_OPTIONS}
            className="max-sm:w-full max-sm:[&>button]:min-w-0 max-sm:[&>button]:flex-1 max-sm:[&>button]:px-3"
          />
          <p className="text-13 text-ink-2 sm:text-sm">Annual billing gives {ANNUAL_SAVING}.</p>
        </div>
      ) : null}

      <ul className={cn("grid gap-3.5 sm:grid-cols-2 sm:gap-5", layout === "wide" && "lg:grid-cols-4")}>
        {PLAN_KEYS.map((key, index) => {
          const display = planDisplay(key);
          const price = interval === "year" ? display.annual : display.monthly;
          const isCurrent = currentPlan === key;
          const featured = highlightRecommended && display.recommended;
          const titleId = `${groupId}-${key}`;
          const chip = isCurrent ? (
            <Badge variant="secondary" className={cn(featured && "bg-white/15 text-white")}>
              Current plan
            </Badge>
          ) : display.recommended ? (
            <Badge className={cn(featured && "bg-white text-brand")}>Recommended</Badge>
          ) : null;
          return (
            <li
              key={key}
              data-testid={`plan-${key}`}
              aria-labelledby={titleId}
              className={cn(
                "flex flex-col gap-3.5 rounded-card border p-5 sm:gap-5 sm:px-6 sm:py-[1.625rem]",
                featured ? "on-brand border-brand bg-brand text-white" : "border-line bg-surface text-ink",
                /* On phones the Bid Pass band sits between the third and the fourth plan. */
                after && index === PLAN_KEYS.length - 1 && "max-sm:order-last",
              )}
            >
              {/* Phones: chip, then name and price on one line, then the short summary beside the other period.
                  From 640 px: name (chip beside it) and summary, then the price with the other period under it. */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 sm:grid-cols-1 sm:gap-y-0">
                {chip ? <div className="col-span-2 mb-1 flex sm:hidden">{chip}</div> : null}
                <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 sm:col-start-1">
                  <Heading id={titleId} className="font-display text-[1.375rem] leading-[1.2] font-semibold tracking-normal sm:text-2xl sm:leading-[1.2] sm:tracking-normal">
                    {display.name}
                  </Heading>
                  {chip ? <div className="hidden sm:flex">{chip}</div> : null}
                </div>
                <p className="flex flex-wrap items-baseline justify-end gap-x-[0.3125rem] sm:col-start-1 sm:row-start-3 sm:mt-5 sm:justify-start sm:gap-x-1.5">
                  <span className="type-figure text-[1.875rem] leading-[1.15] tracking-[-0.02em] sm:text-[2.75rem] sm:leading-none" data-testid={`price-${key}`}>
                    {price.amount}
                  </span>
                  {price.period ? <span className={cn("text-13 leading-[1.5] sm:text-sm sm:leading-[1.5]", !featured && "text-ink-2")}>{price.period}</span> : null}
                </p>
                <p
                  className={cn(
                    "sm:col-start-1 sm:row-start-2 sm:mt-1 sm:text-sm sm:leading-[1.45]",
                    /* With no second period to show (Free), the summary takes the whole line at 14 px. */
                    price.note ? "text-13 leading-[1.5]" : "col-span-2 text-sm leading-[1.45]",
                    layout === "wide" && "lg:min-h-[2.6875rem]",
                    !featured && "text-ink-2",
                  )}
                >
                  <span className="sm:hidden">{display.summaryShort}</span>
                  <span className="hidden sm:inline">{display.summary}</span>
                </p>
                <p
                  className={cn(
                    "text-right text-13 leading-[1.5] whitespace-nowrap sm:col-start-1 sm:row-start-4 sm:mt-1 sm:min-h-[1.375rem] sm:text-left",
                    !price.note && "max-sm:hidden",
                    !featured && "text-ink-2",
                  )}
                >
                  {price.note}
                </p>
              </div>

              <div className="order-last sm:order-none">{renderAction(PLANS[key], interval, { featured })}</div>

              <ul className="flex flex-1 flex-col gap-2 text-sm leading-[1.45] sm:gap-2.5">
                {display.leadIn ? <li className="font-semibold">{display.leadIn}</li> : null}
                {display.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-2.5">
                    <PlanTick className={featured ? "text-white" : "text-brand"} />
                    <span>
                      {feature.lead ? <span className="font-semibold">{feature.lead} </span> : null}
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
        {after ? <li className="col-span-full max-sm:order-3">{after}</li> : null}
      </ul>

      {/* 40 px under the Bid Pass band, as the outer rhythm of the artboard (18 px on phones). */}
      {smallPrint === null ? null : (
        <p className="-mt-0.5 text-13 leading-[1.5] text-ink-2 sm:mt-5">{smallPrint ?? "Prices exclude VAT. VAT is added at checkout where it applies."}</p>
      )}
    </div>
  );
}
