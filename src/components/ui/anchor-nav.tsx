import type { ReactNode } from "react";
import { TabsCount } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/*
 * In-page section links, drawn on the same hairline as tabs: "Open tenders 14 · Your wins 37
 * · Rivals 4 · Buyers 5". They jump to a heading on THIS page, so none of them is ever "the
 * current page" — no current state, no aria-current (that is <NavLink>'s job, for
 * navigation between pages). Plain anchors: they work without script.
 *
 * The row scrolls sideways on phones, bleeding into the page gutter (pass the gutter as
 * `bleed`), with a fade on the right edge while there is more to scroll to.
 *
 *   <AnchorNav items={[{ href: "#open-tenders", label: "Open tenders", count: 14 }, …]} />
 *
 * Candidate for src/components/ui.
 */
export type AnchorNavItem = { href: string; label: ReactNode; count?: ReactNode };

export function AnchorNav({ items, className }: { items: AnchorNavItem[]; className?: string }) {
  return (
    <nav aria-label="On this page" data-slot="anchor-nav" className={cn("relative", className)}>
      <ul className="-mx-5 flex gap-x-6 overflow-x-auto border-b border-line px-5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:gap-x-8 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.href} className="flex shrink-0">
            <a
              href={item.href}
              className="-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 border-transparent text-sm font-medium whitespace-nowrap text-ink -outline-offset-2 transition-colors duration-150 hover:border-line-strong hover:text-brand md:min-h-12 md:gap-2 md:text-15"
            >
              {item.label}
              {item.count !== undefined && item.count !== null ? <TabsCount>{item.count}</TabsCount> : null}
            </a>
          </li>
        ))}
      </ul>
      <span aria-hidden className="pointer-events-none absolute top-0 -right-5 bottom-px w-8 bg-gradient-to-l from-paper to-transparent md:hidden" />
    </nav>
  );
}
