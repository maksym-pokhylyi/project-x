import type { ReactNode } from "react";
import { Disclosure, DisclosureGroup } from "@/components/ui/disclosure";

export type FaqItem = {
  question: string;
  /** Plain-text answer: used for the FAQPage structured data and, by default, on the page. */
  answer: string;
  /** Optional richer rendering (links) of the same answer for the page. */
  render?: ReactNode;
};

/** FAQ list on native disclosures: readable without JavaScript and findable with in-page search. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <DisclosureGroup>
      {items.map((item) => (
        <Disclosure key={item.question} summary={item.question}>
          {item.render ?? <p>{item.answer}</p>}
        </Disclosure>
      ))}
    </DisclosureGroup>
  );
}
