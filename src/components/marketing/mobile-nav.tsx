"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { findCompany, primaryNav } from "./site-nav";

/**
 * Marketing navigation below 1024 px: a full-width sheet that drops from the header.
 * Built on Radix Dialog, so focus is trapped while it is open, Escape closes it and focus
 * returns to the menu button. Every row is at least 48 px tall.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { data } = authClient.useSession();
  const signedIn = Boolean(data?.user);
  const close = () => setOpen(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu aria-hidden className="size-5" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/45 duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-0 z-50 max-h-dvh overflow-y-auto border-b border-line bg-paper shadow-overlay duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 lg:hidden"
        >
          <div className="container-content flex h-16 items-center justify-between">
            <DialogPrimitive.Title asChild>
              <span>
                <span className="sr-only">Menu</span>
                <Wordmark />
              </span>
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close menu">
                <X aria-hidden className="size-5" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <nav aria-label="Main" className="container-content pb-6">
            <ul className="divide-y divide-line border-y border-line">
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={close} className="flex min-h-12 items-center py-3 text-base font-medium text-ink">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={signedIn ? "/app" : "/sign-in"} onClick={close} className="flex min-h-12 items-center py-3 text-base font-medium text-ink">
                  {signedIn ? "Open your radar" : "Sign in"}
                </Link>
              </li>
            </ul>
            <div className="mt-5 grid gap-3">
              <Button asChild size="lg">
                <Link href={findCompany.href} onClick={close}>
                  {findCompany.label}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/free-bid-check" onClick={close}>
                  Get a free bid check
                </Link>
              </Button>
            </div>
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
