import { Check, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { JsonLd, faqJsonLd, softwareApplicationJsonLd } from "@/components/marketing/json-ld";
import { MarketingPricing } from "@/components/marketing/marketing-pricing";
import { Eyebrow, Section, SectionHeading } from "@/components/marketing/section";
import { BID_PASS, COMPARISON, type ComparisonValue } from "@/config/plan-display";
import { PLANS, PLAN_KEYS } from "@/config/plans";
import { site } from "@/config/site";
import { appUrl } from "@/env";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${site.name} pricing: a free radar and one free cited bid check, Radar Pro at £29 a month, Bid Desk at £149 a month, or a £99 Bid Pass for one full bid. No demo call.`,
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
    answer: "Yes. You can pause a subscription for one to three months. Nothing is charged while it is paused, and your data, library and saved tenders stay where they are.",
  },
  {
    question: "What happens to my data if I cancel, or if a payment fails?",
    answer:
      "Your data stays. After a cancellation the workspace returns to the Free plan. If a payment fails you keep your paid features for 7 days while you update the card; after that the workspace is limited to Free until payment succeeds.",
  },
  {
    question: "What counts as a full bid?",
    answer:
      "One tender pack taken from upload to export: the cited check, the scored-question matrix, first drafts of every scored question, evaluator-style marking and the Word export. Redrafting and re-marking answers within that bid are included.",
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

function Cell({ value, plan, label }: { value: ComparisonValue; plan: string; label: string }) {
  if (value === true) {
    return (
      <>
        <Check aria-hidden className="mx-auto size-4 text-success" />
        <span className="sr-only">
          {label}: included in {plan}
        </span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus aria-hidden className="mx-auto size-4 text-ink-3" />
        <span className="sr-only">
          {label}: not included in {plan}
        </span>
      </>
    );
  }
  return <>{value}</>;
}

export default function PricingPage() {
  return (
    <>
      <JsonLd data={softwareApplicationJsonLd(appUrl)} />
      <JsonLd data={faqJsonLd(billingFaq)} />

      <section aria-labelledby="pricing-title" className="container-content pt-12 pb-16 lg:pt-16 lg:pb-24">
        <header className="mx-auto max-w-2xl text-center">
          <Eyebrow>Plans and prices</Eyebrow>
          <h1 id="pricing-title" className="type-h1 mt-3 text-ink">
            Pricing
          </h1>
          <p className="type-lead mt-4">
            Start free. Pay monthly if you bid most months, or by the bid if you bid a few times a year. Every price is on this page: there is no demo call.
          </p>
        </header>

        <div className="mt-10">
          <MarketingPricing />
        </div>

        <ul className="mt-12 grid gap-x-8 gap-y-6 md:grid-cols-3">
          {terms.map((term) => (
            <li key={term.title} className="border-t border-line-strong pt-4">
              <h2 className="font-sans text-base leading-6 font-semibold text-ink">{term.title}</h2>
              <p className="mt-1 text-sm text-ink-2">{term.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <Section labelledBy="compare-title" tone="sunken">
        <SectionHeading id="compare-title" title="Compare plans" lead={`What each plan includes. A ${BID_PASS.name} adds one full bid to any plan, including Free.`} />
        <div className="relative mt-8 overflow-x-auto rounded-card border border-line bg-surface" tabIndex={0} role="region" aria-labelledby="compare-title">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th scope="col" className="w-[34%] border-b border-line bg-surface px-4 py-3 text-left align-bottom text-13 font-medium text-ink-2">
                  What you get
                </th>
                {PLAN_KEYS.map((key) => (
                  <th key={key} scope="col" className="border-b border-line bg-surface px-3 py-3 text-center align-bottom">
                    <span className="block text-sm font-semibold text-ink">{PLANS[key].name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((group) => (
                <Fragment key={group.title}>
                  <tr>
                    <th scope="colgroup" colSpan={PLAN_KEYS.length + 1} className="border-b border-line bg-surface-sunken px-4 py-2 text-left">
                      <span className="type-eyebrow text-ink-2">{group.title}</span>
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label} className="hover:bg-brand-tint/40">
                      <th scope="row" className="border-b border-line px-4 py-3 text-left align-top font-normal">
                        <span className="block font-medium text-ink">{row.label}</span>
                        {row.detail ? <span className="mt-0.5 block text-13 text-ink-2">{row.detail}</span> : null}
                      </th>
                      {PLAN_KEYS.map((key) => (
                        <td key={key} className="border-b border-line px-3 py-3 text-center align-top text-ink tabular-nums">
                          <Cell value={row.values[key]} plan={PLANS[key].name} label={row.label} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr>
                <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                  <span className="block font-medium text-ink">{BID_PASS.name}</span>
                  <span className="mt-0.5 block text-13 text-ink-2">{BID_PASS.summary}</span>
                </th>
                <td colSpan={PLAN_KEYS.length} className="px-3 py-3 text-center align-top text-ink">
                  {BID_PASS.price} {BID_PASS.period}, on any plan
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-13 text-ink-2 md:hidden">Scroll the table sideways to see every plan.</p>
      </Section>

      <Section labelledBy="billing-faq-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-5">
            <SectionHeading id="billing-faq-title" title="Billing and cancellation" />
            <p className="mt-4 text-base text-ink-2">
              The full terms are in the <Link href="/legal/terms">Terms of Service</Link> and the <Link href="/legal/refunds">refund policy</Link>. Questions about an
              invoice? Write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
            </p>
          </div>
          <div className="lg:col-span-7">
            <Faq items={billingFaq} />
          </div>
        </div>
      </Section>

      <CtaBand
        id="pricing-cta-title"
        title="Start with what is free."
        lead="Find your company’s page, claim your radar and run one cited bid check on a live tender. No card needed."
        primary={{ label: "Find your company", href: "/find" }}
        secondary={{ label: "Get a free bid check", href: "/free-bid-check" }}
      />
    </>
  );
}
