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
 * `label` is required: it is the accessible name. Variants are the Button's; the default is
 * `ghost` (no edge until hover). `shape="round"` is for a disc such as the avatar. It
 * forwards its props, so it can be the child of a Radix trigger (`asChild`).
 */
function IconButton({
  label,
  shape = "square",
  variant = "ghost",
  size = "icon",
  className,
  type = "button",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "aria-label" | "asChild" | "size"> & {
  /** What the button does, in words: "Close menu". */
  label: string
  shape?: "square" | "round"
  size?: "icon" | "icon-sm" | "icon-md" | "icon-lg"
}) {
  return <Button type={type} variant={variant} size={size} aria-label={label} className={cn(shape === "round" && "rounded-full", className)} {...props} />
}

export { IconButton }
