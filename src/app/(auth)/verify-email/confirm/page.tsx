import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ConfirmEmailForm } from "@/components/auth/confirm-email-form";
import { Button } from "@/components/ui/button";
import { safeRedirect } from "@/lib/redirects";

export const metadata: Metadata = { title: "Confirm your e-mail", robots: { index: false }, referrer: "no-referrer" };

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
      <AuthCard title="This link is no longer valid" description="Verification links expire after 24 hours. Sign in to receive a new one.">
        <Button asChild className="w-full">
          <Link href="/sign-in">Go to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Confirm your e-mail"
      description="Choose the password for your account to finish. For your security it replaces any password set earlier, and other devices are signed out."
      footer={
        <Link className="underline-offset-4 hover:underline" href="/sign-in">
          Back to sign in
        </Link>
      }
    >
      <ConfirmEmailForm token={token} redirectTo={redirectTo} />
    </AuthCard>
  );
}
