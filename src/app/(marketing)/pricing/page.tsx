import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { JsonLd, faqJsonLd, softwareApplicationJsonLd } from "@/components/marketing/json-ld";
import { MarketingPricing } from "@/components/marketing/marketing-pricing";
import { PlanComparison } from "@/components/marketing/plan-comparison";
import { Eyebrow, Point, Section, SectionHeading } from "@/components/marketing/section";
import { landing } from "@/config/landing";
import { BID_PASS } from "@/config/plan-display";
import { site } from "@/config/site";
import { appUrl } from "@/env";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${site.name} pricing: your supplier page and one cited bid check are free, Radar Pro is £29 a month, Bid Desk £149 a month, or a £99 Bid Pass for one full bid. No demo call.`,
  alternates: { canonical: "/pricing" },
};

const { facts, legal } = site;

const terms = [
  {
    title: `${facts.trialDays}-day trial on Bid Desk`,
    body: `A card is required to start. Nothing is charged until day ${facts.trialDays + 1}. Cancel before then and you pay nothing.`,
  },
  {
    title: "VAT handled at checkout",
    body: "Prices exclude VAT. Paddle, our merchant of record, adds VAT where it applies and sends you a VAT invoice.",
  },
  {
    title: "No renewal surprises",
    body: "We email you 7 days before an annual plan renews. Pause or cancel in two clicks from Settings.",
  },
];

const billingFaq: FaqItem[] = [
  {
    question: "How do I cancel?",
    answer:
      "In Settings, open Billing and choose Manage billing, then cancel. It takes two clicks and there is no call to make. You keep your plan until the end of the period you have paid for, then the workspace returns to Free.",
  },
  {
    question: "Can I pause instead of cancelling?",
    answer: "Yes. You can pause a subscription for one to three months. Nothing is charged while it is paused, and your documents and saved tenders stay where they are.",
  },
  {
    question: "What happens to my data if I cancel, or if a payment fails?",
    answer:
      "Your data stays. After a cancellation the workspace returns to the Free plan. If a payment fails you keep your paid features for 7 days while you update the card; after that the workspace is limited to Free until payment succeeds.",
  },
  {
    question: "What counts as a full bid?",
    answer:
      "One tender pack taken from upload to export: the cited bid check, the scored questions, first drafts of every scored question, evaluator-style marking and the export to Word. Redrafting and re-marking answers within that bid are included.",
  },
  {
    question: "Do unused bids roll over?",
    answer: "Yes. On Bid Desk and Bid Desk Plus, bids you do not use roll over for one month.",
  },
  {
    question: "When does a Bid Pass make more sense than a subscription?",
    answer: `If you bid a few times a year. A ${BID_PASS.name} is ${BID_PASS.price} for one full bid and nothing renews. If you bid most months, Bid Desk costs less per bid.`,
  },
  {
    question: "Can I change plan later?",
    answer: "Yes, at any time, from Settings. When you move between paid plans, Paddle charges or credits the difference for the current period pro rata.",
  },
  {
    question: "Can I get a refund?",
    answer: `Yes. If you ask within ${legal.refundWindowDays} days of your first payment for a subscription, we refund it in full. A ${BID_PASS.name} is refunded within ${legal.refundWindowDays} days if it has not been used. The details are in the refund policy.`,
  },
  {
    question: "Who will appear on my invoice?",
    answer:
      "Paddle. Paddle.com is the merchant of record for every order: it takes the payment, issues the invoice and handles VAT. Your card statement will show Paddle with a reference to Bidfolio.",
  },
];

export default function PricingPage() {
  const { pricing } = landing;
  return (
    <>
      <JsonLd data={softwareApplicationJsonLd(appUrl)} />
      <JsonLd data={faqJsonLd(billingFaq)} />

      <section aria-labelledby="pricing-title" className="container-content flex flex-col gap-8 pt-10 pb-14 md:gap-10 md:pt-16 md:pb-24">
        <header className="flex max-w-[45rem] flex-col gap-3">
          <Eyebrow>{pricing.title}</Eyebrow>
          <h1 id="pricing-title" className="type-h1 text-ink">
            Pricing
          </h1>
          <p className="type-lead mt-1 max-w-[42.5rem] text-ink">
            {pricing.lead} If you bid a few times a year, pay by the bid instead. Every price is on this page: there is no demo call.
          </p>
        </header>

        <MarketingPricing />

        <ul className="mt-4 grid gap-x-8 gap-y-7 md:grid-cols-3">
          {terms.map((term) => (
            <li key={term.title}>
              <Point title={term.title}>{term.body}</Point>
            </li>
          ))}
        </ul>
      </section>

      <Section labelledBy="compare-title" tone="deep" containerClassName="flex flex-col gap-8 md:gap-10">
        <SectionHeading
          id="compare-title"
          eyebrow="Plan by plan"
          title="Compare the plans"
          lead={`What each plan includes. A ${BID_PASS.name} adds one full bid to any plan, including Free.`}
        />
        <PlanComparison labelledBy="compare-title" />
      </Section>

      <Section labelledBy="billing-faq-title" tone="surface" className="border-t-0" containerClassName="flex flex-wrap gap-x-20 gap-y-8">
        <div className="flex min-w-0 flex-[1_1_18.75rem] flex-col gap-3">
          <Eyebrow>Questions</Eyebrow>
          <h2 id="billing-faq-title" className="type-h2 text-ink">
            Billing and cancellation
          </h2>
          <p className="type-reading mt-1 text-ink-2">
            The full terms are in the <Link href="/legal/terms">Terms of Service</Link> and the <Link href="/legal/refunds">refund policy</Link>. Questions about an
            invoice? Write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
          </p>
        </div>
        <div className="min-w-0 flex-[2_1_35rem]">
          <Faq items={billingFaq} />
        </div>
      </Section>

      <CtaBand id="pricing-cta-title" title="Start with what is free: your company’s page." note="No account needed to look. Your first cited bid check is free too." />
    </>
  );
}
