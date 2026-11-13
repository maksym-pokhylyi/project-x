import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { ScrollableTabStop } from "./scrollable-tab-stop";

/*
 * One line of small things (chips, filter buttons) that scrolls sideways instead of
 * wrapping — for phone cards and toolbars, where a second line would push the content
 * down. The row bleeds through its parent's horizontal padding (`bleed` = that padding) so
 * items scroll off the card's edge, and the right edge fades while there is more to see.
 * No scrollbar is drawn; the items stay reachable by touch and trackpad, and by keyboard:
 * through their own focus, or — a row of plain chips — because the row itself becomes a Tab
 * stop while it overflows (<ScrollableTabStop>), so give such a row an `aria-label`.
 * From `wrapFrom` up the row wraps like any other.
 *
 *   <ScrollRow as="ul" aria-label="Why this matches" bleed="4" wrapFrom="md">…</ScrollRow>
 *
 * Candidate for src/components/ui.
 */
const BLEED = {
  "4": "-mx-4 px-4",
  "5": "-mx-5 px-5",
  "6": "-mx-6 px-6",
} as const;

const WRAP = {
  never: "",
  md: "md:mx-0 md:flex-wrap md:overflow-visible md:px-0",
  "container-md": "@2xl:mx-0 @2xl:flex-wrap @2xl:overflow-visible @2xl:px-0",
} as const;

type ScrollRowProps = { bleed?: keyof typeof BLEED; wrapFrom?: keyof typeof WRAP; fadeClassName?: string };

export function ScrollRow({ as, bleed = "4", wrapFrom = "never", fadeClassName = "from-surface", className, children, ...props }: ScrollRowProps & (({ as?: "div" } & ComponentProps<"div">) | ({ as: "ul" } & ComponentProps<"ul">))) {
  // `relative`: the row is the containing block of anything absolutely placed inside an item
  // (visually hidden text, say), so the scroller clips it instead of letting it widen the page.
  const rowClasses = cn("relative flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0", BLEED[bleed], WRAP[wrapFrom], className);
  const hideFade = wrapFrom === "md" ? "md:hidden" : wrapFrom === "container-md" ? "@2xl:hidden" : "";
  return (
    <div data-slot="scroll-row" className="relative min-w-0">
      {as === "ul" ? (
        <ul className={rowClasses} {...(props as ComponentProps<"ul">)}>
          {children}
        </ul>
      ) : (
        <div className={rowClasses} {...(props as ComponentProps<"div">)}>
          {children}
        </div>
      )}
      <ScrollableTabStop />
      <span aria-hidden className={cn("pointer-events-none absolute inset-y-0 w-6 bg-gradient-to-l to-transparent", bleed === "4" ? "-right-4" : bleed === "5" ? "-right-5" : "-right-6", fadeClassName, hideFade)} />
    </div>
  );
}
