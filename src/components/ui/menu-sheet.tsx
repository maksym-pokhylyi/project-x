"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { IconButton } from "./icon-button"

/** The three-line menu sign and the cross, drawn as in the artboards (1.8 px, round caps). */
function MenuSign({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-[1.375rem] fill-none stroke-current stroke-[1.8] [stroke-linecap:round]">
      {open ? <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
    </svg>
  )
}

/*
 * Navigation below 768 px: a three-line button that opens a sheet dropping from the top of
 * the screen, with the wordmark and a close button in its head (56 px, like the bar it
 * covers) and the menu under it. One component for the public site and the app.
 *
 *   <MenuSheet brand={<Wordmark size="sm" />} tone="surface">
 *     {(close) => (
 *       <nav aria-label="App">… <NavLink variant="menu" onClick={close}>Radar</NavLink> …</nav>
 *     )}
 *   </MenuSheet>
 *
 * Built on Radix Dialog: focus is trapped while it is open, Escape closes it and focus
 * returns to the button. The children get `close` to call when a link is followed. The
 * button and the sheet exist only below 768 px (`md:hidden`).
 *
 *   tone         surface (white, the app) | paper (the public site)
 *   headClassName  the head's side padding, to line the wordmark up with the bar behind it
 */
function MenuSheet({
  brand,
  tone = "surface",
  openLabel = "Open menu",
  closeLabel = "Close menu",
  headClassName,
  triggerProps,
  children,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Content>, "children" | "title"> & {
  /** The wordmark shown in the head of the sheet. */
  brand: React.ReactNode
  tone?: "surface" | "paper"
  openLabel?: string
  closeLabel?: string
  headClassName?: string
  /** Extra attributes for the three-line button (a test id). */
  triggerProps?: Omit<React.ComponentProps<typeof IconButton>, "label" | "children"> & { [key: `data-${string}`]: string | undefined }
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const close = React.useCallback(() => setOpen(false), [])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <IconButton label={openLabel} {...triggerProps} className={cn("md:hidden", triggerProps?.className)}>
          <MenuSign />
        </IconButton>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/45 duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 md:hidden" />
        <DialogPrimitive.Content
          data-slot="menu-sheet"
          aria-describedby={undefined}
          {...props}
          className={cn(
            "fixed inset-x-0 top-0 z-50 max-h-dvh overflow-y-auto border-b border-line shadow-overlay duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 md:hidden",
            tone === "paper" ? "bg-paper" : "bg-surface",
            props.className,
          )}
        >
          <div className={cn("flex min-h-14 items-center justify-between border-b border-line pr-2 pl-5", headClassName)}>
            <DialogPrimitive.Title asChild>
              <span>
                <span className="sr-only">Menu</span>
                {brand}
              </span>
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton label={closeLabel}>
                <MenuSign open />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          {children(close)}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export { MenuSheet }
