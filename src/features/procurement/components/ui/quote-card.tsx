import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Somebody else's words, quoted at length: a white card, the text in the serif
 * (`type-quote`) between curly quotation marks, and one muted line saying where it comes
 * from. The text is given as paragraphs, so the opening mark sits before the first word and
 * the closing mark after the last, however many paragraphs there are.
 *
 *   <QuoteCard paragraphs={["The Council seeks a single contractor…"]} caption="From the notice on Find a Tender." />
 *
 * Candidate for src/components/ui.
 */
export function QuoteCard({ paragraphs, caption, className }: { paragraphs: ReactNode[]; caption?: ReactNode; className?: string }) {
  if (paragraphs.length === 0) return null;
  return (
    <figure data-slot="quote-card" className={cn("flex flex-col gap-3.5 rounded-card border border-line bg-surface p-5 md:px-7 md:py-6", className)}>
      <blockquote className="type-quote flex flex-col gap-3 text-ink [overflow-wrap:anywhere]">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>
            {index === 0 ? "“" : null}
            {paragraph}
            {index === paragraphs.length - 1 ? "”" : null}
          </p>
        ))}
      </blockquote>
      {caption ? <figcaption className="text-13 text-ink-2">{caption}</figcaption> : null}
    </figure>
  );
}
