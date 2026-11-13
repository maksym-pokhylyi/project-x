import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthColumn } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <AuthColumn>
        <AuthCard title="This link is no longer valid" description="Password reset links expire after one hour and can be used once.">
          <ButtonLink href="/forgot-password" className="w-full">
            Request a new link
          </ButtonLink>
        </AuthCard>
      </AuthColumn>
    );
  }

  return (
    <AuthColumn>
      <AuthCard title="Choose a new password" description="You will be signed out on all devices.">
        <ResetPasswordForm token={token} />
      </AuthCard>
    </AuthColumn>
  );
}
