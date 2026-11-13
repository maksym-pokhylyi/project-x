"use client";

import { ChevronsUpDown, LifeBuoy, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

/** Initial of a person on a brand-tint disc. */
export function UserInitial({ name, email, className }: { name: string; email: string; className?: string }) {
  const initial = (name || email).trim().slice(0, 1).toUpperCase();
  return (
    <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full bg-brand-tint text-13 font-semibold text-brand ${className ?? ""}`}>
      {initial}
    </span>
  );
}

/** Signs out and returns to the sign-in page. Shared by the sidebar menu and the mobile sheet. */
export function useSignOut() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };
}

/** Account menu at the foot of the sidebar: who is signed in, profile, help, sign out. */
export function UserMenu({ name, email }: { name: string; email: string }) {
  const signOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-12 w-full justify-start gap-2.5 px-2" data-testid="user-menu">
          <UserInitial name={name} email={email} />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm leading-5 font-medium text-ink">{name}</span>
            <span className="block truncate text-xs leading-4 font-normal text-ink-2">{email}</span>
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-ink-2" />
          <span className="sr-only">Open account menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
        <DropdownMenuLabel className="truncate font-normal">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings/profile">
            <User aria-hidden />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/contact">
            <LifeBuoy aria-hidden />
            Help and contact
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="sign-out" onSelect={() => void signOut()}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
