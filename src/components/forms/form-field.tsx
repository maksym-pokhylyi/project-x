import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Label + input + hint + error with the right ARIA wiring.
 * `error` is the first validation message for this field (client or server side).
 */
export function FormField({
  label,
  name,
  error,
  hint,
  trailing,
  ...inputProps
}: Omit<ComponentProps<typeof Input>, "id" | "name"> & {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  trailing?: ReactNode;
}) {
  const id = `field-${name}`;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {trailing}
      </div>
      <Input id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...inputProps} />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Form-level error banner. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}
