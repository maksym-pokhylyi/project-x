"use client";

import { Fragment, useState } from "react";
import { filterChipClasses } from "@/components/ui/filter-chip";
import { radioGroupKeyDown } from "@/components/ui/radio-keys";
import { BID_PASS, COMPARISON, planPrice, type ComparisonValue } from "@/config/plan-display";
import { PLANS, PLAN_KEYS, type PlanKey } from "@/config/plans";
import { cn } from "@/lib/utils";

function Value({ value, plan, label, align = "center" }: { value: ComparisonValue; plan: string; label: string; align?: "center" | "end" }) {
  if (typeof value === "string") return <>{value}</>;
  return (
    <>
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className={cn(
          "size-4 fill-none stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]",
          value ? "stroke-brand" : "stroke-line-strong",
          align === "center" ? "mx-auto" : "ml-auto",
        )}
      >
        {value ? <path d="M3 8.5l3.2 3.2L13 4.8" /> : <path d="M4.5 8h7" />}
      </svg>
      <span className="sr-only">
        {label}: {value ? "included" : "not included"} in {plan}
      </span>
    </>
  );
}

const priceLine = (key: PlanKey) => {
  const price = planPrice(key, "month");
  return price.period ? `${price.amount} ${price.period}` : price.amount;
};

/**
 * Plan comparison (docs/product/SPEC.md §5), rendered from the display adapter, in the table
 * style of the supplier page: a white card, small muted column heads, hairline rows.
 *  - from 768 px: one table, plans as columns;
 *  - on phones: pick a plan and read its column as a list — no sideways scrolling.
 */
export function PlanComparison({ labelledBy }: { labelledBy: string }) {
  const [selected, setSelected] = useState<PlanKey>("pro");
  const plan = PLANS[selected];

  return (
    <>
      {/* Phones: one plan at a time. */}
      <div className="md:hidden">
        <div role="radiogroup" aria-label="Plan to show" className="flex flex-wrap gap-2">
          {PLAN_KEYS.map((key) => {
            const checked = key === selected;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={checked}
                data-value={key}
                tabIndex={checked ? 0 : -1}
                onClick={() => setSelected(key)}
                onKeyDown={(event) => radioGroupKeyDown(event, PLAN_KEYS, selected, setSelected)}
                className={filterChipClasses(checked)}
              >
                {PLANS[key].name}
              </button>
            );
          })}
        </div>

        <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface" aria-live="polite">
          <p className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-4">
            <span className="type-h3 text-ink">{plan.name}</span>
            <span className="text-sm text-ink-2 tabular-nums">{priceLine(selected)}</span>
          </p>
          {COMPARISON.map((group) => (
            <section key={group.title} aria-label={`${group.title}: ${plan.name}`}>
              <h3 className="border-b border-line bg-paper px-5 py-2 font-sans text-xs leading-[1.125rem] font-semibold text-ink-2">{group.title}</h3>
              <dl>
                {group.rows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-b border-line px-5 py-3.5">
                    <dt className="text-sm text-ink">
                      <span className="font-semibold">{row.label}</span>
                      {row.detail ? <span className="mt-0.5 block text-13 text-ink-2">{row.detail}</span> : null}
                    </dt>
                    <dd className="max-w-32 text-right text-sm text-ink tabular-nums">
                      <Value value={row.values[selected]} plan={plan.name} label={row.label} align="end" />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-5 py-3.5">
            <p className="text-sm text-ink">
              <span className="font-semibold">{BID_PASS.name}</span>
              <span className="mt-0.5 block text-13 text-ink-2">{BID_PASS.summary}</span>
            </p>
            <p className="max-w-32 text-right text-sm text-ink tabular-nums">
              {BID_PASS.price} {BID_PASS.period}
            </p>
          </div>
        </div>
      </div>

      {/* Tablets and up: the full table. */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
        <table aria-labelledby={labelledBy} className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-[34%] border-b border-line px-6 py-4 text-left align-bottom text-xs leading-[1.125rem] font-semibold text-ink-2">
                What you get
              </th>
              {PLAN_KEYS.map((key) => (
                <th key={key} scope="col" className="border-b border-line px-3 py-4 text-center align-bottom last:pr-6">
                  <span className="block font-display text-17 leading-6 font-semibold text-ink">{PLANS[key].name}</span>
                  <span className="block text-13 font-normal text-ink-2">{priceLine(key)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((group) => (
              <Fragment key={group.title}>
                <tr>
                  <th scope="colgroup" colSpan={PLAN_KEYS.length + 1} className="border-b border-line bg-paper px-6 py-2.5 text-left text-xs leading-[1.125rem] font-semibold text-ink-2">
                    {group.title}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label} className="transition-colors duration-100 hover:bg-brand-tint/50">
                    <th scope="row" className="border-b border-line py-3.5 pr-4 pl-6 text-left align-top font-normal">
                      <span className="block font-semibold text-ink">{row.label}</span>
                      {row.detail ? <span className="mt-0.5 block text-13 text-ink-2">{row.detail}</span> : null}
                    </th>
                    {PLAN_KEYS.map((key) => (
                      <td key={key} className="border-b border-line px-3 py-3.5 text-center align-top text-ink last:pr-6">
                        <Value value={row.values[key]} plan={PLANS[key].name} label={row.label} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr>
              <th scope="row" className="py-3.5 pr-4 pl-6 text-left align-top font-normal">
                <span className="block font-semibold text-ink">{BID_PASS.name}</span>
                <span className="mt-0.5 block text-13 text-ink-2">{BID_PASS.summary}</span>
              </th>
              <td colSpan={PLAN_KEYS.length} className="px-3 py-3.5 pr-6 text-center align-top text-ink">
                {BID_PASS.price} {BID_PASS.period}, on any plan
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
