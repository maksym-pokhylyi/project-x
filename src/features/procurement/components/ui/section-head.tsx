import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Heading of a section inside a page: the serif `type-section` heading (24 px on phones,
 * 28 px from 768 px) with one muted line beside it — under it on phones.
 *
 *   <SectionHead id="wins" title="Your contract wins" note="From contract award notices, newest first." />
 *
 * Candidate for src/components/ui.
 */
export function SectionHead({
  id,
  title,
  note,
  level = "h2",
  className,
}: {
  /** Also the anchor an in-page link jumps to. */
  id?: string;
  title: ReactNode;
  note?: ReactNode;
  level?: "h2" | "h3";
  className?: string;
}) {
  const Heading = level;
  return (
    <div data-slot="section-head" className={cn("flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5", className)}>
      <Heading id={id} className="type-section scroll-mt-24 text-ink">
        {title}
      </Heading>
      {note ? <p className="text-13 text-ink-2 md:text-sm">{note}</p> : null}
    </div>
  );
}
