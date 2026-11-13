import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A band of a marketing page. Vertical rhythm is 64 px on phones and 96 px from 1024 px;
 * `tone="sunken"` puts the band on the sunken surface between two hairlines.
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
  tone?: "paper" | "sunken" | "surface";
  className?: string;
  containerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        "py-16 lg:py-24",
        tone === "sunken" && "border-y border-line bg-surface-sunken",
        tone === "surface" && "border-y border-line bg-surface",
        className,
      )}
    >
      <div className={cn("container-content", containerClassName)}>{children}</div>
    </section>
  );
}

/** The only all-caps element in the system: a 12 px label above a heading. */
export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("type-eyebrow text-brand", className)}>{children}</p>;
}

/** Eyebrow + h2 + lead, left-aligned by default (editorial, not centred marketing). */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  align = "left",
  className,
}: {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 id={id} className={cn("type-h2 text-ink lg:text-3xl", eyebrow && "mt-3")}>
        {title}
      </h2>
      {lead ? <p className="type-lead mt-4">{lead}</p> : null}
    </div>
  );
}

/** Numbered or ticked point: a short bold line and one or two sentences. */
export function Point({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h3 className="font-sans text-base leading-6 font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-base text-ink-2">{children}</p>
    </div>
  );
}
