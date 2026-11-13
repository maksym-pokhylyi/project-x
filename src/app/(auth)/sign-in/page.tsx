import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthColumn } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { site } from "@/config/site";
import { features } from "@/env";
import { safeRedirect } from "@/lib/redirects";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/** Sign in, as in the SignIn-1440 / SignIn-390 artboards. "Create an account" is the link in the header. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect?: string; next?: string }> }) {
  const params = await searchParams;
  // `next` is accepted as an alias of `redirect` (marketing links use it).
  const redirectTo = safeRedirect(params.redirect ?? params.next);
  if (await getUser()) redirect(redirectTo);

  return (
    <AuthColumn>
      <AuthCard
        title="Sign in"
        below={
          <>
            <span>New to {site.name}?</span>
            <Link href="/find" className="link inline-flex min-h-11 items-center rounded-sm font-semibold">
              Find your company
            </Link>
          </>
        }
      >
        <SignInForm redirectTo={redirectTo} googleEnabled={features.googleOAuth} />
      </AuthCard>
    </AuthColumn>
  );
}
