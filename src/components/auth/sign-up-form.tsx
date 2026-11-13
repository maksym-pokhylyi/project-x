"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { FormError, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { fieldErrorsFrom, signUpSchema, type FieldErrors } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { GoogleButton, OrDivider } from "./google-button";

/**
 * The one sign-up form, laid out as in the SignUp artboards: name, work email, password —
 * validated here, created through the auth client, then on to "check your inbox" (or straight
 * to `redirectTo` when e-mail verification is off).
 *
 * A page that embeds the form inside its own flow (the claim page) changes its WORDS and
 * adds to it through the optional props below; the logic — validation, errors, the
 * verification step, the redirect — is not forked:
 *
 *   labels            other wording for the fields and the button
 *   emailHint         a line under the e-mail field
 *   children          rendered inside the form, between the fields and the button (a consent tick)
 *   guard             called after the fields validate; return a message to stop the submit
 *   controlClassName  one height for the fields and the button (control sizes)
 *   submitClassName   layout of the button (it fills the row by default)
 *   aside             rendered beside the button (a secondary link)
 */
export function SignUpForm({
  redirectTo,
  defaultEmail,
  requireEmailVerification,
  googleEnabled,
  labels,
  emailHint,
  children,
  guard,
  controlClassName,
  submitClassName = "w-full",
  aside,
}: {
  redirectTo: string;
  defaultEmail?: string;
  requireEmailVerification: boolean;
  googleEnabled: boolean;
  labels?: { name?: string; email?: string; submit?: string; pending?: string };
  emailHint?: ReactNode;
  children?: ReactNode;
  guard?: () => string | null;
  controlClassName?: string;
  submitClassName?: string;
  aside?: ReactNode;
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
    const stopped = guard?.() ?? null;
    if (stopped) {
      setFormError(stopped);
      return;
    }
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
      <form onSubmit={onSubmit} noValidate className="flex flex-col" data-testid="sign-up-form">
        <div className="space-y-4">
          <FormError message={formError} />
          <FormField label={labels?.name ?? "Your name"} name="name" autoComplete="name" required error={errors.name?.[0]} className={controlClassName} />
          <FormField
            label={labels?.email ?? "Work email"}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.co.uk"
            required
            defaultValue={defaultEmail}
            hint={emailHint}
            error={errors.email?.[0]}
            className={controlClassName}
          />
          <FormField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 8 characters."
            error={errors.password?.[0]}
            className={controlClassName}
          />
          {children}
        </div>
        <div className={cn("mt-5", aside ? "flex flex-col gap-x-6 gap-y-1 md:flex-row md:flex-wrap md:items-center" : null)}>
          <Button type="submit" className={cn(controlClassName, submitClassName)} loading={pending}>
            {pending ? (labels?.pending ?? "Creating account…") : (labels?.submit ?? "Create account")}
          </Button>
          {aside}
        </div>
      </form>
    </>
  );
}
