import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Empty state, as the "No open tenders match right now" artboard: a white card, a serif
 * heading that says what is not here, one paragraph that says why and what happens next,
 * and at most two actions (one button, one link). Left-aligned; no illustration.
 *
 *   <EmptyState title="No open tenders match right now" actions={<>…</>} note="Matching on 3 trades and 3 regions.">
 *     Nothing on Find a Tender matches your trades and regions today…
 *   </EmptyState>
 *
 * `note` is one muted line under the card. `plain` drops the card (inside another card).
 * Candidate for src/components/ui.
 */
export function EmptyState({
  title,
  children,
  actions,
  note,
  headingLevel = "h2",
  plain = false,
  className,
  ...props
}: {
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
  headingLevel?: "h2" | "h3" | "p";
  plain?: boolean;
  className?: string;
  "data-testid"?: string;
}) {
  const Heading = headingLevel;
  return (
    <div data-slot="empty-state" className={cn("flex flex-col gap-3", className)} data-testid={props["data-testid"] ?? "empty-state"}>
      <div className={cn("flex flex-col items-start gap-2.5", plain ? "px-4 py-6 md:px-6 md:py-8" : "rounded-card border border-line bg-surface p-5 md:p-8")}>
        <Heading className="type-h3 text-ink">{title}</Heading>
        {children ? <div className="max-w-[42.5rem] text-base text-ink">{children}</div> : null}
        {actions ? <div className="flex w-full flex-col gap-x-5 gap-y-1 pt-2 md:w-auto md:flex-row md:flex-wrap md:items-center">{actions}</div> : null}
      </div>
      {note ? <p className="text-sm text-ink-2">{note}</p> : null}
    </div>
  );
}
