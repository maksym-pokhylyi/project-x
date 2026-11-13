import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <AuthCard title="This link is no longer valid" description="Password reset links expire after one hour and can be used once.">
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description="You will be signed out on all devices.">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
