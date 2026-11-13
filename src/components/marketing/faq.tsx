import type { ReactNode } from "react";
import { Disclosure, DisclosureGroup } from "@/components/ui/disclosure";

export type FaqItem = {
  question: string;
  /** Plain-text answer: used for the FAQPage structured data and, by default, on the page. */
  answer: string;
  /** Optional richer rendering (links) of the same answer for the page. */
  render?: ReactNode;
};

/**
 * FAQ list on native disclosures: readable without JavaScript and findable with in-page
 * search. `openFirst` shows the first answer, as in the landing artboard, so the pattern
 * explains itself.
 */
export function Faq({ items, openFirst = false }: { items: readonly FaqItem[]; openFirst?: boolean }) {
  return (
    <DisclosureGroup>
      {items.map((item, index) => (
        <Disclosure key={item.question} summary={item.question} open={openFirst && index === 0 ? true : undefined}>
          {item.render ?? <p>{item.answer}</p>}
        </Disclosure>
      ))}
    </DisclosureGroup>
  );
}
