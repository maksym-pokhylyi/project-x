import type { ReactNode } from "react";
import { site } from "@/config/site";

export type LegalSection = {
  heading: string;
  /** Paragraphs (strings) and bullet lists (string arrays), rendered in order. */
  body: Array<string | string[]>;
};

/** True while any seller detail in src/config/site.ts is still a [[PLACEHOLDER]]. */
export function hasUnfilledPlaceholders(): boolean {
  return Object.values(site.company).some((value) => value.includes("[["));
}

/**
 * Shared renderer for the legal templates in src/app/(marketing)/legal.
 * The content is a starting point written for a B2B SaaS sold through Paddle
 * (merchant of record). Have it reviewed before launch.
 */
export function LegalDocument({ title, intro, sections, children }: { title: string; intro: string; sections: LegalSection[]; children?: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {site.legal.lastUpdated}</p>

      {hasUnfilledPlaceholders() ? (
        <p role="note" className="mt-6 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <strong>Draft template.</strong> Seller details marked like <code>[[THIS]]</code> have not been filled in yet
          (see <code>src/config/site.ts</code>). This document is not legal advice.
        </p>
      ) : null}

      <p className="mt-6 text-sm leading-6 text-muted-foreground">{intro}</p>

      <div className="mt-8 space-y-8">
        {sections.map((section, index) => (
          <section key={section.heading} aria-labelledby={`section-${index}`}>
            <h2 id={`section-${index}`} className="text-lg font-semibold tracking-tight">
              {index + 1}. {section.heading}
            </h2>
            <div className="mt-2 space-y-3 text-sm leading-6 text-muted-foreground">
              {section.body.map((block, blockIndex) =>
                Array.isArray(block) ? (
                  <ul key={blockIndex} className="list-disc space-y-1 pl-5">
                    {block.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={blockIndex}>{block}</p>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
      {children}
    </article>
  );
}
