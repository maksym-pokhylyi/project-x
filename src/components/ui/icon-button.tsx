import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

/*
 * A button that shows only an icon (open menu, close, copy, remove a row). It is a Button
 * of the control scale: 44 px square on its own, the group's height inside a form or a
 * search row, so it lines up with the field beside it.
 *
 *   <IconButton label="Open menu"><MenuIcon /></IconButton>
 *   <IconButton label="Open account menu" shape="round"><UserInitial … /></IconButton>
 *
 * `label` is required: it is the accessible name. When the content is visible TEXT (the
 * initials of the avatar), pass `labelAsText`: the label is then written inside the button
 * for screen readers instead of as `aria-label`, so the name is not a second, different
 * label laid over what is shown (WCAG 2.5.3). Variants are the Button's; the default is
 * `ghost` (no edge until hover). `shape="round"` is for a disc such as the avatar. It
 * forwards its props, so it can be the child of a Radix trigger (`asChild`).
 */
function IconButton({
  label,
  labelAsText = false,
  shape = "square",
  variant = "ghost",
  size = "icon",
  className,
  type = "button",
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "aria-label" | "asChild" | "size"> & {
  /** What the button does, in words: "Close menu". */
  label: string
  /** The content is visible text: say the label as text inside the button, not as `aria-label`. */
  labelAsText?: boolean
  shape?: "square" | "round"
  size?: "icon" | "icon-sm" | "icon-md" | "icon-lg"
}) {
  return (
    <Button type={type} variant={variant} size={size} aria-label={labelAsText ? undefined : label} className={cn(shape === "round" && "rounded-full", className)} {...props}>
      {children}
      {labelAsText ? <span className="sr-only">{label}</span> : null}
    </Button>
  )
}

export { IconButton }
