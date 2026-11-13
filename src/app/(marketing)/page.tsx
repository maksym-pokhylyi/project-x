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
import { ButtonLink } from "@/components/ui/button-link";
import { ArrowRightIcon } from "@/components/ui/icons";
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
  const { hero, strip, how, proof, pricing, questions } = landing;

  return (
    <>
      <JsonLd data={softwareApplicationJsonLd(appUrl)} />
      <JsonLd data={faqJsonLd([...questions.items])} />

      {/* Hero ---------------------------------------------------------------------------- */}
      <section aria-labelledby="hero-title">
        <div className="container-content grid gap-y-8 pt-7 pb-10 md:gap-y-10 md:pt-14 md:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:items-start lg:gap-x-12 lg:pt-16 lg:pb-[5.5rem] xl:grid-cols-[33.75rem_minmax(0,1fr)] xl:gap-x-14">
          <div className="flex max-w-[38rem] flex-col gap-4 md:gap-6 lg:pt-3">
            <Eyebrow className="max-sm:-mb-1">{hero.eyebrow}</Eyebrow>
            <h1 id="hero-title" className="type-hero text-ink">
              {hero.titleLead} <span className="text-brand">— {hero.titleRest}</span>
            </h1>
            <p className="type-lead text-ink">
              <span className="sm:hidden">{hero.leadShort}</span>
              <span className="hidden sm:inline">{hero.lead}</span>
            </p>
            <CompanySearch id="hero-company" className="mt-1 md:mt-2">
              <p className="text-13 leading-[1.5] text-ink-2 max-sm:pt-0.5">
                <span className="sm:hidden">{hero.noteShort}</span>
                <span className="hidden sm:inline">{hero.note}</span> {hero.sampleLink.before}
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
      <section aria-label="Where the data comes from">
        <div className="container-content">
          <div className="flex flex-wrap justify-between gap-x-10 gap-y-2 border-y border-line py-4 text-sm leading-[1.3125rem] text-ink sm:py-5">
            <p className="max-w-[40rem] min-w-0 flex-[1_1_30rem]">
              <strong className="font-semibold">{strip.data.strong}</strong> {strip.data.text}
            </p>
            <p className="lg:shrink-0">
              <strong className="font-semibold">{strip.independent.strong}</strong> {strip.independent.text}{" "}
              <a href={strip.independent.link.href} className="link max-sm:hidden">
                {strip.independent.link.label}
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* How it works -------------------------------------------------------------------- */}
      <Section id="how" labelledBy="how-title" containerClassName="flex flex-col gap-7 md:gap-12">
        <SectionHeading id="how-title" eyebrow={how.eyebrow} title={how.title} className="max-w-[30rem]" />
        <ol className="grid md:gap-y-10 lg:grid-cols-3 lg:gap-x-8">
          {how.steps.map((step, index) => {
            const visual = stepVisuals[index]!;
            return (
              <li
                key={step.title}
                className="flex flex-col border-t border-line pt-[1.125rem] pb-[1.375rem] last:pb-0 md:grid md:grid-cols-2 md:items-center md:gap-x-8 md:border-t-0 md:py-0 lg:flex lg:items-stretch"
              >
                <div className="hidden md:block">{visual.card}</div>
                <div className="lg:mt-5">
                  <p className="font-mono text-13 leading-[1.5] font-normal text-ink-2">{String(index + 1).padStart(2, "0")}</p>
                  <h3 className="type-h3 mt-1.5 text-ink md:mt-2">{step.title}</h3>
                  <p className="type-reading mt-1.5 text-ink md:mt-2">{step.body}</p>
                </div>
                <div className="mt-3.5 md:hidden">{visual.chip}</div>
              </li>
            );
          })}
        </ol>
      </Section>

      {/* Proof: every requirement, quoted and cited -------------------------------------- */}
      <Section id="proof" labelledBy="proof-title" tone="deep" containerClassName="flex flex-col gap-7 md:gap-14">
        <SectionHeading
          id="proof-title"
          eyebrow={proof.eyebrow}
          title={proof.title}
          lead={
            <>
              <span className="sm:hidden">{proof.leadShort}</span>
              <span className="hidden sm:inline">{proof.lead}</span>
            </>
          }
        />
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-14">
          <DocumentExcerpt className="min-w-0 lg:flex-[1_1_27.5rem]" />
          <ProofBridge className="py-3 lg:hidden">{proof.bridge}</ProofBridge>
          <RequirementCard className="min-w-0 lg:flex-[1.25_1_31.25rem]" />
        </div>

        {/* Phones: the three claims as one ticked list. From 768 px: each under its ink rule, with its sentence. */}
        <ul className="-mt-2 rounded-card border border-line bg-surface text-15 font-semibold text-ink md:hidden">
          {proof.points.map((point) => (
            <li key={point.title} className="flex min-h-12 items-center gap-2.5 border-line px-4 not-first:border-t">
              <PlanTick className="mt-0 text-brand" />
              {point.title}
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

        <div className="-mt-2 flex flex-col gap-x-6 sm:flex-row sm:flex-wrap sm:items-center md:mt-0">
          <ButtonLink href={proof.cta.href} size="form">
            {proof.cta.label}
            <ArrowRightIcon />
          </ButtonLink>
          <Link href={proof.sampleLink.href} className="link inline-flex min-h-11 items-center self-center text-15 font-medium sm:min-h-12 sm:text-base">
            {proof.sampleLink.label}
          </Link>
        </div>
      </Section>

      {/* Pricing ------------------------------------------------------------------------- */}
      <Section id="pricing" labelledBy="pricing-title" containerClassName="flex flex-col gap-6 md:gap-10">
        <SectionHeading id="pricing-title" eyebrow={pricing.eyebrow} title={pricing.title} lead={pricing.lead} />
        <MarketingPricing
          toggle={false}
          shortBidPass
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

      {/* Questions ----------------------------------------------------------------------- */}
      <Section id="questions" labelledBy="questions-title" tone="surface" containerClassName="flex flex-wrap gap-x-20 gap-y-5 sm:gap-y-10">
        <div className="flex min-w-0 flex-[1_1_18.75rem] flex-col gap-2 sm:gap-3">
          <Eyebrow>{questions.eyebrow}</Eyebrow>
          <h2 id="questions-title" className="type-h2 text-ink">
            {questions.title}
          </h2>
          {/* The 390 px artboard leaves the contact line to the footer. */}
          <p className="type-reading text-ink-2 max-sm:hidden">
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
