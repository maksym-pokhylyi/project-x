import type { Metadata } from "next";
import Link from "next/link";
import { PlanTick } from "@/components/billing/pricing-table";
import { CompanySearch } from "@/components/marketing/company-search";
import { CtaBand, IndependenceBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { JsonLd, faqJsonLd, softwareApplicationJsonLd } from "@/components/marketing/json-ld";
import { MarketingPricing } from "@/components/marketing/marketing-pricing";
import { Eyebrow, Point, Section, SectionHeading } from "@/components/marketing/section";
import { DocumentExcerpt, ProofBridge, RequirementCard } from "@/components/marketing/visuals/proof-visuals";
import { stepVisuals } from "@/components/marketing/visuals/step-visuals";
import { SupplierPreview } from "@/components/marketing/visuals/supplier-preview";
import { landing } from "@/config/landing";
import { site } from "@/config/site";
import { appUrl } from "@/env";

export const metadata: Metadata = {
  title: { absolute: `${site.name}: know which public contracts are worth your time` },
  description: site.description,
  alternates: { canonical: "/" },
};

/** The landing page, built to docs/design/handoff/Landing-1440 and Landing-390. Copy: src/config/landing.ts. */
export default function LandingPage() {
  const { hero, strip, how, proof, pricing, straightAnswers, questions } = landing;

  return (
    <>
      <JsonLd data={softwareApplicationJsonLd(appUrl)} />
      <JsonLd data={faqJsonLd([...questions.items])} />

      {/* Hero ---------------------------------------------------------------------------- */}
      <section aria-labelledby="hero-title">
        <div className="container-content grid gap-y-9 pt-7 pb-10 md:gap-y-10 md:pt-14 md:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:items-center lg:gap-x-12 lg:pt-16 lg:pb-[5.5rem] xl:grid-cols-[33.75rem_minmax(0,1fr)] xl:gap-x-14">
          <div className="flex max-w-[38rem] flex-col gap-5 md:gap-6">
            <Eyebrow>{hero.eyebrow}</Eyebrow>
            <h1 id="hero-title" className="type-hero text-ink">
              {hero.titleLead} <span className="text-brand">— {hero.titleRest}</span>
            </h1>
            <p className="type-lead text-ink">
              <span className="sm:hidden">{hero.leadShort}</span>
              <span className="hidden sm:inline">{hero.lead}</span>
            </p>
            <CompanySearch id="hero-company" className="mt-1 md:mt-2">
              <p className="text-13 text-ink-2">
                {hero.note} {hero.sampleLink.before}
                <Link href={hero.sampleLink.href} className="link">
                  {hero.sampleLink.label}
                </Link>
                .
              </p>
            </CompanySearch>
          </div>
          <SupplierPreview className="w-full max-w-[38rem] lg:max-w-none" />
        </div>
      </section>

      {/* Open data and independence ------------------------------------------------------ */}
      <section aria-label="About the data">
        <div className="container-content">
          <div className="flex flex-wrap justify-between gap-x-12 gap-y-2 border-y border-line py-5 text-sm leading-[1.3125rem] text-ink">
            <p className="max-w-[40rem] min-w-0 flex-[1_1_24rem]">
              <strong className="font-semibold">{strip.data.strong}</strong> {strip.data.text}
            </p>
            <p className="lg:shrink-0">
              <strong className="font-semibold">{strip.independent.strong}</strong> {strip.independent.text}{" "}
              <a href={strip.independent.link.href} className="link">
                {strip.independent.link.label}
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* How it works -------------------------------------------------------------------- */}
      <Section id="how" labelledBy="how-title" containerClassName="flex flex-col gap-8 md:gap-12">
        <SectionHeading id="how-title" eyebrow={how.eyebrow} title={how.title} className="max-w-[30rem]" />
        <ol className="grid gap-y-8 md:gap-y-10 lg:grid-cols-3 lg:gap-x-8">
          {how.steps.map((step, index) => {
            const visual = stepVisuals[index]!;
            return (
              <li
                key={step.title}
                className="flex flex-col border-t border-line pt-6 md:grid md:grid-cols-2 md:items-center md:gap-x-8 md:border-t-0 md:pt-0 lg:flex lg:items-stretch"
              >
                <div className="hidden md:block">{visual.card}</div>
                <div className="lg:mt-5">
                  <p className="font-mono text-13 text-ink-2">{String(index + 1).padStart(2, "0")}</p>
                  <h3 className="type-h3 mt-2 text-ink">{step.title}</h3>
                  <p className="type-reading mt-2 text-ink">{step.body}</p>
                </div>
                <div className="mt-4 md:hidden">{visual.chip}</div>
              </li>
            );
          })}
        </ol>
      </Section>

      {/* Proof: every requirement, quoted and cited -------------------------------------- */}
      <Section id="proof" labelledBy="proof-title" tone="deep" containerClassName="flex flex-col gap-9 md:gap-14">
        <SectionHeading id="proof-title" eyebrow={proof.eyebrow} title={proof.title} lead={proof.lead} />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-10">
          <DocumentExcerpt className="min-w-0 lg:flex-[1_1_27.5rem]" />
          <ProofBridge className="lg:hidden">{proof.bridge}</ProofBridge>
          <RequirementCard className="min-w-0 lg:flex-[1.25_1_31.25rem]" />
        </div>

        <ul className="divide-y divide-line border-y border-line md:hidden">
          {proof.points.map((point) => (
            <li key={point.title} className="flex gap-2.5 py-3.5">
              <PlanTick className="mt-1 text-brand" />
              <div>
                <h3 className="font-sans text-15 font-semibold text-ink">{point.title}</h3>
                <p className="mt-0.5 text-sm leading-[1.3125rem] text-ink">{point.short}</p>
              </div>
            </li>
          ))}
        </ul>
        <ul className="hidden gap-x-8 gap-y-7 md:grid md:grid-cols-3">
          {proof.points.map((point) => (
            <li key={point.title}>
              <Point title={point.title}>{point.body}</Point>
            </li>
          ))}
        </ul>

        <p className="text-15 text-ink">
          <Link href={proof.sampleLink.href} className="link font-medium">
            {proof.sampleLink.label}
          </Link>
          <span className="text-ink-2"> · {proof.note}</span>
        </p>
      </Section>

      {/* Pricing ------------------------------------------------------------------------- */}
      <Section id="pricing" labelledBy="pricing-title" containerClassName="flex flex-col gap-8 md:gap-10">
        <SectionHeading id="pricing-title" eyebrow={pricing.eyebrow} title={pricing.title} lead={pricing.lead} />
        <MarketingPricing
          toggle={false}
          smallPrint={
            <>
              {pricing.smallPrint}{" "}
              <Link href={pricing.compare.href} className="link">
                {pricing.compare.label}
              </Link>
            </>
          }
        />
      </Section>

      {/* Straight answers ---------------------------------------------------------------- */}
      <Section id="straight-answers" labelledBy="answers-title" tone="deep" containerClassName="flex flex-wrap gap-x-20 gap-y-9">
        <div className="flex min-w-0 flex-[1_1_18.75rem] flex-col gap-3">
          <Eyebrow>{straightAnswers.eyebrow}</Eyebrow>
          <h2 id="answers-title" className="type-h2 text-ink">
            {straightAnswers.title}
          </h2>
          <p className="type-reading mt-1 text-ink">{straightAnswers.lead}</p>
        </div>
        <dl className="grid min-w-0 flex-[2_1_35rem] gap-x-8 gap-y-7 sm:grid-cols-2">
          {straightAnswers.items.map((item) => (
            <div key={item.question} className="flex flex-col gap-1.5 border-t-2 border-ink pt-[1.125rem]">
              <dt className="text-17 font-semibold text-ink">{item.question}</dt>
              <dd className="text-15 leading-[1.45rem] text-ink">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Questions ----------------------------------------------------------------------- */}
      <Section
        id="questions"
        labelledBy="questions-title"
        tone="surface"
        containerClassName="flex flex-wrap gap-x-20 gap-y-8"
        className="border-t-0"
      >
        <div className="flex min-w-0 flex-[1_1_18.75rem] flex-col gap-3">
          <Eyebrow>{questions.eyebrow}</Eyebrow>
          <h2 id="questions-title" className="type-h2 text-ink">
            {questions.title}
          </h2>
          <p className="type-reading mt-1 text-ink-2">
            {questions.contact.before}
            <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>
            {questions.contact.after}
          </p>
        </div>
        <div className="min-w-0 flex-[2_1_35rem]">
          <Faq items={questions.items} openFirst />
        </div>
      </Section>

      <CtaBand id="final-cta-title" />
      <IndependenceBand />
    </>
  );
}
