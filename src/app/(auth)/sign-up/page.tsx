import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { PLANS, isBillingInterval, isPlanKey } from "@/config/plans";
import { features } from "@/env";
import { safeRedirect } from "@/lib/redirects";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Create your account", robots: { index: false } };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; next?: string; email?: string; plan?: string; interval?: string }>;
}) {
  const params = await searchParams;
  // Coming from a paid plan on /pricing: continue to billing with that plan preselected.
  const paidPlan = isPlanKey(params.plan) && params.plan !== "free" ? params.plan : null;
  const planTarget = paidPlan ? `/app/settings/billing?plan=${paidPlan}&interval=${isBillingInterval(params.interval) ? params.interval : "month"}` : undefined;
  // `next` is accepted as an alias of `redirect` (marketing links use it).
  const redirectTo = safeRedirect(params.redirect ?? params.next ?? planTarget);
  if (await getUser()) redirect(redirectTo);

  const description = paidPlan
    ? `Create your account first. You choose ${PLANS[paidPlan].name} and pay on the next step.`
    : redirectTo.startsWith("/app/bids/new")
      ? "Create your account, then upload your tender pack. Your first cited bid check is free."
      : "Your radar and your first cited bid check are free. No card needed.";

  return (
    <AuthCard
      title="Create your account"
      description={description}
      footer={
        <>
          Already have an account? <Link href={`/sign-in?redirect=${encodeURIComponent(redirectTo)}`}>Sign in</Link>
        </>
      }
    >
      <SignUpForm
        redirectTo={redirectTo}
        defaultEmail={typeof params.email === "string" ? params.email.slice(0, 254) : undefined}
        requireEmailVerification={features.requireEmailVerification}
        googleEnabled={features.googleOAuth}
      />
      <p className="mt-4 text-13 text-ink-2">
        By creating an account you agree to our <Link href="/legal/terms">Terms</Link> and <Link href="/legal/privacy">Privacy notice</Link>.
      </p>
    </AuthCard>
  );
}
