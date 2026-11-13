import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A band of a public page. Vertical rhythm, as in the artboards: 56 px on phones, 80 px on
 * tablets, 96 px from 1024 px. Tones: paper (default), `deep` (paper-deep, no rules),
 * `surface` (white between two hairlines), `ink` (the independence band).
 */
export function Section({
  id,
  labelledBy,
  tone = "paper",
  className,
  containerClassName,
  children,
}: {
  id?: string;
  labelledBy?: string;
  tone?: "paper" | "deep" | "surface" | "ink";
  className?: string;
  containerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        "py-14 md:py-20 lg:py-24",
        tone === "deep" && "bg-paper-deep",
        tone === "surface" && "border-y border-line bg-surface",
        tone === "ink" && "on-ink bg-ink text-paper",
        className,
      )}
    >
      <div className={cn("container-content", containerClassName)}>{children}</div>
    </section>
  );
}

/** The small green line above a heading: 14 px, 600, sentence case. */
export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("type-eyebrow", className)}>{children}</p>;
}

/** Eyebrow + h2 + lead, left-aligned (editorial, not centred marketing). */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  className,
}: {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-[45rem] flex-col gap-3", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 id={id} className="type-h2 text-ink">
        {title}
      </h2>
      {lead ? <p className="type-lead mt-1 max-w-[42.5rem] text-ink">{lead}</p> : null}
    </div>
  );
}

/**
 * A point under a 2 px ink rule: a short bold line and one or two sentences. The rule is the
 * artboards' way of setting a claim apart without a card.
 */
export function Point({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5 border-t-2 border-ink pt-[1.125rem]", className)}>
      <h3 className="font-sans text-17 font-semibold text-ink">{title}</h3>
      <p className="text-15 leading-[1.45rem] text-ink">{children}</p>
    </div>
  );
}
