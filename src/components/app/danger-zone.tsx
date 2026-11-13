"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Form } from "@/components/forms/form";
import { FormError, FormField } from "@/components/forms/form-field";
import { ActionList, ActionRow } from "@/components/ui/action-row";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteAccountAction, deleteWorkspaceAction, previewAccountDeletionAction } from "@/server/actions/account";

/**
 * Entry points for export and permanent deletion (settings pages). The rules live on the
 * server (src/server/tenant-data.ts); these components only collect the confirmation.
 *
 * The page stays quiet: the way in is an outlined button with a red label, and the one
 * filled red button is in the dialog, beside the sentence that says what is lost.
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
    <ActionList data-testid="workspace-danger-zone">
      <ActionRow
        title="Export this workspace"
        description="Download everything stored for this workspace as one JSON file."
        action={
          <ButtonLink href="/api/workspace/export" download variant="outline" data-testid="export-workspace">
            Export data
          </ButtonLink>
        }
      />
      <ActionRow
        title="Delete this workspace"
        description="Permanently removes the workspace, its members, files and all of its data."
        action={
          <Button variant="destructive-outline" onClick={() => setOpen(true)} data-testid="delete-workspace">
            Delete workspace
          </Button>
        }
      />
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {workspaceName}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. All data and files of this workspace are removed for every member. A workspace with a running subscription
              cannot be deleted: cancel it under Billing first.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={onSubmit}>
            <FormError message={error} />
            <FormField label={`Type “${workspaceName}” to confirm`} name="confirmName" autoComplete="off" required />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" loading={pending}>
                {pending ? "Deleting…" : "Delete workspace permanently"}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </ActionList>
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
    <ActionList data-testid="account-danger-zone">
      <ActionRow
        title="Delete your account"
        description="Permanently removes your account and the workspaces only you belong to."
        action={
          <Button variant="destructive-outline" onClick={() => void start()} data-testid="delete-account">
            Delete account
          </Button>
        }
      />
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This cannot be undone. You are signed out everywhere and removed from every workspace. {summary}
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={onSubmit}>
            <FormError message={error} />
            <FormField label={`Type ${email} to confirm`} name="confirmEmail" type="email" autoComplete="off" required />
            <FormField label="Current password" name="password" type="password" autoComplete="current-password" hint="Leave empty if you only sign in with Google." />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" loading={pending}>
                {pending ? "Deleting…" : "Delete account permanently"}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </ActionList>
  );
}
