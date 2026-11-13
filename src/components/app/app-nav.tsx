"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Wordmark } from "@/components/logo";
import { NavLink } from "@/components/ui/nav-link";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; match: (path: string) => boolean };

/**
 * The product's sections, in the order of the top bar. "Documents" is the library at
 * /app/library. Add a section here and it appears in the bar and in the phone menu.
 */
const sections: Item[] = [
  { href: "/app", label: "Radar", match: (path) => path === "/app" || path.startsWith("/app/tenders") || path.startsWith("/app/radar") },
  { href: "/app/bids", label: "Bids", match: (path) => path.startsWith("/app/bids") },
  { href: "/app/library", label: "Documents", match: (path) => path.startsWith("/app/library") },
];

const settings: Item = {
  href: "/app/settings/profile",
  label: "Settings",
  match: (path) => path.startsWith("/app/settings") || path.startsWith("/app/usage"),
};

/**
 * Primary navigation in the top bar (768 px and up): three links, 15 px. The current one is
 * marked by <NavLink> (ink, semibold, 2 px ink rule on the bar's bottom edge,
 * aria-current="page"); the others are muted. Settings is reached from the account menu.
 */
export function AppNav() {
  return (
    <nav aria-label="App" className="hidden items-stretch gap-7 md:flex">
      {sections.map((item) => (
        <NavLink key={item.href} href={item.href} match={item.match}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

const iconButton = "grid size-11 shrink-0 cursor-pointer place-items-center rounded-control text-ink transition-colors duration-150 hover:bg-paper-deep";

function MenuIcon({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-[1.375rem] fill-none stroke-current stroke-[1.8] [stroke-linecap:round]">
      {open ? <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
    </svg>
  );
}

/**
 * The same navigation below 768 px: the three-line button at the right of the bar opens a
 * sheet that drops from the top with the sections, Settings and the workspace switcher.
 * Built on Radix Dialog: focus is trapped while it is open, Escape closes it and focus
 * returns to the button. Rows are 52 px tall.
 */
export function AppMenu({ workspace }: { workspace: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button type="button" className={cn(iconButton, "md:hidden")} aria-label="Open menu" data-testid="app-menu">
          <MenuIcon />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/45 duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 md:hidden" />
        <DialogPrimitive.Content
          data-slot="app-menu"
          aria-describedby={undefined}
          className="fixed inset-x-0 top-0 z-50 max-h-dvh overflow-y-auto border-b border-line bg-surface shadow-overlay duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 md:hidden"
        >
          <div className="flex h-14 items-center justify-between border-b border-line pr-2 pl-5">
            <DialogPrimitive.Title asChild>
              <span>
                <span className="sr-only">Menu</span>
                <Wordmark size="sm" />
              </span>
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button type="button" className={iconButton} aria-label="Close menu">
                <MenuIcon open />
              </button>
            </DialogPrimitive.Close>
          </div>
          <nav aria-label="App" className="px-5 pt-1">
            <ul className="divide-y divide-line border-b border-line">
              {[...sections, settings].map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href} match={item.match} variant="menu" onClick={close}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="px-5 pt-4 pb-6">
            <p className="pb-2 text-13 text-ink-2">Workspace</p>
            {workspace}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
