import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { ChevronDownIcon } from "./icons"

/*
 * The quiet control that opens a menu from a bar: muted 14 px text and a small chevron, 44 px
 * tall, a paper-deep fill on hover ("Aldermoor & Pike ⌄" in the top bar). Use it as the
 * child of a menu trigger; it forwards its props.
 *
 *   <DropdownMenuTrigger asChild>
 *     <MenuButton>{workspace.name}</MenuButton>
 *   </DropdownMenuTrigger>
 *
 * A menu opened from a FIELD-like control (full width, outlined) is a Button
 * variant="outline" with the up-down chevron instead: see the workspace switcher's `field`.
 * `leading` takes a small picture before the text (a workspace logo).
 */
function MenuButton({
  leading,
  className,
  children,
  type = "button",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "asChild" | "loading"> & {
  leading?: React.ReactNode
}) {
  return (
    <Button type={type} variant="menu" className={cn("min-w-0", className)} {...props}>
      {leading}
      <span className="truncate">{children}</span>
      <ChevronDownIcon className="size-3.5 shrink-0" />
    </Button>
  )
}

export { MenuButton }
