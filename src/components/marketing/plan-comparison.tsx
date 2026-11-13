"use client";

import { Check, Minus } from "lucide-react";
import { Fragment, useState } from "react";
import { radioGroupKeyDown } from "@/components/ui/radio-keys";
import { BID_PASS, COMPARISON, planPrice, type ComparisonValue } from "@/config/plan-display";
import { PLANS, PLAN_KEYS, type PlanKey } from "@/config/plans";
import { cn } from "@/lib/utils";

function Value({ value, plan, label, align = "center" }: { value: ComparisonValue; plan: string; label: string; align?: "center" | "end" }) {
  if (value === true) {
    return (
      <>
        <Check aria-hidden className={cn("size-4 text-success", align === "center" ? "mx-auto" : "ml-auto")} />
        <span className="sr-only">
          {label}: included in {plan}
        </span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus aria-hidden className={cn("size-4 text-ink-3", align === "center" ? "mx-auto" : "ml-auto")} />
        <span className="sr-only">
          {label}: not included in {plan}
        </span>
      </>
    );
  }
  return <>{value}</>;
}

/**
 * Plan comparison (docs/product/SPEC.md §5), rendered from the display adapter.
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
        <div role="radiogroup" aria-label="Plan to show" className="grid grid-cols-2 gap-2">
          {PLAN_KEYS.map((key) => {
            const checked = key === selected;
            const price = planPrice(key, "month");
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
                className={cn(
                  "flex min-h-14 flex-col items-start justify-center rounded-card border px-3 py-2 text-left transition-colors duration-150",
                  checked ? "border-brand bg-brand-tint ring-1 ring-brand" : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span className={cn("text-sm font-semibold", checked ? "text-brand" : "text-ink")}>{PLANS[key].name}</span>
                <span className="text-13 text-ink-2 tabular-nums">
                  {price.amount}
                  {price.period ? ` ${price.period}` : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface" aria-live="polite">
          {COMPARISON.map((group) => (
            <section key={group.title} aria-label={`${group.title}: ${plan.name}`}>
              <h3 className="type-eyebrow border-b border-line bg-surface-sunken px-4 py-2 text-ink-2">{group.title}</h3>
              <dl>
                {group.rows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-b border-line px-4 py-3">
                    <dt className="text-sm text-ink">
                      <span className="font-medium">{row.label}</span>
                      {row.detail ? <span className="mt-0.5 block text-13 text-ink-2">{row.detail}</span> : null}
                    </dt>
                    <dd className="max-w-32 text-right text-sm font-medium text-ink tabular-nums">
                      <Value value={row.values[selected]} plan={plan.name} label={row.label} align="end" />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-4 py-3">
            <p className="text-sm text-ink">
              <span className="font-medium">{BID_PASS.name}</span>
              <span className="mt-0.5 block text-13 text-ink-2">{BID_PASS.summary}</span>
            </p>
            <p className="max-w-32 text-right text-sm font-medium text-ink tabular-nums">
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
              <th scope="col" className="w-[34%] border-b border-line bg-surface px-4 py-3 text-left align-bottom text-13 font-medium text-ink-2">
                What you get
              </th>
              {PLAN_KEYS.map((key) => (
                <th key={key} scope="col" className="border-b border-line bg-surface px-3 py-3 text-center align-bottom">
                  <span className="block text-sm font-semibold text-ink">{PLANS[key].name}</span>
                  <span className="block text-13 font-normal text-ink-2 tabular-nums">
                    {planPrice(key, "month").amount}
                    {planPrice(key, "month").period ? " a month" : ""}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((group) => (
              <Fragment key={group.title}>
                <tr>
                  <th scope="colgroup" colSpan={PLAN_KEYS.length + 1} className="border-b border-line bg-surface-sunken px-4 py-2 text-left">
                    <span className="type-eyebrow text-ink-2">{group.title}</span>
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label} className="hover:bg-brand-tint/40">
                    <th scope="row" className="border-b border-line px-4 py-3 text-left align-top font-normal">
                      <span className="block font-medium text-ink">{row.label}</span>
                      {row.detail ? <span className="mt-0.5 block text-13 text-ink-2">{row.detail}</span> : null}
                    </th>
                    {PLAN_KEYS.map((key) => (
                      <td key={key} className="border-b border-line px-3 py-3 text-center align-top text-ink tabular-nums">
                        <Value value={row.values[key]} plan={PLANS[key].name} label={row.label} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr>
              <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                <span className="block font-medium text-ink">{BID_PASS.name}</span>
                <span className="mt-0.5 block text-13 text-ink-2">{BID_PASS.summary}</span>
              </th>
              <td colSpan={PLAN_KEYS.length} className="px-3 py-3 text-center align-top text-ink">
                {BID_PASS.price} {BID_PASS.period}, on any plan
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
