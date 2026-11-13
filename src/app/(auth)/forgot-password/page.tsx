import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email address of your account and we will send you a reset link."
      footer={
        <Link href="/sign-in">Back to sign in</Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
