import type { ComponentProps } from "react";
import { controlClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Styled native <select>: accessible, mobile-friendly and dependency-free. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(controlClasses, "select-chevron h-11 w-auto cursor-pointer appearance-none pr-9", className)}
      {...props}
    />
  );
}
