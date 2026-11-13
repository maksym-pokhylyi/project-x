import { CircleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Helper text under a control. */
export function FieldHint({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p id={id} className={cn("text-13 text-ink-2", className)}>
      {children}
    </p>
  );
}

/** Error text under a control: icon + text in danger, never colour alone. Announced to screen readers. */
export function FieldError({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className={cn("flex items-start gap-1.5 text-13 font-medium text-danger", className)}>
      <CircleAlert aria-hidden className="mt-px size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Label above, control, then helper or error below, with the right ARIA wiring.
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
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {trailing}
      </div>
      <Input id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...inputProps} />
      {hint && !error ? <FieldHint id={`${id}-hint`}>{hint}</FieldHint> : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

/**
 * A row of labelled fields with its action button (invite a teammate, add a row, search by
 * two criteria…). Stacks on phones, sits in one line from 640 px.
 *
 * Every child has the SAME structure — a label line, a gap, then the control — so controls
 * line up by construction, with or without an error under a field. The action goes in
 * <FormRowAction>, which reserves the label line with an invisible spacer. Never line a
 * button up with fields by a margin offset or by `items-end` (that breaks as soon as a field
 * shows an error under it).
 */
export function FormRow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div data-slot="form-row" className={cn("flex flex-col gap-3 sm:flex-row sm:items-start", className)}>
      {children}
    </div>
  );
}

/** The action of a <FormRow>: mirrors a field (label line + gap + control) so the button meets the controls exactly. */
export function FormRowAction({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div data-slot="form-row-action" className={cn("flex flex-col gap-2", className)}>
      <span aria-hidden className="hidden text-sm leading-5 select-none sm:block">
        &nbsp;
      </span>
      {children}
    </div>
  );
}

/** Form-level error banner. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2.5 rounded-control bg-danger-tint px-3.5 py-3 text-sm text-ink">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
      <span>{message}</span>
    </p>
  );
}
