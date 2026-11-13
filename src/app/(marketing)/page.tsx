import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { JsonLd, faqJsonLd, softwareApplicationJsonLd } from "@/components/marketing/json-ld";
import { Eyebrow, Point, Section, SectionHeading } from "@/components/marketing/section";
import { AnswerEditorVisual } from "@/components/marketing/visuals/answer-editor-visual";
import { KeyDatesCard, QuestionsCard, RequirementCloseup } from "@/components/marketing/visuals/check-details";
import { CheckVisual } from "@/components/marketing/visuals/check-visual";
import { DirectAwardsMini, EndingSoonMini, MatchMini } from "@/components/marketing/visuals/radar-minis";
import { SupplierPageVisual } from "@/components/marketing/visuals/supplier-page-visual";
import { Button } from "@/components/ui/button";
import { landing } from "@/config/landing";
import { BID_PASS, PLAN_DISPLAYS } from "@/config/plan-display";
import { site } from "@/config/site";
import { appUrl } from "@/env";

export const metadata: Metadata = {
  title: { absolute: `${site.name} — know which public contracts are worth your time` },
  description: site.description,
  alternates: { canonical: "/" },
};

const radarMinis = [MatchMini, EndingSoonMini, DirectAwardsMini] as const;

export default function LandingPage() {
  const { hero, facts, check, radar, drafts, howItWorks, straightAnswers, pricingTeaser, faq, finalCta } = landing;

  return (
    <>
      <JsonLd data={softwareApplicationJsonLd(appUrl)} />
      <JsonLd data={faqJsonLd([...faq.items])} />

      {/* Hero ---------------------------------------------------------------------------- */}
      <section aria-labelledby="hero-title" className="overflow-hidden">
        <div className="container-content grid gap-12 pt-12 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:items-center lg:gap-14 lg:pt-20 lg:pb-24">
          <div className="max-w-xl">
            <Eyebrow>{hero.eyebrow}</Eyebrow>
            <h1 id="hero-title" className="type-hero mt-4 text-ink">
              {hero.title}
            </h1>
            <p className="type-lead mt-6">{hero.subtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={hero.primaryCta.href}>
                  {hero.primaryCta.label} <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={hero.secondaryCta.href}>{hero.secondaryCta.label}</Link>
              </Button>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
              <span>{hero.note}</span>
              <Link href={hero.sampleLink.href} className="link inline-flex min-h-6 items-center gap-1 font-medium">
                {hero.sampleLink.label} <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </p>
          </div>
          <CheckVisual compact elevated />
        </div>
      </section>

      {/* Fact strip ---------------------------------------------------------------------- */}
      <section aria-label="About the data" className="border-y border-line bg-surface-sunken">
        <dl className="container-content grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {facts.map((fact, index) => (
            <div key={fact.title} className={index === 0 ? "py-6 md:pr-8" : index === facts.length - 1 ? "py-6 md:pl-8" : "py-6 md:px-8"}>
              <dt className="text-sm leading-5 font-semibold text-ink">{fact.title}</dt>
              <dd className="mt-1 text-sm text-ink-2">{fact.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* The cited bid check ------------------------------------------------------------- */}
      <Section id="bid-check" labelledBy="check-title">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-5">
            <SectionHeading id="check-title" eyebrow={check.eyebrow} title={check.title} lead={check.lead} />
            <p className="mt-2 text-13 text-ink-2">{check.leadSource}</p>
            <ol className="mt-8 space-y-6 border-t border-line pt-8">
              {check.points.map((point, index) => (
                <li key={point.title} className="grid grid-cols-[2rem_1fr] gap-x-2">
                  <span aria-hidden className="font-display text-xl leading-6 font-medium text-brand tabular-nums">
                    {index + 1}
                  </span>
                  <Point title={point.title}>{point.body}</Point>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild>
                <Link href={check.primaryCta.href}>{check.primaryCta.label}</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={check.sampleLink.href}>
                  {check.sampleLink.label} <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
          <div className="lg:col-span-7">
            <p className="type-eyebrow text-ink-2">{check.detailsTitle}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <RequirementCloseup className="sm:col-span-2" />
              <KeyDatesCard />
              <QuestionsCard />
            </div>
            <p className="mt-4 text-13 text-ink-2">{check.disclaimer}</p>
          </div>
        </div>
      </Section>

      {/* Radar --------------------------------------------------------------------------- */}
      <Section id="radar" labelledBy="radar-title" tone="sunken">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-x-12">
          <div className="lg:col-span-5">
            <SectionHeading id="radar-title" eyebrow={radar.eyebrow} title={radar.title} lead={radar.lead} />
            <div className="mt-8">
              <Button asChild size="lg">
                <Link href={radar.primaryCta.href}>
                  {radar.primaryCta.label} <ArrowRight aria-hidden />
                </Link>
              </Button>
              <p className="mt-3 max-w-sm text-sm text-ink-2">{radar.note}</p>
            </div>
          </div>
          <SupplierPageVisual className="lg:col-span-7" />
        </div>

        {/* Two rows shared by all three columns (subgrid), so the visuals end and the headings start on one line. */}
        <ul className="mt-16 grid gap-x-8 gap-y-5 md:grid-cols-3 md:grid-rows-[auto_auto]">
          {radar.columns.map((column, index) => {
            const Mini = radarMinis[index]!;
            return (
              <li key={column.title} className="grid gap-y-5 max-md:not-first:mt-7 md:row-span-2 md:grid-rows-subgrid">
                <Mini className="h-full" />
                <div>
                  <h3 className="type-h3 text-ink">{column.title}</h3>
                  <p className="mt-2 text-base text-ink-2">{column.body}</p>
                  {"source" in column ? <p className="mt-2 text-13 text-ink-2">{column.source}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Drafts -------------------------------------------------------------------------- */}
      <Section id="drafts" labelledBy="drafts-title">
        <SectionHeading id="drafts-title" eyebrow={drafts.eyebrow} title={drafts.title} lead={drafts.lead} />
        <AnswerEditorVisual className="mt-10" />
        <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {drafts.points.map((point) => (
            <li key={point.title} className="border-t border-line-strong pt-4">
              <Point title={point.title}>{point.body}</Point>
            </li>
          ))}
        </ul>
      </Section>

      {/* How it works -------------------------------------------------------------------- */}
      <Section id="how-it-works" labelledBy="how-title" tone="sunken">
        <SectionHeading id="how-title" title={howItWorks.title} lead={howItWorks.lead} />
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title} className="flex flex-col rounded-card border border-line bg-surface p-6">
              <span aria-hidden className="font-display text-3xl leading-10 font-semibold text-brand tabular-nums">
                {index + 1}
              </span>
              <h3 className="type-h3 mt-3 text-ink">{step.title}</h3>
              <p className="mt-2 flex-1 text-base text-ink-2">{step.body}</p>
              <Link href={step.cta.href} className="link mt-5 inline-flex min-h-10 items-center gap-1 self-start text-sm font-medium">
                {step.cta.label} <ArrowRight aria-hidden className="size-4" />
              </Link>
            </li>
          ))}
        </ol>
      </Section>

      {/* Straight answers ---------------------------------------------------------------- */}
      <Section id="straight-answers" labelledBy="answers-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-12">
          <SectionHeading id="answers-title" title={straightAnswers.title} lead={straightAnswers.lead} className="lg:col-span-5" />
          <dl className="grid gap-x-8 sm:grid-cols-2 lg:col-span-7">
            {straightAnswers.items.map((item) => (
              <div key={item.question} className="border-t border-line-strong py-5">
                <dt className="text-base leading-6 font-semibold text-ink">{item.question}</dt>
                <dd className="mt-1 text-base text-ink-2">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {/* Pricing teaser ------------------------------------------------------------------ */}
      <Section id="pricing" labelledBy="pricing-title" tone="sunken">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-5">
            <SectionHeading id="pricing-title" title={pricingTeaser.title} lead={pricingTeaser.lead} />
            <Button asChild variant="outline" className="mt-8">
              <Link href={pricingTeaser.cta.href}>
                {pricingTeaser.cta.label} <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface lg:col-span-7">
            {PLAN_DISPLAYS.map((plan) => (
              <li key={plan.key} className="flex items-baseline justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-base leading-6 font-semibold text-ink">{plan.name}</p>
                  <p className="text-sm text-ink-2">{plan.summary}</p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="font-display text-xl leading-7 font-semibold text-ink tabular-nums">{plan.monthly.amount}</span>
                  {plan.monthly.period ? <span className="block text-13 text-ink-2">{plan.monthly.period}</span> : <span className="block text-13 text-ink-2">no card</span>}
                </p>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-4 bg-brand-tint/60 px-5 py-4">
              <div className="min-w-0">
                <p className="text-base leading-6 font-semibold text-ink">{BID_PASS.name}</p>
                <p className="text-sm text-ink-2">{BID_PASS.summary}</p>
              </div>
              <p className="shrink-0 text-right">
                <span className="font-display text-xl leading-7 font-semibold text-ink tabular-nums">{BID_PASS.price}</span>
                <span className="block text-13 text-ink-2">{BID_PASS.period}</span>
              </p>
            </li>
          </ul>
        </div>
      </Section>

      {/* FAQ ----------------------------------------------------------------------------- */}
      <Section id="faq" labelledBy="faq-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-5">
            <SectionHeading id="faq-title" title={faq.title} />
            <p className="mt-4 text-base text-ink-2">
              Something else? Write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
            </p>
          </div>
          <div className="lg:col-span-7">
            <Faq items={[...faq.items]} />
          </div>
        </div>
      </Section>

      <CtaBand
        id="final-cta-title"
        title={finalCta.title}
        lead={finalCta.lead}
        primary={finalCta.primaryCta}
        secondary={finalCta.secondaryCta}
        footnote={hero.note}
      />
    </>
  );
}
