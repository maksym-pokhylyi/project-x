"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormRow, FormRowAction } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { sendNotificationPreviewAction } from "../actions";

const KINDS = [
  { value: "digest", label: "Weekly digest" },
  { value: "alert", label: "Daily alert" },
  { value: "reminder", label: "Deadline reminder" },
  { value: "renewal", label: "Renewal reminder" },
] as const;

const MODES = [
  { value: "auto", label: "What is new now, or a sample if nothing is" },
  { value: "live", label: "Only what is new now" },
  { value: "sample", label: "Sample: everything on the radar" },
] as const;

/**
 * /admin/notifications → "Send me a preview". The e-mail goes to the signed-in founder
 * (or to the dev outbox when no mail provider is configured), never to the workspace.
 */
export function NotificationPreviewForm({ workspaces, to, delivery }: { workspaces: Array<{ id: string; name: string }>; to: string; delivery: "resend" | "outbox" | "none" }) {
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setOutcome(null);
    const result = await sendNotificationPreviewAction({ organizationId: form.get("organizationId"), kind: form.get("kind"), mode: form.get("mode") });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    if (result.data.status === "empty") {
      setOutcome(`Nothing to preview for ${result.data.workspace}. ${result.data.reason}`);
      return;
    }
    const where = result.data.delivery === "outbox" ? "the dev outbox (/dev/outbox)" : result.data.to;
    setOutcome(`Preview for ${result.data.workspace} sent to ${where}${result.data.mode === "sample" ? " — a sample: nothing is new for this workspace right now." : "."}`);
    toast.success("Preview sent.");
  }

  if (workspaces.length === 0) return <p className="text-sm text-ink-2">No workspaces yet.</p>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="notification-preview-form">
      <FormRow>
        <div className="flex min-w-0 flex-[2] flex-col gap-2">
          <Label htmlFor="preview-workspace">Workspace</Label>
          <NativeSelect id="preview-workspace" name="organizationId" required defaultValue={workspaces[0]!.id} className="w-full">
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="preview-kind">E-mail</Label>
          <NativeSelect id="preview-kind" name="kind" defaultValue="digest" className="w-full">
            {KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex min-w-0 flex-[2] flex-col gap-2">
          <Label htmlFor="preview-mode">Content</Label>
          <NativeSelect id="preview-mode" name="mode" defaultValue="auto" className="w-full">
            {MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <FormRowAction>
          <Button type="submit" loading={pending} disabled={delivery === "none"} data-testid="send-preview">
            {pending ? "Sending…" : "Send me a preview"}
          </Button>
        </FormRowAction>
      </FormRow>
      <p className="text-sm text-ink-2">
        {delivery === "resend" ? `Goes to ${to} only.` : delivery === "outbox" ? "No mail provider is configured: it is written to the dev outbox." : "This deployment cannot deliver e-mail."}
      </p>
      {outcome ? (
        <Alert role="status" icon={false} data-testid="preview-outcome">
          <AlertDescription>{outcome}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
