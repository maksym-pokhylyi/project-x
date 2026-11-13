import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthCardLine } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { TickIcon } from "@/components/ui/icons";
import { billingCopy } from "@/config/billing-copy";
import { BID_PASS_DISPLAY, planDisplay } from "@/config/plan-display";
import { isBillingInterval, isPlanKey } from "@/config/plans";
import { site } from "@/config/site";
import { features } from "@/env";
import { billingHandoff, parseBillingHandoff } from "@/lib/billing/handoff";
import { safeRedirect } from "@/lib/redirects";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Create your account", robots: { index: false } };

/**
 * Create an account, as in the SignUp-1440 / SignUp-390 artboards: the form in a white card
 * and, beside it (under it on phones), what the account gives. Coming from a paid plan on
 * /pricing (the redirect is then the hand-off to Billing), the column shows that plan
 * instead of the free one, and the account continues to the confirm step.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; next?: string; email?: string; plan?: string; interval?: string }>;
}) {
  const params = await searchParams;
  // Older links name the plan directly (?plan=pro&interval=month): the same hand-off.
  const namedPlan = isPlanKey(params.plan) && params.plan !== "free" ? params.plan : null;
  const planTarget = namedPlan ? billingHandoff({ plan: namedPlan, interval: isBillingInterval(params.interval) ? params.interval : "month" }) : undefined;
  // `next` is accepted as an alias of `redirect` (marketing links use it).
  const redirectTo = safeRedirect(params.redirect ?? params.next ?? planTarget);
  if (await getUser()) redirect(redirectTo);

  // What the visitor chose on /pricing travels in the redirect: the hand-off to Billing.
  const handoff = parseBillingHandoff(redirectTo);
  const paidPlan = handoff && "plan" in handoff ? handoff.plan : null;
  const interval = handoff && "plan" in handoff ? handoff.interval : "month";
  const plan = planDisplay(paidPlan ?? "free");
  const price = interval === "year" ? plan.annual : plan.monthly;
  const description = paidPlan
    ? `Create your account first. You confirm ${plan.name} and pay on the next step.`
    : handoff
      ? `Create your account first. You buy the ${BID_PASS_DISPLAY.name} on the next step.`
      : redirectTo.startsWith("/app/bids/new")
        ? "Create your account, then upload your tender pack. Your first cited bid check is free."
        : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[68rem] flex-col gap-x-[4.5rem] gap-y-8 px-5 pt-6 pb-9 sm:gap-y-10 sm:px-6 sm:pt-14 sm:pb-14 lg:flex-row lg:items-start">
      <div className="min-w-0 sm:max-w-[31.25rem] lg:flex-[0_1_31.25rem]">
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
