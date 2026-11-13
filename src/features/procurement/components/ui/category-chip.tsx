import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Category chip (styleguide: "Category chip"): a trade, a category or a place as a quiet
 * 13 px label on paper-deep, optionally led by its code in mono — "45261900 Roof repair".
 * Larger and calmer than <Badge>: it names what something IS, it is not a status.
 * `hideCodeOnPhone` drops the code under 768 px, where the label alone must fit.
 *
 *   <CategoryChipList label="Trades">
 *     <CategoryChip code="45261900">Roof repair</CategoryChip>
 *   </CategoryChipList>
 *
 * Candidate for src/components/ui.
 */
export function CategoryChip({
  code,
  hideCodeOnPhone = false,
  className,
  children,
}: {
  code?: string | null;
  hideCodeOnPhone?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span data-slot="category-chip" className={cn("inline-block max-w-full rounded-chip bg-paper-deep px-2.5 py-1 text-13 leading-[1.1875rem] text-ink [overflow-wrap:anywhere]", className)}>
      {code ? <span className={cn("mr-1 font-mono text-xs text-ink-2", hideCodeOnPhone && "max-md:hidden")}>{code}</span> : null}
      {children}
    </span>
  );
}

/** A wrapping row of category chips as a labelled list. */
export function CategoryChipList({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <ul data-slot="category-chip-list" aria-label={label} className={cn("flex flex-wrap gap-2 [&>li]:flex [&>li]:max-w-full", className)}>
      {children}
    </ul>
  );
}
