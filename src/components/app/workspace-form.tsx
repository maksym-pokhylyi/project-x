"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fieldErrorsFrom, workspaceSchema, type FieldErrors } from "@/lib/validation";
import { updateWorkspaceAction } from "@/server/actions/workspace";
import { WorkspaceAvatar } from "./workspace-avatar";

const MAX_LOGO_BYTES = 1024 * 1024;

export function WorkspaceForm({ name, logo, canEdit }: { name: string; logo: string | null; canEdit: boolean }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = workspaceSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    const result = await updateWorkspaceAction(parsed.data);
    setPending(false);
    if (!result.ok) {
      setErrors((result.error.details?.fieldErrors as FieldErrors | undefined) ?? {});
      toast.error(result.error.message);
      return;
    }
    toast.success("Workspace updated.");
    router.refresh();
  }

  async function onLogoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("The logo must be 1 MB or smaller.");
      return;
    }
    setUploading(true);
    const body = new FormData();
    body.set("file", file);
    try {
      const response = await fetch("/api/workspace/logo", { method: "POST", body });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        toast.error(payload?.error?.message ?? "Upload failed. Please try again.");
        return;
      }
      toast.success("Logo updated.");
      router.refresh();
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="workspace-logo">Logo</Label>
        <div className="flex items-center gap-3">
          <WorkspaceAvatar name={name} logo={logo} className="size-12 rounded-card text-lg" />
          <input
            id="workspace-logo"
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={onLogoSelected}
            disabled={!canEdit || uploading}
          />
          <Button type="button" variant="outline" size="sm" disabled={!canEdit} loading={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? "Uploading…" : logo ? "Replace logo" : "Upload logo"}
          </Button>
        </div>
        <p className="text-13 text-ink-2">PNG, JPEG or WebP, up to 1 MB.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField
          label="Workspace name"
          name="name"
          defaultValue={name}
          required
          disabled={!canEdit}
          error={errors.name?.[0]}
          hint={canEdit ? undefined : "Only owners and admins can change workspace settings."}
        />
        {canEdit ? (
          <Button type="submit" loading={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        ) : null}
      </form>
    </div>
  );
}
