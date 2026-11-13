"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Form } from "@/components/forms/form";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MenuButton } from "@/components/ui/menu-button";
import { cn } from "@/lib/utils";
import { workspaceSchema } from "@/lib/validation";
import { createWorkspaceAction, switchWorkspaceAction } from "@/server/actions/workspace";
import { WorkspaceAvatar } from "./workspace-avatar";

export type SwitcherWorkspace = { id: string; name: string; logo: string | null; role: string };

/**
 * Shows the current workspace and switches between workspaces (or creates one).
 *  - `bar`: in the top bar, as in the artboards — the workspace name in muted 14 px text
 *    (with the workspace's logo when it has one) and a small chevron;
 *  - `field`: a full-width outlined button, for the phone menu.
 */
export function WorkspaceSwitcher({
  current,
  workspaces,
  variant = "bar",
  testId = "workspace-switcher",
  className,
}: {
  current: SwitcherWorkspace;
  workspaces: SwitcherWorkspace[];
  variant?: "bar" | "field";
  /** The top-bar instance keeps the default id; a second instance (phone menu) must pass its own. */
  testId?: string;
  className?: string;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function switchTo(organizationId: string) {
    if (organizationId === current.id) return;
    const result = await switchWorkspaceAction({ organizationId });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = workspaceSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setPending(true);
    const result = await createWorkspaceAction(parsed.data);
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setDialogOpen(false);
    toast.success(`Workspace "${parsed.data.name}" created.`);
    router.push("/app");
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "bar" ? (
            <MenuButton data-testid={testId} className={className} leading={current.logo ? <WorkspaceAvatar name={current.name} logo={current.logo} /> : null}>
              <span data-testid="current-workspace-name">{current.name}</span>
              <span className="sr-only">. Switch workspace</span>
            </MenuButton>
          ) : (
            <Button variant="outline" className={cn("w-full justify-between gap-2 px-3", className)} data-testid={testId}>
              <span className="flex min-w-0 items-center gap-2.5">
                <WorkspaceAvatar name={current.name} logo={current.logo} />
                <span className="truncate" data-testid="current-workspace-name">
                  {current.name}
                </span>
              </span>
              <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-ink-2" />
              <span className="sr-only">Switch workspace</span>
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={variant === "bar" ? "end" : "start"} className={variant === "bar" ? "w-72" : "w-(--radix-dropdown-menu-trigger-width) min-w-56"}>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((workspace) => (
            <DropdownMenuItem key={workspace.id} onSelect={() => void switchTo(workspace.id)} className="gap-2">
              <WorkspaceAvatar name={workspace.name} logo={workspace.logo} />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {workspace.id === current.id ? <Check aria-label="Current workspace" className="size-4 text-brand" /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialogOpen(true)} className="gap-2">
            <Plus aria-hidden className="size-4" />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>Each workspace has its own members, plan and data.</DialogDescription>
          </DialogHeader>
          <Form onSubmit={onCreate} noValidate>
            <FormField label="Workspace name" name="name" required autoFocus error={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {pending ? "Creating…" : "Create workspace"}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
