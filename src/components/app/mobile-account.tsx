"use client";

import { LifeBuoy, LogOut, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserInitial, useSignOut } from "./user-menu";
import { WorkspaceSwitcher, type SwitcherWorkspace } from "./workspace-switcher";

const row = "flex min-h-12 w-full items-center gap-3 rounded-control px-2 text-left text-base font-medium text-ink -outline-offset-2 hover:bg-surface-sunken [&_svg]:size-5 [&_svg]:text-ink-2";

/**
 * Account sheet for phones and tablets (below 1024 px): opened from the avatar in the top bar,
 * it rises from the bottom edge so that the workspace switcher, the plan and sign-out are all
 * within thumb reach. Rows are 48 px tall.
 */
export function MobileAccount({
  name,
  email,
  isAdmin,
  current,
  workspaces,
  plan,
}: {
  name: string;
  email: string;
  isAdmin: boolean;
  current: SwitcherWorkspace;
  workspaces: SwitcherWorkspace[];
  /** The plan block, rendered by the layout (server) so that billing rules stay in one place. */
  plan: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const signOut = useSignOut();
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="grid size-10 place-items-center rounded-full" data-testid="account-menu" aria-label="Open account menu">
          <UserInitial name={name} email={email} />
        </button>
      </DialogTrigger>
      <DialogContent className="gap-4 lg:hidden">
        <DialogHeader>
          <DialogTitle className="truncate">{name}</DialogTitle>
          <DialogDescription className="truncate">{email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <WorkspaceSwitcher current={current} workspaces={workspaces} testId="workspace-switcher-sheet" />
          {plan}
        </div>

        <nav aria-label="Account" className="-mx-2 border-t border-line pt-2">
          <Link href="/app/settings/profile" onClick={close} className={row}>
            <User aria-hidden /> Profile
          </Link>
          <Link href="/contact" onClick={close} className={row}>
            <LifeBuoy aria-hidden /> Help and contact
          </Link>
          {isAdmin ? (
            <Link href="/admin" onClick={close} className={row}>
              <ShieldCheck aria-hidden /> Admin
            </Link>
          ) : null}
          <button type="button" className={row} onClick={() => void signOut()}>
            <LogOut aria-hidden /> Sign out
          </button>
        </nav>
      </DialogContent>
    </Dialog>
  );
}
