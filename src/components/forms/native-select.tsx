import type { ComponentProps } from "react";
import { controlSize, type ControlSize } from "@/components/ui/control-group";
import { controlClasses, controlHeight } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Styled native <select>: accessible, mobile-friendly and dependency-free. A field like any
 * other: its height comes from the control scale (44 px on its own, the group's size inside
 * a form or a row; `size` sizes it alone).
 */
export function NativeSelect({ className, size, ...props }: Omit<ComponentProps<"select">, "size"> & { size?: ControlSize }) {
  return (
    <select
      data-slot="native-select"
      data-size={size}
      className={cn(controlClasses, controlHeight, size && controlSize(size), "select-chevron w-auto cursor-pointer appearance-none pr-9", className)}
      {...props}
    />
  );
}
