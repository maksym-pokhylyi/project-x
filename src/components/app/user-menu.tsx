"use client";

import { LogOut, User } from "lucide-react";
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

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const initials = (name || email).trim().slice(0, 1).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-start gap-2 px-2 py-1.5" data-testid="user-menu">
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{email}</span>
          </span>
          <span className="sr-only">Open account menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings/profile" className="gap-2">
            <User aria-hidden className="size-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          data-testid="sign-out"
          onSelect={async () => {
            await authClient.signOut();
            router.push("/sign-in");
            router.refresh();
          }}
        >
          <LogOut aria-hidden className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
