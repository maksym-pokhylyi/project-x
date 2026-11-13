import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * A list of things you get, each led by a small brand-green tick: "What claiming gives you,
 * free". 15 px ink; the tick is decoration (the list itself says it is a list).
 *
 *   <TickList items={["Your radar, with your top 10 matches", "A weekly digest by email"]} />
 *
 * Candidate for src/components/ui.
 */
export function TickList({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul data-slot="tick-list" className={cn("flex flex-col gap-2.5 text-15 text-ink", className)}>
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2.5">
          <svg viewBox="0 0 16 16" aria-hidden className="mt-0.5 size-4 shrink-0 fill-none stroke-brand stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]">
            <path d="M3 8.5l3.2 3.2L13 4.8" />
          </svg>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}
