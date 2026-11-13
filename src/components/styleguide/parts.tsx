import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A numbered section of the styleguide with an anchor. */
export function GuideSection({ id, title, lead, children }: { id: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-line pt-10 first:border-t-0 first:pt-0">
      <h2 id={`${id}-title`} className="type-h2 text-ink">
        {title}
      </h2>
      {lead ? <p className="mt-2 max-w-reading text-base text-ink-2">{lead}</p> : null}
      <div className="mt-8 space-y-10">{children}</div>
    </section>
  );
}

/** A titled group inside a section. */
export function Group({ title, note, children, className }: { title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h3 className="font-sans text-base leading-6 font-semibold text-ink">{title}</h3>
      {note ? <p className="mt-1 max-w-reading text-sm text-ink-2">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** A labelled specimen: the thing itself above, its name (and state) below. */
export function Specimen({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      {children}
      <span className="type-ref text-ink-2">{label}</span>
    </div>
  );
}

/** Row of specimens that wraps. */
export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-end gap-x-6 gap-y-5", className)}>{children}</div>;
}

/** A bordered canvas for showing components on a given surface. */
export function Canvas({ tone = "paper", children, className }: { tone?: "paper" | "surface" | "sunken" | "brand"; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-card border border-line p-5",
        tone === "paper" && "bg-paper",
        tone === "surface" && "bg-surface",
        tone === "sunken" && "bg-surface-sunken",
        tone === "brand" && "on-brand border-brand bg-brand text-paper",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Inline code. */
export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-control bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.8125rem] whitespace-nowrap text-ink">{children}</code>;
}

/** A block of code to copy. */
export function Snippet({ children }: { children: string }) {
  return (
    <pre tabIndex={0} className="overflow-x-auto rounded-card border border-line bg-surface-sunken p-4 font-mono text-13 leading-5 text-ink">
      <code>{children}</code>
    </pre>
  );
}

/** A colour token: swatch, utility name, value, what it is for. */
export function Swatch({ name, value, use, className, bordered = false }: { name: string; value: string; use: string; className: string; bordered?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className={cn("mt-0.5 size-10 shrink-0 rounded-control", bordered && "border border-line", className)} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          <span className="font-mono text-13">{name}</span>
        </p>
        <p className="type-ref text-ink-2 uppercase">{value}</p>
        <p className="mt-0.5 text-13 text-ink-2">{use}</p>
      </div>
    </div>
  );
}
