import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Key facts as a definition list: a muted 13 px label in a fixed column and the value in
 * 15 px ink beside it — "Estimated value  £4.2m, excluding VAT". Rows are top-aligned on
 * their first baselines, so a value may run to several lines. Tabular figures.
 *
 *   <KeyFacts items={[{ label: "Lots", value: "Not divided into lots" }]} />
 *
 * Items with an empty value are skipped. Candidate for src/components/ui.
 */
export type KeyFact = { label: string; value: ReactNode };

export function KeyFacts({ items, className }: { items: KeyFact[]; className?: string }) {
  const shown = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== false && item.value !== "");
  if (shown.length === 0) return null;
  return (
    <dl data-slot="key-facts" className={cn("flex flex-col gap-3 text-15 tabular-nums", className)}>
      {shown.map((item) => (
        <div key={item.label} className="flex items-baseline gap-3 md:gap-4">
          <dt className="w-[6.75rem] shrink-0 text-13 text-ink-2 md:w-[7.5rem]">{item.label}</dt>
          <dd className="min-w-0 flex-1 text-ink [overflow-wrap:anywhere]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
