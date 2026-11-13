"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/** "Joanne Pike" → "JP"; a single name or an e-mail address gives one letter. */
function initials(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return email.trim().slice(0, 1).toUpperCase();
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

/** Initials of a person on a brand-tint disc, as in the artboards (34 px; 32 px on phones). */
export function UserInitial({ name, email, className }: { name: string; email: string; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-brand-tint text-xs font-semibold text-brand md:size-[2.125rem] md:text-13", className)}>
      {initials(name, email)}
    </span>
  );
}

/** Signs out and returns to the sign-in page. */
export function useSignOut() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };
}

export type UserMenuPlan = {
  /** Name of the workspace's plan: "Free", "Radar Pro" … */
  name: string;
  isFree: boolean;
  /** Owners are the ones who can pay: only they see "Upgrade" and "Billing". */
  isOwner: boolean;
  /** One line under the plan on Free: what the next plan adds and what it costs. */
  upgradeNote: string;
};

/**
 * Account menu, opened from the avatar at the right of the top bar: who is signed in, the
 * workspace's plan, Billing (owners), Settings, help and sign out. On Free an owner also
 * gets the menu's one call to action, "Upgrade", which goes to /pricing: the one place where
 * plans are compared and chosen.
 */
export function UserMenu({ name, email, workspaceName, plan, isAdmin }: { name: string; email: string; workspaceName: string; plan: UserMenuPlan; isAdmin: boolean }) {
  const signOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full transition-colors duration-150 hover:bg-paper-deep"
          data-testid="user-menu"
          aria-label={`Open account menu: ${name || email}`}
        >
          <UserInitial name={name} email={email} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="w-72">
        <div className="px-2.5 pt-2 pb-2.5">
          <p className="truncate text-sm leading-5 font-semibold text-ink">{name}</p>
          <p className="truncate text-13 text-ink-2">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <div className="px-2.5 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-13 text-ink-2">{workspaceName}</span>
            <Badge variant={plan.isFree ? "secondary" : "brand"} data-testid="plan-badge">
              {plan.name}
            </Badge>
          </div>
          {plan.isFree ? <p className="mt-1.5 text-13 text-ink-2">{plan.isOwner ? plan.upgradeNote : "A workspace owner can upgrade the plan."}</p> : null}
        </div>
        {plan.isOwner && plan.isFree ? (
          <DropdownMenuItem asChild variant="cta" className="mt-0">
            <Link href="/pricing">Upgrade</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {plan.isOwner ? (
          <DropdownMenuItem asChild>
            <Link href="/app/settings/billing">Billing</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/app/settings/profile">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/contact">Help and contact</Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">Admin</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="sign-out" onSelect={() => void signOut()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
