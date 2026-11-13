import { BID_PASS, PLANS, PLAN_CURRENCY, PLAN_KEYS } from "@/config/plans";
import { site } from "@/config/site";
import type { FaqItem } from "./faq";

/** Serialises structured data safely for an inline <script type="application/ld+json">. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function organizationJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: site.name,
    url: origin,
    logo: `${origin}/icon.svg`,
    email: site.supportEmail,
    description: site.description,
    slogan: site.tagline,
    areaServed: { "@type": "Country", name: "United Kingdom" },
  };
}

export function softwareApplicationJsonLd(origin: string) {
  const pounds = (pence: number) => (pence / 100).toFixed(2);
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: site.name,
    url: origin,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: site.description,
    publisher: { "@id": `${origin}/#organization` },
    offers: [
      ...PLAN_KEYS.map((key) => {
        const plan = PLANS[key];
        return {
          "@type": "Offer",
          name: plan.name,
          description: plan.description,
          price: plan.prices ? pounds(plan.prices.month) : "0.00",
          priceCurrency: PLAN_CURRENCY,
          url: `${origin}/pricing`,
          ...(plan.prices
            ? { priceSpecification: { "@type": "UnitPriceSpecification", price: pounds(plan.prices.month), priceCurrency: PLAN_CURRENCY, billingDuration: "P1M" } }
            : {}),
        };
      }),
      {
        "@type": "Offer",
        name: BID_PASS.name,
        description: BID_PASS.description,
        price: pounds(BID_PASS.price),
        priceCurrency: PLAN_CURRENCY,
        url: `${origin}/pricing`,
      },
    ],
  };
}

export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
