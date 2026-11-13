import type { ComponentProps, ReactNode } from "react";
import { FieldError } from "@/components/forms/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/*
 * Lists of choices, as the set-up and "Flag a mistake" artboards draw them: the library's
 * 20 px <Checkbox> / <RadioGroupItem> with its words beside it, the whole 44 px row being
 * the label, laid out in one, two or three columns under a legend.
 *
 *   <ChoiceGroup legend="Regions" hint="tick all that apply" columns="two">
 *     <TickRow name="region" value="UKE" defaultChecked>Yorkshire and the Humber</TickRow>
 *   </ChoiceGroup>
 *
 *   <RadioChoices legend="What is wrong?" name="issue" defaultValue="missing">
 *     <RadioRow value="missing">A contract of ours is missing</RadioRow>
 *   </RadioChoices>
 *
 * `name` / `value` post with the surrounding form (Radix keeps a hidden input in step).
 * `trailing` is a muted note at the end of a row ("From your contract wins").
 * Candidate for src/components/ui (beside checkbox.tsx and radio-group.tsx).
 */
const ROW = "flex min-h-11 cursor-pointer items-center gap-2.5 py-1 text-15 leading-snug text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:text-ink-2";

export function TickRow({ children, trailing, className, ...props }: Omit<ComponentProps<typeof Checkbox>, "children" | "className"> & { children: ReactNode; trailing?: ReactNode; className?: string }) {
  return (
    <label data-slot="tick-row" className={cn(ROW, className)}>
      <Checkbox {...props} />
      <span className="min-w-0 flex-1">{children}</span>
      {trailing ? <span className="shrink-0 text-xs text-ink-2">{trailing}</span> : null}
    </label>
  );
}

export function RadioRow({ children, className, ...props }: Omit<ComponentProps<typeof RadioGroupItem>, "children" | "className"> & { children: ReactNode; className?: string }) {
  return (
    <label data-slot="radio-row" className={cn(ROW, className)}>
      <RadioGroupItem {...props} />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

const COLUMNS = {
  /** One column: a list read top to bottom (the edit panel). */
  one: "grid-cols-1",
  /** Two columns from the smallest phone (short labels: regions). */
  two: "grid-cols-2",
  /** As many 300 px columns as fit: one on phones, three in a wide card (trades). */
  wide: "grid-cols-[repeat(auto-fill,minmax(min(100%,18.75rem),1fr))]",
  /** The same from 768 px, but two columns on phones (short labels in a long list). */
  wideFromTwo: "grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(min(100%,18.75rem),1fr))]",
} as const;

function Legend({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <legend className="pb-1 text-sm leading-5 font-semibold text-ink">
      {children}
      {hint ? <span className="font-normal text-ink-2"> · {hint}</span> : null}
    </legend>
  );
}

/** The group's error, said the way every field says it: a sign and words, never colour alone. */
function GroupError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <FieldError className="pt-1">{children}</FieldError>;
}

/** A group of tick rows under one legend, with an optional muted hint beside it and an error under it. */
export function ChoiceGroup({
  legend,
  hint,
  error,
  columns = "one",
  className,
  children,
  ...props
}: Omit<ComponentProps<"fieldset">, "children"> & { legend: ReactNode; hint?: ReactNode; error?: ReactNode; columns?: keyof typeof COLUMNS; children: ReactNode }) {
  return (
    <fieldset data-slot="choice-group" className={cn("flex min-w-0 flex-col gap-1", className)} {...props}>
      <Legend hint={hint}>{legend}</Legend>
      <div className={cn("grid gap-x-6", COLUMNS[columns])}>{children}</div>
      <GroupError>{error}</GroupError>
    </fieldset>
  );
}

/** One question with several answers, one of which is chosen: a legend over a column of radio rows. */
export function RadioChoices({
  legend,
  hint,
  error,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof RadioGroup>, "children" | "className"> & { legend: ReactNode; hint?: ReactNode; error?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <fieldset data-slot="radio-choices" className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Legend hint={hint}>{legend}</Legend>
      <RadioGroup className="gap-0" {...props}>
        {children}
      </RadioGroup>
      <GroupError>{error}</GroupError>
    </fieldset>
  );
}
