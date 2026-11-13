import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The header pattern of every app page: an optional eyebrow, the page title in the display
 * serif (22/28 on phones, 28/34 from 640 px), one line of description, actions on the right
 * and an optional row beneath for meta such as a deadline or status.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  meta,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="type-eyebrow mb-1.5 text-ink-2">{eyebrow}</p> : null}
        <h1 className="type-h3 font-semibold text-ink sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-reading text-sm text-ink-2">{description}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
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
      <h2 className="font-sans text-base leading-6 font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      {example ? <div className="mx-auto mt-6 max-w-md border-t border-line pt-5 text-left text-13 text-ink-2">{example}</div> : null}
    </div>
  );
}

/** A titled group of content on an app page, with an optional action aligned to the title. */
export function PageSection({ title, description, action, children, className }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="type-h3 text-ink">{title}</h2>
          {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
