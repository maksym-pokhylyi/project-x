"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteAccountAction, deleteWorkspaceAction, previewAccountDeletionAction } from "@/server/actions/account";

/**
 * Entry points for export and permanent deletion (settings pages). The rules live on the
 * server (src/server/tenant-data.ts); these components only collect the confirmation.
 */

/** Workspace settings, owners only: download a JSON export, delete the workspace. */
export function WorkspaceDangerZone({ workspaceName }: { workspaceName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await deleteWorkspaceAction({ confirmName: String(new FormData(event.currentTarget).get("confirmName") ?? "") });
    if (!result.ok) {
      setPending(false);
      setError(result.error.message);
      return;
    }
    toast.success("Workspace deleted.");
    router.push("/app");
    router.refresh();
  }

  return (
    <div className="space-y-4" data-testid="workspace-danger-zone">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Download everything stored for this workspace as a JSON file.</p>
        <Button asChild variant="outline">
          <a href="/api/workspace/export" download data-testid="export-workspace">
            Export data
          </a>
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Permanently delete this workspace, its members, files and all of its data.</p>
        <Button variant="destructive" onClick={() => setOpen(true)} data-testid="delete-workspace">
          Delete workspace
        </Button>
      </div>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {workspaceName}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. All data and files of this workspace are removed for every member. A workspace with a running
              subscription cannot be deleted: cancel it under Billing first.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormError message={error} />
            <FormField label={`Type “${workspaceName}” to confirm`} name="confirmName" autoComplete="off" required />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Deleting…" : "Delete workspace permanently"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Profile settings: delete the signed-in user's account. */
export function AccountDangerZone({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function start() {
    setOpen(true);
    setError(null);
    setSummary(null);
    const preview = await previewAccountDeletionAction();
    if (!preview.ok) return;
    if (preview.data.blockers.length > 0) {
      setError(preview.data.blockers.join(" "));
      return;
    }
    const removed = preview.data.deleteWorkspaces.map((workspace) => workspace.name);
    setSummary(removed.length > 0 ? `These workspaces only you belong to are deleted with it: ${removed.join(", ")}.` : null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await deleteAccountAction({ confirmEmail: String(form.get("confirmEmail") ?? ""), password: String(form.get("password") ?? "") || undefined });
    if (!result.ok) {
      setPending(false);
      setError(result.error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" data-testid="account-danger-zone">
      <p className="text-sm text-muted-foreground">Permanently delete your account and the workspaces only you belong to.</p>
      <Button variant="destructive" onClick={() => void start()} data-testid="delete-account">
        Delete account
      </Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This cannot be undone. You are signed out everywhere and removed from every workspace. {summary}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormError message={error} />
            <FormField label={`Type ${email} to confirm`} name="confirmEmail" type="email" autoComplete="off" required />
            <FormField label="Current password" name="password" type="password" autoComplete="current-password" hint="Leave empty if you only sign in with Google." />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Deleting…" : "Delete account permanently"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
