import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerification } from "@/components/auth/resend-verification";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { features } from "@/env";
import { safeRedirect } from "@/lib/redirects";

export const metadata: Metadata = { title: "Verify your e-mail", robots: { index: false } };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; redirect?: string; resent?: string }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email.slice(0, 254) : "";
  const redirectTo = safeRedirect(params.redirect);
  const showDevHint = features.devTools && !features.emailConfigured;

  return (
    <AuthCard
      title="Check your inbox"
      description={
        <>
          {params.resent ? "Your e-mail address is not verified yet. " : ""}We sent a verification link to{" "}
          <strong className="font-semibold text-ink">{email || "your e-mail address"}</strong>. Open it to activate your account.
        </>
      }
      footer={
        <Link href="/sign-in">Back to sign in</Link>
      }
    >
      <div className="space-y-4">
        {showDevHint ? (
          <Alert variant="warning" role="note" data-testid="dev-outbox-hint">
            <AlertTitle>Development mode</AlertTitle>
            <AlertDescription>
              <p>
                E-mail delivery is not configured (no <code>RESEND_API_KEY</code>). Open the <Link href="/dev/outbox">dev outbox</Link> to read the message.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}
        {email ? <ResendVerification email={email} callbackURL={redirectTo} /> : null}
        <p className="text-13 text-ink-2">The link is valid for 24 hours. Check your spam folder if you cannot find it.</p>
      </div>
    </AuthCard>
  );
}
