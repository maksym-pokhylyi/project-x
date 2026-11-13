import type { ComponentProps } from "react";
import { controlSize } from "@/components/ui/control-group";
import { cn } from "@/lib/utils";

/**
 * A form on the control scale: every field and button inside it is 48 px tall, 52 px on
 * phones (Foundations, "Control sizes"), so the submit button always has the height of the
 * fields. Nothing inside needs a height of its own. Fields are stacked 16 px apart.
 *
 * It is a plain <form>: pass onSubmit / action / noValidate as usual.
 */
export function Form({ className, ...props }: ComponentProps<"form">) {
  return <form data-slot="form" className={cn(controlSize("form"), "space-y-4", className)} {...props} />;
}
