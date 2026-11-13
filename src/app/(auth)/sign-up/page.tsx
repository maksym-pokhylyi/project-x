import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthCardLine } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { TickIcon } from "@/components/ui/icons";
import { billingCopy } from "@/config/billing-copy";
import { planDisplay } from "@/config/plan-display";
import { isBillingInterval, isPlanKey } from "@/config/plans";
import { site } from "@/config/site";
import { features } from "@/env";
import { safeRedirect } from "@/lib/redirects";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Create your account", robots: { index: false } };

/**
 * Create an account, as in the SignUp-1440 / SignUp-390 artboards: the form in a white card
 * and, beside it (under it on phones), what the account gives. Coming from a paid plan on
 * /pricing, the column shows that plan instead of the free one.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; next?: string; email?: string; plan?: string; interval?: string }>;
}) {
  const params = await searchParams;
  // Coming from a paid plan on /pricing: continue to billing with that plan preselected.
  const paidPlan = isPlanKey(params.plan) && params.plan !== "free" ? params.plan : null;
  const interval = isBillingInterval(params.interval) ? params.interval : "month";
  const planTarget = paidPlan ? `/app/settings/billing?plan=${paidPlan}&interval=${interval}` : undefined;
  // `next` is accepted as an alias of `redirect` (marketing links use it).
  const redirectTo = safeRedirect(params.redirect ?? params.next ?? planTarget);
  if (await getUser()) redirect(redirectTo);

  const plan = planDisplay(paidPlan ?? "free");
  const price = interval === "year" ? plan.annual : plan.monthly;
  const description = paidPlan
    ? `Create your account first. You choose ${plan.name} and pay on the next step.`
    : redirectTo.startsWith("/app/bids/new")
      ? "Create your account, then upload your tender pack. Your first cited bid check is free."
      : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[68rem] flex-col gap-x-[4.5rem] gap-y-8 px-5 pt-6 pb-9 sm:px-6 sm:pt-14 sm:pb-14 lg:flex-row lg:items-start">
      <div className="min-w-0 lg:flex-[0_1_31.25rem]">
        <AuthCard
          title="Create your account"
          description={description}
          className="pb-5 sm:pb-7"
          footer={
            <>
              By creating an account you agree to the <Link href="/legal/terms">Terms</Link> and the <Link href="/legal/privacy">Privacy notice</Link>.
            </>
          }
        >
          <SignUpForm
            redirectTo={redirectTo}
            defaultEmail={typeof params.email === "string" ? params.email.slice(0, 254) : undefined}
            requireEmailVerification={features.requireEmailVerification}
            googleEnabled={features.googleOAuth}
          />
          <AuthCardLine className="mt-1 sm:mt-1.5">
            <span>Already have an account?</span>
            <Link href={`/sign-in?redirect=${encodeURIComponent(redirectTo)}`} className="link inline-flex min-h-11 items-center rounded-sm font-semibold">
              Sign in
            </Link>
          </AuthCardLine>
        </AuthCard>
      </div>

      <section aria-labelledby="signup-plan" className="flex min-w-0 flex-col gap-[1.125rem] sm:gap-5 lg:flex-[1_1_23.75rem] lg:pt-[2.6875rem]">
        <h2 id="signup-plan" className="font-display text-2xl leading-[1.2] font-semibold tracking-[-0.01em] text-ink sm:text-3xl sm:leading-[1.2]">
          {paidPlan ? `${plan.name}: ${price.line}` : "Free, and no card needed"}
        </h2>
        <ul className="flex flex-col gap-3 text-base leading-[1.5] text-ink">
          {plan.leadIn ? <li className="font-semibold">{plan.leadIn}</li> : null}
          {plan.features.map((feature) => (
            <li key={feature.text} className="flex gap-2.5">
              <TickIcon className="mt-1 text-brand" />
              <span>
                {feature.lead ? <span className="font-semibold">{feature.lead} </span> : null}
                {feature.text}
              </span>
            </li>
          ))}
        </ul>
        <p className="max-w-[26.25rem] border-t border-line pt-[1.125rem] text-sm leading-[1.55] text-ink-2 sm:pt-5">
          {paidPlan ? `${billingCopy.vat} ` : null}
          Your documents are stored in {site.facts.hostingRegionShort}, encrypted, and never used to train AI models.
        </p>
      </section>
    </div>
  );
}
