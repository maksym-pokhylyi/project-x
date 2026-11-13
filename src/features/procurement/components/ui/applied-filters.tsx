import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Filters that are in force, each as a removable chip, with "Clear" for all of them:
 *
 *   [Closing within: 90 days ✕]  [Region: Yorkshire and the Humber ✕]   Clear
 *
 * Filters live in the URL, so removing one is a LINK to the same page without it (it works
 * without script and can be opened in a new tab). The whole chip is the target; the ✕ is
 * decoration and the accessible name says what happens: "Remove filter Closing within: 90 days".
 *
 *   <AppliedFilters clearHref="/app?tab=matches" items={[{ label: "Closing within", value: "90 days", href: "…" }]} />
 *
 * Candidate for src/components/ui (beside filter-chip.tsx).
 */
export type AppliedFilter = { label: string; value: ReactNode; href: string };

export function AppliedFilters({ items, clearHref, className }: { items: AppliedFilter[]; clearHref: string; className?: string }) {
  if (items.length === 0) return null;
  return (
    <div data-slot="applied-filters" className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)} data-testid="applied-filters">
      <ul aria-label="Filters in use" className="flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <li key={item.label} className="flex">
            <Link href={item.href} scroll={false} className="inline-flex min-h-11 cursor-pointer items-center rounded-chip bg-paper-deep pl-3 text-sm font-medium text-ink transition-colors duration-150 hover:bg-line">
              <span className="sr-only">Remove filter </span>
              <span>
                {item.label}: {item.value}
              </span>
              <span aria-hidden className="grid size-11 shrink-0 place-items-center">
                <svg viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round]">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={clearHref} scroll={false} className="link inline-flex min-h-11 items-center rounded-sm px-1 text-sm font-medium">
        Clear<span className="sr-only"> all filters</span>
      </Link>
    </div>
  );
}
