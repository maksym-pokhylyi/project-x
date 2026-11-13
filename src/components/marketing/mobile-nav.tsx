"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";
import { Wordmark } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button-link";
import { NavLink } from "@/components/ui/nav-link";
import { navLinkVariants } from "@/components/ui/nav-link-variants";
import { authClient } from "@/lib/auth-client";
import { findCompany, navHref, primaryNav } from "./site-nav";

const iconButton = "grid size-11 shrink-0 cursor-pointer place-items-center rounded-control text-ink transition-colors duration-150 hover:bg-paper-deep";

/** The three-line menu sign and the cross, drawn as in the artboards (1.8 px, round caps). */
function MenuIcon({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-[1.375rem] fill-none stroke-current stroke-[1.8] [stroke-linecap:round]">
      {open ? <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
    </svg>
  );
}

/**
 * Public navigation below 768 px: a sheet that drops from the header.
 * Built on Radix Dialog, so focus is trapped while it is open, Escape closes it and focus
 * returns to the menu button. Every row is 52 px tall; the page you are on is marked by
 * NavLink (semibold, with a dot at the end of the row).
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data } = authClient.useSession();
  const signedIn = Boolean(data?.user);
  const close = () => setOpen(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button type="button" className={`${iconButton} md:hidden`} aria-label="Open menu">
          <MenuIcon />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/45 duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 md:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-0 z-50 max-h-dvh overflow-y-auto border-b border-line bg-paper shadow-overlay duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 md:hidden"
        >
          <div className="container-content flex min-h-14 items-center justify-between border-b border-line pr-2">
            <DialogPrimitive.Title asChild>
              <span>
                <span className="sr-only">Menu</span>
                <Wordmark />
              </span>
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button type="button" className={iconButton} aria-label="Close menu">
                <MenuIcon open />
              </button>
            </DialogPrimitive.Close>
          </div>
          <nav aria-label="Main" className="container-content pt-2 pb-6">
            <ul className="divide-y divide-line border-b border-line">
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <NavLink href={navHref(item.href, pathname)} variant="menu" match="exact" onClick={close}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li>
                {/* Not a place you can already be on: a plain link with the look of its neighbours. */}
                <Link href={signedIn ? "/app" : "/sign-in"} onClick={close} className={navLinkVariants({ variant: "menu" })}>
                  {signedIn ? "Open your radar" : "Sign in"}
                </Link>
              </li>
            </ul>
            <div className="mt-5 grid gap-2.5">
              <ButtonLink href={findCompany.href} size="lg" onClick={close}>
                {findCompany.label}
              </ButtonLink>
              <ButtonLink href="/free-bid-check" size="lg" variant="outline" onClick={close}>
                Get a free cited bid check
              </ButtonLink>
            </div>
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
