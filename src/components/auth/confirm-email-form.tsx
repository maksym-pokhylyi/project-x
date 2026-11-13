"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { fieldErrorsFrom, resetPasswordSchema, type FieldErrors } from "@/lib/validation";
import { confirmEmailAction } from "@/server/actions/auth";

/**
 * Shown when a verification link is opened in a browser that did not create the account:
 * the visitor confirms the address by choosing the account's password (which replaces any
 * password stored before). See confirmEmailAction.
 */
export function ConfirmEmailForm({ token, redirectTo }: { token: string; redirectTo: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    const result = await confirmEmailAction({ token, password: parsed.data.password, redirect: redirectTo });
    if (!result.ok) {
      setPending(false);
      setFormError(result.error.message);
      return;
    }
    toast.success(result.data.signedIn ? "Email confirmed. Welcome!" : "Email confirmed. Sign in with your new password.");
    router.push(result.data.redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="confirm-email-form">
      <FormError message={formError} />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={errors.password?.[0]}
      />
      <Button type="submit" className="w-full" loading={pending}>
        {pending ? "Confirming…" : "Confirm email and set password"}
      </Button>
    </form>
  );
}
