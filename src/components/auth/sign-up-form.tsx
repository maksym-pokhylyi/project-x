"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormError, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { fieldErrorsFrom, signUpSchema, type FieldErrors } from "@/lib/validation";
import { GoogleButton, OrDivider } from "./google-button";

/**
 * The sign-up form, laid out as in the SignUp artboards: three fields and one button.
 * (The artboard also draws an "Email me the weekly digest" tick box: there is no setting
 * behind it yet, so it is not shown rather than shown and ignored.)
 */
export function SignUpForm({
  redirectTo,
  defaultEmail,
  requireEmailVerification,
  googleEnabled,
}: {
  redirectTo: string;
  defaultEmail?: string;
  requireEmailVerification: boolean;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = signUpSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    const { error } = await authClient.signUp.email({ ...parsed.data, callbackURL: redirectTo });
    if (error) {
      setPending(false);
      setFormError(error.message ?? "Could not create the account. Please try again.");
      return;
    }
    if (requireEmailVerification) {
      router.push(`/verify-email?email=${encodeURIComponent(parsed.data.email)}&redirect=${encodeURIComponent(redirectTo)}`);
    } else {
      router.push(redirectTo);
      router.refresh();
    }
  }

  return (
    <>
      {googleEnabled ? (
        <>
          <GoogleButton callbackURL={redirectTo} label="Sign up with Google" />
          <OrDivider />
        </>
      ) : null}
      <form onSubmit={onSubmit} noValidate className="flex flex-col">
        <div className="space-y-4">
          <FormError message={formError} />
          <FormField label="Your name" name="name" autoComplete="name" required error={errors.name?.[0]} />
          <FormField
            label="Work email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.co.uk"
            required
            defaultValue={defaultEmail}
            error={errors.email?.[0]}
          />
          <FormField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 8 characters."
            error={errors.password?.[0]}
          />
        </div>
        <Button type="submit" className="mt-5 w-full" loading={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </>
  );
}
