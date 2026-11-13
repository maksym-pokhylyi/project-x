import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { site } from "@/config/site";
import { features } from "@/env";
import { safeRedirect } from "@/lib/redirects";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const redirectTo = safeRedirect((await searchParams).redirect);
  if (await getUser()) redirect(redirectTo);

  return (
    <AuthCard
      title={`Sign in to ${site.name}`}
      footer={
        <>
          New here?{" "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" href={`/sign-up?redirect=${encodeURIComponent(redirectTo)}`}>
            Create an account
          </Link>
        </>
      }
    >
      <SignInForm redirectTo={redirectTo} googleEnabled={features.googleOAuth} />
    </AuthCard>
  );
}
