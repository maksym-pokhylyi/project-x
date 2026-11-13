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
 * Label above, control, then helper or error below, with the right ARIA wiring: 6 px from
 * label to field, as in the artboards. The field's height comes from the form around it
 * (see <Form> and the control scale); pass `size` only for a field outside any group.
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
