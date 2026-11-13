import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/*
 * A list as ONE white card: its items are rows divided by hairlines, not separate cards.
 * The frame of every list in the product — tender rows, the phone form of a table, locked
 * rows, "Why this matches you". A toolbar (filters) or a foot (a "Show all" link) are rows
 * of the same card: give them `border-b` / `border-t` yourself or use <ListCardFoot>.
 *
 *   <ListCard as="ul" aria-label="Open tenders">
 *     <li className="p-4">…</li>
 *   </ListCard>
 *
 * Candidate for src/components/ui (beside card.tsx).
 */
type ListCardProps = ({ as?: "ul" } & ComponentProps<"ul">) | ({ as: "ol" } & ComponentProps<"ol">) | ({ as: "div" } & ComponentProps<"div">);

const CLASSES = "flex flex-col divide-y divide-line rounded-card border border-line bg-surface";

export function ListCard({ as = "ul", className, ...props }: ListCardProps) {
  if (as === "ol") return <ol data-slot="list-card" className={cn(CLASSES, className)} {...(props as ComponentProps<"ol">)} />;
  if (as === "div") return <div data-slot="list-card" className={cn(CLASSES, className)} {...(props as ComponentProps<"div">)} />;
  return <ul data-slot="list-card" className={cn(CLASSES, className)} {...(props as ComponentProps<"ul">)} />;
}

/** The last row of a list card: one line with a link or a note ("Show all 37 contracts"). */
export function ListCardFoot({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="list-card-foot" className={cn("flex flex-wrap items-center gap-x-4 px-4 py-1 text-sm text-ink-2 md:px-6", className)} {...props} />;
}
