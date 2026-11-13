import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * A numbered step as a card: the number in mono ("01"), a serif heading, a short body and
 * one action at the foot. Three in a row make "Three things to do first". A finished step
 * says "Done" beside its number (words and a tick, not colour alone) — its action stays,
 * because the step can be revisited.
 *
 *   <NumberedCard number={2} title="Add your company documents" action={<ButtonLink …>Go to Documents</ButtonLink>}>…</NumberedCard>
 *
 * Use inside a <ol> via `as="li"`. Candidate for src/components/ui.
 */
export function NumberedCard({
  number,
  title,
  children,
  action,
  done = false,
  as: Tag = "div",
  className,
}: {
  number: number;
  title: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  done?: boolean;
  as?: "div" | "li";
  className?: string;
}) {
  return (
    <Tag data-slot="numbered-card" data-done={done ? "" : undefined} className={cn("flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4 md:p-6", className)}>
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-2 font-mono text-13 text-ink-2">
          <span aria-hidden>{String(number).padStart(2, "0")}</span>
          <span className="sr-only">Step {number}</span>
          {done ? (
            <span className="inline-flex items-center gap-1 font-sans text-xs font-semibold text-brand">
              <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]">
                <path d="M3 8.5l3.2 3.2L13 4.8" />
              </svg>
              Done
            </span>
          ) : null}
        </p>
        <h3 className="type-h3 text-ink">{title}</h3>
      </div>
      <div className="flex flex-1 flex-col gap-3 text-15 text-ink">{children}</div>
      {/* The action fills the card on a phone and keeps its own width from 768 px. */}
      {action ? <div className="flex pt-1 max-md:[&>*]:flex-1">{action}</div> : null}
    </Tag>
  );
}
