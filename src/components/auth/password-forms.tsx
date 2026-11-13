"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { fieldErrorsFrom, forgotPasswordSchema, resetPasswordSchema, type FieldErrors } from "@/lib/validation";

export function ForgotPasswordForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    const { error } = await authClient.requestPasswordReset({ email: parsed.data.email, redirectTo: "/reset-password" });
    setPending(false);
    if (error && error.status === 429) {
      setFormError(error.message ?? "Too many attempts. Please try again later.");
      return;
    }
    // Same message whether or not the account exists (no e-mail enumeration).
    setSentTo(parsed.data.email);
  }

  if (sentTo) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        If an account exists for <strong className="text-foreground">{sentTo}</strong>, we have sent a link to reset the
        password. The link is valid for one hour.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
      <FormField label="E-mail" name="email" type="email" autoComplete="email" required error={errors.email?.[0]} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
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
    const { error } = await authClient.resetPassword({ newPassword: parsed.data.password, token });
    if (error) {
      setPending(false);
      setFormError(error.message ?? "This reset link is invalid or has expired. Request a new one.");
      return;
    }
    toast.success("Password updated. Sign in with your new password.");
    router.push("/sign-in");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={errors.password?.[0]}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
