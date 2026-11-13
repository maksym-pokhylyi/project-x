import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { MarketingPricing } from "@/components/marketing/marketing-pricing";
import { FEATURE_LABELS, PLANS, PLAN_KEYS, QUOTA_METRICS, QUOTA_METRIC_KEYS, type PlanFeatures } from "@/config/plans";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Plans and pricing for ${site.name}. Start free, upgrade when you need more.`,
  alternates: { canonical: "/pricing" },
};

const formatLimit = (value: number | null) => (value === null ? "Unlimited" : value.toLocaleString("en-US"));

export default function PricingPage() {
  const featureKeys = Object.keys(FEATURE_LABELS) as Array<keyof PlanFeatures>;
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pricing</h1>
        <p className="mt-3 text-muted-foreground">Start free. Upgrade when your team needs more seats or volume.</p>
      </header>

      <div className="mt-10">
        <MarketingPricing />
      </div>

      <section aria-labelledby="compare-title" className="mt-16">
        <h2 id="compare-title" className="text-xl font-semibold tracking-tight">
          Compare plans
        </h2>
        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="p-3 font-medium">
                  Feature
                </th>
                {PLAN_KEYS.map((key) => (
                  <th key={key} scope="col" className="p-3 font-medium">
                    {PLANS[key].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <th scope="row" className="p-3 text-left font-normal">
                  Seats
                </th>
                {PLAN_KEYS.map((key) => (
                  <td key={key} className="p-3">
                    {formatLimit(PLANS[key].limits.seats)}
                  </td>
                ))}
              </tr>
              {QUOTA_METRIC_KEYS.map((metric) => (
                <tr key={metric}>
                  <th scope="row" className="p-3 text-left font-normal">
                    {QUOTA_METRICS[metric].label} {QUOTA_METRICS[metric].period === "month" ? "per month" : ""}
                  </th>
                  {PLAN_KEYS.map((key) => (
                    <td key={key} className="p-3">
                      {formatLimit(PLANS[key].limits[metric])}
                    </td>
                  ))}
                </tr>
              ))}
              {featureKeys.map((feature) => (
                <tr key={feature}>
                  <th scope="row" className="p-3 text-left font-normal">
                    {FEATURE_LABELS[feature]}
                  </th>
                  {PLAN_KEYS.map((key) => (
                    <td key={key} className="p-3">
                      {PLANS[key].features[feature] ? (
                        <Check aria-label="Included" className="size-4 text-success" />
                      ) : (
                        <Minus aria-label="Not included" className="size-4 text-muted-foreground" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
