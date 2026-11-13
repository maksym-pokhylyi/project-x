import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthColumn } from "@/components/auth/auth-shell";
import { ConfirmEmailForm } from "@/components/auth/confirm-email-form";
import { ButtonLink } from "@/components/ui/button-link";
import { safeRedirect } from "@/lib/redirects";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false }, referrer: "no-referrer" };

/**
 * Landing page for a verification link opened in a browser that did not create the
 * account (see `beforeEmailVerification` in src/lib/auth.ts). Rendering it changes
 * nothing; the account is verified only when the form is submitted.
 */
export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; redirect?: string }> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const redirectTo = safeRedirect(params.redirect);

  if (!token) {
    return (
      <AuthColumn>
        <AuthCard title="This link is no longer valid" description="Confirmation links work for 24 hours. Sign in to receive a new one.">
          <ButtonLink href="/sign-in" className="w-full">
            Go to sign in
          </ButtonLink>
        </AuthCard>
      </AuthColumn>
    );
  }

  return (
    <AuthColumn>
      <AuthCard
        title="Confirm your email"
        description="Choose the password for your account to finish. For your security it replaces any password set earlier, and other devices are signed out."
        below={
          <Link href="/sign-in" className="link inline-flex min-h-11 items-center rounded-sm font-semibold">
            Back to sign in
          </Link>
        }
      >
        <ConfirmEmailForm token={token} redirectTo={redirectTo} />
      </AuthCard>
    </AuthColumn>
  );
}
