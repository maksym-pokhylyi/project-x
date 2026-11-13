import * as React from "react"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Control sizes (Foundations, "Control sizes"). One height scale for fields AND buttons:
 *
 *   sm    44 px   toolbars, tables and filters in the app — the default everywhere
 *   md    48 px   forms
 *   lg    52 px   search rows
 *   form  a form: 52 px on phones, 48 px from 640 px
 *
 * Two heights are never mixed in one row: a button beside a field has the field's height,
 * and a form's submit button the height of the form's fields. You do not arrange that per
 * element. Say the size ONCE, on the group, and every Button, Input, select and filter chip
 * inside takes it (they are all as tall as the CSS variable --control-h, which the group
 * sets and children inherit):
 *
 *   <ControlGroup size="lg" className="flex gap-2">      a search row: both 52 px
 *     <Input type="search" … />
 *     <Button type="submit">Find my company</Button>
 *   </ControlGroup>
 *
 *   <form className={controlSize("form")}>…</form>       a form: fields and submit 48 / 52 px
 *   <ControlGroup asChild size="form"><form>…</form></ControlGroup>     the same
 *
 * Outside any group a control is 44 px. A control can still be sized on its own with its
 * `size` prop (same words), but a row should never need that.
 */
export type ControlSize = "sm" | "md" | "lg" | "form"

const sizeClasses: Record<ControlSize, string> = {
  sm: "controls-sm",
  md: "controls-md",
  lg: "controls-lg",
  form: "controls-form",
}

/** The class that sets the control size for an element and everything inside it. */
export function controlSize(size: ControlSize): string {
  return sizeClasses[size]
}

function ControlGroup({
  size,
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  size: ControlSize
  /** Put the size on the child element (a <form>, a <fieldset>) instead of a wrapping div. */
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "div"
  return <Comp data-slot="control-group" data-control-size={size} className={cn(sizeClasses[size], className)} {...props} />
}

export { ControlGroup }
