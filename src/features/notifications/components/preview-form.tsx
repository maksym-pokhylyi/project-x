"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

const field = "h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm";

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

  if (workspaces.length === 0) return <p className="text-sm text-muted-foreground">No workspaces yet.</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="notification-preview-form">
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)]">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Workspace</span>
          <select name="organizationId" required className={field} defaultValue={workspaces[0]!.id}>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">E-mail</span>
          <select name="kind" className={field} defaultValue="digest">
            {KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Content</span>
          <select name="mode" className={field} defaultValue="auto">
            {MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending} disabled={delivery === "none"} data-testid="send-preview">
          {pending ? "Sending…" : "Send me a preview"}
        </Button>
        <p className="text-sm text-muted-foreground">
          {delivery === "resend" ? `Goes to ${to} only.` : delivery === "outbox" ? "No mail provider is configured: it is written to the dev outbox." : "This deployment cannot deliver e-mail."}
        </p>
      </div>
      {outcome ? (
        <p role="status" className="rounded-md border bg-muted/40 p-3 text-sm" data-testid="preview-outcome">
          {outcome}
        </p>
      ) : null}
    </form>
  );
}
