import type { ReactNode } from "react";
import { landing } from "@/config/landing";
import { CompanySearch } from "./company-search";

/**
 * Closing call to action of a public page, as in the landing artboard: one serif sentence on
 * the left, the company search on the right. On paper, set off by space alone.
 */
export function CtaBand({ id, title = landing.finalCta.title, note, bordered = false }: { id: string; title?: string; note?: ReactNode; bordered?: boolean }) {
  return (
    <section aria-labelledby={id} className={bordered ? "border-t border-line" : undefined}>
      <div className="container-content flex flex-wrap items-center justify-between gap-x-14 gap-y-5 py-11 md:gap-y-7 md:py-20">
        <h2 id={id} className="min-w-0 flex-[1_1_26.25rem] font-display text-3xl leading-[1.15] font-semibold tracking-[-0.015em] text-ink md:text-4xl md:leading-[1.15]">
          {title}
        </h2>
        <CompanySearch id={`${id}-company`} className="min-w-0 flex-[1_1_27.5rem]">
          {note ? <p className="text-13 text-ink-2">{note}</p> : null}
        </CompanySearch>
      </div>
    </section>
  );
}

/**
 * "Bidfolio is independent." — the ink band above the footer. It is the target of every
 * "How we relate to GOV.UK" link (id="independence").
 */
export function IndependenceBand() {
  const { independence } = landing;
  return (
    <section id="independence" aria-labelledby="independence-title" className="on-ink bg-ink text-paper">
      <div className="container-content flex flex-wrap gap-x-20 gap-y-3 py-10 md:gap-y-5 md:py-14">
        <h2 id="independence-title" className="min-w-0 flex-[1_1_18.75rem] font-display text-26 leading-[1.2] font-semibold tracking-[-0.01em] md:text-30">
          {independence.title}
        </h2>
        <div className="flex min-w-0 flex-[2_1_35rem] flex-col gap-3 text-15 leading-[1.6] md:text-base md:leading-[1.6]">
          {independence.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
