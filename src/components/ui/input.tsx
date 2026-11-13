import * as React from "react"
import { controlSize, type ControlSize } from "@/components/ui/control-group"
import { cn } from "@/lib/utils"

/*
 * Shared look of text-like controls (input, textarea, select triggers), as in the artboards:
 * 6 px radius, a 1 px line-strong edge (at least 3:1), white surface. The text is 16 px on
 * phones at every size (which also stops iOS zooming in on focus) and follows the control
 * size from 640 px: 15 px at 44 px, 16 px at 48 and 52 px.
 */
export const controlClasses =
  "w-full min-w-0 rounded-control border border-line-strong bg-surface px-(--field-px) text-base text-ink transition-[border-color,background-color] duration-150 ease-out placeholder:text-ink-2 hover:border-ink focus-visible:border-brand disabled:cursor-not-allowed disabled:border-line disabled:bg-paper-deep disabled:text-ink-2 aria-invalid:border-danger aria-invalid:hover:border-danger sm:text-(length:--field-text) [&[readonly]]:bg-paper-deep"

/** Single-line controls are as tall as the control scale says (see control-group.tsx). */
export const controlHeight = "h-(--control-h)"

/*
 * A text field. Its HEIGHT comes from the control scale shared with buttons: 44 px on its
 * own, and inside a form or a search row whatever that group says, so it always matches the
 * button beside it. `size` ("sm" 44 · "md" 48 · "lg" 52 · "form") sizes one field alone;
 * prefer sizing the group. (The native `size` attribute, a width in characters, is not
 * supported: set a width with a class.)
 */
function Input({ className, type, size, ...props }: Omit<React.ComponentProps<"input">, "size"> & { size?: ControlSize }) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        controlClasses,
        controlHeight,
        size && controlSize(size),
        "file:mr-3 file:h-full file:border-0 file:border-r file:border-line file:bg-transparent file:pr-3 file:text-sm file:font-medium file:text-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input }
