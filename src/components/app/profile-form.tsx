"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { fieldErrorsFrom, profileSchema, type FieldErrors } from "@/lib/validation";
import { updateProfileAction } from "@/server/actions/profile";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = profileSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    const result = await updateProfileAction(parsed.data);
    setPending(false);
    if (!result.ok) {
      setErrors((result.error.details?.fieldErrors as FieldErrors | undefined) ?? {});
      toast.error(result.error.message);
      return;
    }
    toast.success("Profile updated.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-4">
      <FormField label="Name" name="name" defaultValue={name} autoComplete="name" required error={errors.name?.[0]} />
      <FormField label="E-mail" name="email" type="email" defaultValue={email} disabled hint="Contact support to change your e-mail address." />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
