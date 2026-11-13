import Link from "next/link";
import { landingIcons } from "@/components/marketing/icons";
import { Button } from "@/components/ui/button";
import { landing } from "@/config/landing";
import { PLANS, PLAN_KEYS, formatPrice } from "@/config/plans";

/** Placeholder landing page. All copy lives in src/config/landing.ts. */
export default function LandingPage() {
  const { hero, problem, howItWorks, features, pricingTeaser, faq, finalCta } = landing;
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 text-center sm:pt-20">
        <p className="text-sm font-medium text-muted-foreground">{hero.eyebrow}</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{hero.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">{hero.subtitle}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={hero.primaryCta.href}>{hero.primaryCta.label}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href={hero.secondaryCta.href}>{hero.secondaryCta.label}</Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{hero.note}</p>
      </section>

      <section aria-labelledby="problem-title" className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 id="problem-title" className="text-center text-2xl font-semibold tracking-tight">
            {problem.title}
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {problem.points.map((point) => (
              <li key={point.title} className="rounded-xl border bg-card p-5">
                <h3 className="font-semibold">{point.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{point.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 py-14">
        <h2 id="how-title" className="text-center text-2xl font-semibold tracking-tight">
          {howItWorks.title}
        </h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="features-title" className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 id="features-title" className="text-center text-2xl font-semibold tracking-tight">
            {features.title}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground">{features.subtitle}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.items.map((item) => {
              const Icon = landingIcons[item.icon];
              return (
                <li key={item.title} className="rounded-xl border bg-card p-5">
                  <Icon aria-hidden className="size-5 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="pricing-title" className="mx-auto max-w-6xl px-4 py-14 text-center">
        <h2 id="pricing-title" className="text-2xl font-semibold tracking-tight">
          {pricingTeaser.title}
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{pricingTeaser.subtitle}</p>
        <ul className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {PLAN_KEYS.map((key) => {
            const plan = PLANS[key];
            return (
              <li key={key} className="rounded-xl border bg-card p-4">
                <p className="text-sm font-medium">{plan.name}</p>
                <p className="mt-1 text-xl font-semibold">{plan.prices ? formatPrice(plan.prices.month) : "$0"}</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </li>
            );
          })}
        </ul>
        <Button asChild variant="outline" className="mt-6">
          <Link href={pricingTeaser.cta.href}>{pricingTeaser.cta.label}</Link>
        </Button>
      </section>

      <section aria-labelledby="faq-title" className="border-t bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 id="faq-title" className="text-center text-2xl font-semibold tracking-tight">
            {faq.title}
          </h2>
          <div className="mt-8 divide-y rounded-xl border bg-card">
            {faq.items.map((item) => (
              <details key={item.question} className="group p-4">
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.question}
                    <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="cta-title" className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 id="cta-title" className="text-2xl font-semibold tracking-tight">
          {finalCta.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{finalCta.subtitle}</p>
        <Button asChild size="lg" className="mt-6">
          <Link href={finalCta.cta.href}>{finalCta.cta.label}</Link>
        </Button>
      </section>
    </>
  );
}
