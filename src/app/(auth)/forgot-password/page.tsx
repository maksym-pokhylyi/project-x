import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthColumn } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthColumn>
      <AuthCard
        title="Reset your password"
        description="Enter the email address of your account and we will send you a reset link."
        below={
          <Link href="/sign-in" className="link inline-flex min-h-11 items-center rounded-sm font-semibold">
            Back to sign in
          </Link>
        }
      >
        <ForgotPasswordForm />
      </AuthCard>
    </AuthColumn>
  );
}
