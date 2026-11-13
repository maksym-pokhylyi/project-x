import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The header of an app page, as in the bid brief artboard: an optional meta line in mono
 * ("Bid brief · built 13 Nov 2026 at 09:42 · 6 files"), the title in the display serif
 * (26 px on phones, 36 px from 768 px), one line under it, and the actions at the right,
 * aligned to the bottom of the title block.
 *
 * `level={2}` is for a page that sits under a shared title and tabs (the Settings pages):
 * the title becomes an h2 at section size.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  meta,
  level = 1,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Meta line above the title, set in mono. */
  eyebrow?: ReactNode;
  /** A row under the description: a deadline marker, status pills. */
  meta?: ReactNode;
  level?: 1 | 2;
  className?: string;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-10 gap-y-5", className)}>
      <div className="flex min-w-0 flex-[1_1_30rem] flex-col gap-2">
        {eyebrow ? <p className="type-ref text-ink-2">{eyebrow}</p> : null}
        <Heading className={cn(level === 1 ? "type-title" : "type-section", "text-ink")}>{title}</Heading>
        {description ? <p className={cn("max-w-[42.5rem] text-ink-2", level === 1 ? "text-15" : "text-sm")}>{description}</p> : null}
        {meta ? <div className="mt-1 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex max-w-full flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

/**
 * Empty state: one sentence about what belongs here, one action, optionally an example.
 * No illustration.
 */
export function EmptyState({
  title,
  description,
  action,
  example,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  example?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-card border border-dashed border-line-strong px-6 py-10 text-center sm:py-12", className)}>
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-15 text-ink-2">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      {example ? <div className="mx-auto mt-6 max-w-md border-t border-line pt-5 text-left text-13 text-ink-2">{example}</div> : null}
    </div>
  );
}

/**
 * A titled group of content on an app page, as in the artboards: a serif heading (28 px) with
 * one muted line beside or under it, then the content.
 */
export function PageSection({ title, description, action, children, className }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="type-section text-ink">{title}</h2>
          {description ? <p className="text-sm text-ink-2">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
