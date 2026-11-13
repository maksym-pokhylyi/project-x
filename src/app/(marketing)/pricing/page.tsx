import type { Metadata } from "next";
import { BillingIntervalProvider } from "@/components/billing/billing-interval";
import { Faq } from "@/components/marketing/faq";
import { JsonLd, faqJsonLd, softwareApplicationJsonLd } from "@/components/marketing/json-ld";
import { MarketingPricing } from "@/components/marketing/marketing-pricing";
import { PlanComparison } from "@/components/marketing/plan-comparison";
import { Eyebrow, Section } from "@/components/marketing/section";
import { billingQuestions } from "@/config/billing-copy";
import { landing } from "@/config/landing";
import { BID_PASS_DISPLAY, planPrice } from "@/config/plan-display";
import { PLANS } from "@/config/plans";
import { site } from "@/config/site";
import { appUrl } from "@/env";

const { pricing } = landing;

export const metadata: Metadata = {
  title: "Pricing",
  description: `${site.name} pricing: your supplier page, your radar and your first cited bid check are free. ${PLANS.starter.name} is ${planPrice("starter", "month").line}, ${PLANS.pro.name} ${planPrice("pro", "month").line}, or buy a ${BID_PASS_DISPLAY.price} ${BID_PASS_DISPLAY.name} for one full bid.`,
  alternates: { canonical: "/pricing" },
};

/** /pricing, built to docs/design/handoff/Pricing-1440 and Pricing-390. Every figure comes from src/config/plans.ts. */
export default function PricingPage() {
  return (
    <BillingIntervalProvider>
      <JsonLd data={softwareApplicationJsonLd(appUrl)} />
      <JsonLd data={faqJsonLd(billingQuestions)} />

      <section aria-labelledby="pricing-title">
        <div className="container-content flex flex-col gap-6 pt-7 pb-11 sm:gap-10 sm:pt-12 sm:pb-16 lg:pt-16 lg:pb-[5.5rem]">
          <header className="flex max-w-[47.5rem] flex-col gap-3">
            <Eyebrow>{pricing.eyebrow}</Eyebrow>
            <h1 id="pricing-title" className="type-h1 text-ink">
              {pricing.title}
            </h1>
            <p className="type-lead text-ink max-sm:mt-0.5">{pricing.lead}</p>
          </header>
          <div id="plans" className="scroll-mt-24">
            <MarketingPricing headingLevel={2} />
          </div>
        </div>
      </section>

      <Section id="compare" labelledBy="compare-title" tone="deep" className="py-11 md:py-20 lg:py-20" containerClassName="flex flex-col gap-4 md:gap-6">
        <h2 id="compare-title" className="type-section text-ink">
          Compare the plans
        </h2>
        <PlanComparison labelledBy="compare-title" />
        <p className="text-15 leading-[1.5] text-ink">
          A{" "}
          <a href="#bid-pass" className="link">
            {BID_PASS_DISPLAY.name}
          </a>{" "}
          adds one full bid to any plan, with everything in the Bids rows, for {BID_PASS_DISPLAY.price}.
        </p>
      </Section>

      <Section id="questions" labelledBy="questions-title" tone="surface" className="py-11 md:py-20 lg:py-20" containerClassName="flex flex-wrap gap-x-20 gap-y-5 sm:gap-y-10">
        <div className="flex min-w-0 flex-[1_1_18.75rem] flex-col gap-2 sm:gap-3">
          <h2 id="questions-title" className="type-section text-ink">
            Billing questions
          </h2>
          <p className="text-sm leading-[1.6] text-ink-2 sm:text-base sm:leading-[1.6]">
            Something else? Write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
          </p>
        </div>
        <div className="min-w-0 flex-[2_1_35rem]">
          <Faq items={billingQuestions} openFirst />
        </div>
      </Section>
    </BillingIntervalProvider>
  );
}
