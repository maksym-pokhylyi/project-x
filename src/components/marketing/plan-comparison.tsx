"use client";

import { useEffect, useRef, useState } from "react";
import { useBillingInterval } from "@/components/billing/billing-interval";
import { COMPARISON, COMPARISON_NONE, planPrice, type ComparisonValue } from "@/config/plan-display";
import { PLANS, PLAN_KEYS } from "@/config/plans";
import { cn } from "@/lib/utils";

/** A cell: text, a tick ("Included") or a dash ("Not included" / "Not applicable"). */
function Value({ value }: { value: ComparisonValue }) {
  if (typeof value === "string") return value === COMPARISON_NONE ? <span className="text-ink-2">{value}</span> : <>{value}</>;
  if (value) {
    return (
      <svg viewBox="0 0 16 16" role="img" aria-label="Included" className="block size-4 fill-none stroke-brand stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]">
        <path d="M3 8.5l3.2 3.2L13 4.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" role="img" aria-label={value === null ? "Not applicable" : "Not included"} className="block size-4 fill-none stroke-ink-2 stroke-[1.6] [stroke-linecap:round]">
      <path d="M4 8h8" />
    </svg>
  );
}

/*
 * One table at every width, as on the pricing artboards. Two sizes, chosen by the width of
 * the table's own box (a container query, so it works in any column):
 *  - compact (under 904 px): 14 px, a 148 px first column that stays put while the plans
 *    scroll sideways, and the "Scroll sideways to compare" hint when they have to;
 *  - full (904 px and up): 15 px, 32% + 4 × 17%.
 */
const firstColumn = "sticky left-0 z-10 border-r border-line py-3 pr-3 pl-4 text-left @[56.5rem]:border-r-0 @[56.5rem]:pr-4 @[56.5rem]:pl-6";
const planColumn = "p-3 @[56.5rem]:px-4 @[56.5rem]:last:pr-6";

/**
 * "Compare the plans": every row is derived from the plan catalogue (src/config/plans.ts).
 * The prices in the column heads follow the Monthly / Annual toggle of the plan cards when
 * both sit inside one <BillingIntervalProvider>.
 */
export function PlanComparison({ labelledBy }: { labelledBy: string }) {
  const [interval] = useBillingInterval();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  /* A box that scrolls must be reachable by keyboard; one that fits must not be a tab stop. */
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setScrollable(element.scrollWidth > element.clientWidth + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="@container flex flex-col gap-4">
      <p className="-mt-2 flex items-center gap-1.5 text-13 text-ink-2 @[40.5rem]:hidden">
        <svg viewBox="0 0 16 16" aria-hidden className="size-4 shrink-0 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]">
          <path d="M2.5 8h11M5 5.5L2.5 8 5 10.5M11 5.5L13.5 8 11 10.5" />
        </svg>
        Scroll sideways to compare
      </p>

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div
          ref={scroller}
          {...(scrollable ? { tabIndex: 0, role: "region", "aria-labelledby": labelledBy } : {})}
          className="overflow-x-auto overscroll-x-contain focus-visible:-outline-offset-2"
        >
          <table
            aria-labelledby={labelledBy}
            data-testid="plan-comparison"
            className="w-full min-w-[40.25rem] table-fixed border-separate border-spacing-0 text-sm leading-[1.4] text-ink tabular-nums @[56.5rem]:text-15 @[56.5rem]:leading-[1.45]"
          >
            <colgroup>
              <col className="w-[9.25rem] @[56.5rem]:w-[32%]" />
              {PLAN_KEYS.map((key) => (
                <col key={key} className="w-[7.75rem] @[56.5rem]:w-[17%]" />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className={cn(firstColumn, "border-b bg-surface align-bottom text-xs leading-[inherit] font-semibold text-ink-2 @[56.5rem]:pt-[1.125rem] @[56.5rem]:pb-4")}>
                  What you get
                </th>
                {PLAN_KEYS.map((key) => {
                  const plan = PLANS[key];
                  return (
                    <th key={key} scope="col" className={cn(planColumn, "border-b border-line text-left align-bottom font-normal @[56.5rem]:pt-[1.125rem] @[56.5rem]:pb-4")}>
                      {plan.recommended ? (
                        <span className="mb-1 inline-block rounded-chip bg-brand px-1.5 py-px text-xs leading-[inherit] font-semibold text-white @[56.5rem]:mb-1.5 @[56.5rem]:px-2 @[56.5rem]:py-0.5">
                          Recommended
                        </span>
                      ) : null}
                      <span className="block text-sm leading-[inherit] font-semibold @[56.5rem]:text-base @[56.5rem]:leading-[inherit]">{plan.name}</span>
                      <span className="block text-xs leading-[inherit] text-ink-2 @[56.5rem]:text-13 @[56.5rem]:leading-[inherit]" data-testid={`compare-price-${key}`}>
                        {planPrice(key, interval).line}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            {COMPARISON.map((group, groupIndex) => (
              <tbody key={group.title}>
                <tr>
                  {/* The group title stays put while the plans scroll; the rest of its row is an empty band. */}
                  <th
                    scope="rowgroup"
                    className="sticky left-0 z-10 border-b border-line bg-paper py-2 pr-3 pl-4 text-left text-13 leading-[inherit] font-semibold whitespace-nowrap @[56.5rem]:py-2.5 @[56.5rem]:pl-6"
                  >
                    {group.title}
                  </th>
                  <td colSpan={PLAN_KEYS.length} className="border-b border-line bg-paper" />
                </tr>
                {group.rows.map((row, rowIndex) => {
                  /* The card's own edge closes the table: the last row has no rule. */
                  const rule = groupIndex === COMPARISON.length - 1 && rowIndex === group.rows.length - 1 ? undefined : "border-b";
                  return (
                    <tr key={row.label}>
                      <th scope="row" className={cn(firstColumn, "bg-surface align-middle font-medium @[56.5rem]:py-3.5", rule)}>
                        {row.label}
                      </th>
                      {PLAN_KEYS.map((key) => (
                        <td key={key} className={cn(planColumn, "border-line align-middle @[56.5rem]:py-3.5", rule)}>
                          <Value value={row.values[key]} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </div>
  );
}
