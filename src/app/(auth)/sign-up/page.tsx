import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { isBillingInterval, isPlanKey } from "@/config/plans";
import { site } from "@/config/site";
import { features } from "@/env";
import { safeRedirect } from "@/lib/redirects";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Create your account", robots: { index: false } };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; email?: string; plan?: string; interval?: string }>;
}) {
  const params = await searchParams;
  // Coming from a paid plan on /pricing: continue to billing with that plan preselected.
  const planTarget =
    isPlanKey(params.plan) && params.plan !== "free"
      ? `/app/settings/billing?plan=${params.plan}&interval=${isBillingInterval(params.interval) ? params.interval : "month"}`
      : undefined;
  const redirectTo = safeRedirect(params.redirect ?? planTarget);
  if (await getUser()) redirect(redirectTo);

  return (
    <AuthCard
      title="Create your account"
      description={`Start using ${site.name} for free. No credit card required.`}
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" href={`/sign-in?redirect=${encodeURIComponent(redirectTo)}`}>
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm
        redirectTo={redirectTo}
        defaultEmail={typeof params.email === "string" ? params.email.slice(0, 254) : undefined}
        requireEmailVerification={features.requireEmailVerification}
        googleEnabled={features.googleOAuth}
      />
      <p className="mt-4 text-xs text-muted-foreground">
        By creating an account you agree to our{" "}
        <Link href="/legal/terms" className="underline underline-offset-4">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </AuthCard>
  );
}
