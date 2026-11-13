"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormError, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { fieldErrorsFrom, signInSchema, type FieldErrors } from "@/lib/validation";
import { GoogleButton, OrDivider } from "./google-button";

export function SignInForm({ redirectTo, googleEnabled }: { redirectTo: string; googleEnabled: boolean }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = signInSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    const { error } = await authClient.signIn.email({ ...parsed.data, callbackURL: redirectTo });
    if (error) {
      setPending(false);
      if (error.status === 403) {
        // Unverified address: Better Auth has just sent a fresh verification link.
        router.push(`/verify-email?email=${encodeURIComponent(parsed.data.email)}&redirect=${encodeURIComponent(redirectTo)}&resent=1`);
        return;
      }
      setFormError(error.status === 401 ? "Wrong email or password." : (error.message ?? "Could not sign in. Please try again."));
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      {googleEnabled ? (
        <>
          <GoogleButton callbackURL={redirectTo} />
          <OrDivider />
        </>
      ) : null}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormField label="Email" name="email" type="email" autoComplete="email" required error={errors.email?.[0]} />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={errors.password?.[0]}
          trailing={
            <Link href="/forgot-password" className="link text-13">
              Forgot password?
            </Link>
          }
        />
        <Button type="submit" className="w-full" loading={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </>
  );
}
