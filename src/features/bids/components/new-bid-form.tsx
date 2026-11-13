"use client";

import { CircleCheck, FileText, Loader2, TriangleAlert, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBidAction, planUploadAction, registerFileAction, removeFileAction, startProcessingAction } from "@/features/bids/actions";
import { ACCEPT_ATTRIBUTE, formatBytes, MAX_BID_BYTES, MAX_BID_FILES, MAX_FILE_BYTES, unsupportedFileReason } from "@/features/bids/constants";
import { cn } from "@/lib/utils";
import { uploadFile } from "./upload-client";

type Row = {
  key: string;
  name: string;
  size: number;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  fileId?: string;
};

export type ExistingFile = { id: string; name: string; size: number };

/**
 * New bid: drop zone + per-file status, then "Check this pack". Files go straight from
 * the browser to storage; the bid is created in `draft` on the first accepted file and
 * costs nothing until the check is started.
 */
export function NewBidForm({
  initialBidId,
  initialFiles,
  noticeId,
  allowance,
  disabled,
}: {
  initialBidId: string | null;
  initialFiles: ExistingFile[];
  noticeId: string | null;
  /** One sentence saying what starting the check will use. */
  allowance: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialFiles.map((file) => ({ key: file.id, name: file.name, size: file.size, status: "done", progress: 100, fileId: file.id })));
  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const bidId = useRef<string | null>(initialBidId);
  const creating = useRef<Promise<string | null> | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const patch = useCallback((key: string, change: Partial<Row>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row))), []);

  const ensureBid = useCallback(async (): Promise<string | null> => {
    if (bidId.current) return bidId.current;
    creating.current ??= (async () => {
      const result = await createBidAction({ noticeId: noticeId ?? undefined });
      if (!result.ok) {
        setFormError(result.error.message);
        creating.current = null;
        return null;
      }
      bidId.current = result.data.bidId;
      // Keep the draft on refresh: the page reloads its files from ?bid=.
      const url = new URL(window.location.href);
      url.searchParams.set("bid", result.data.bidId);
      window.history.replaceState(null, "", url);
      return result.data.bidId;
    })();
    return creating.current;
  }, [noticeId]);

  const addFiles = useCallback(
    async (files: File[]) => {
      if (disabled || files.length === 0) return;
      setFormError(null);
      let total = rows.filter((row) => row.status !== "error").reduce((sum, row) => sum + row.size, 0);
      let count = rows.filter((row) => row.status !== "error").length;
      const accepted: Array<{ row: Row; file: File }> = [];
      const added: Row[] = [];
      for (const file of files) {
        const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
        const base: Row = { key, name: file.name, size: file.size, status: "queued", progress: 0 };
        const reason =
          unsupportedFileReason(file.name) ??
          (file.size === 0 ? "This file is empty." : null) ??
          (file.size > MAX_FILE_BYTES ? `Larger than 50 MB (${formatBytes(file.size)}). Split it, or leave out drawings and photos.` : null) ??
          (count >= MAX_BID_FILES ? `A bid holds at most ${MAX_BID_FILES} files.` : null) ??
          (total + file.size > MAX_BID_BYTES ? "The pack would exceed 200 MB in total." : null) ??
          (rows.some((row) => row.name === file.name && row.size === file.size && row.status !== "error") ? "Already added." : null);
        if (reason) {
          added.push({ ...base, status: "error", error: reason });
          continue;
        }
        total += file.size;
        count += 1;
        added.push(base);
        accepted.push({ row: base, file });
      }
      setRows((current) => [...current, ...added]);
      if (accepted.length === 0) return;
      const id = await ensureBid();
      if (!id) {
        for (const { row } of accepted) patch(row.key, { status: "error", error: "Could not start the bid. Try again." });
        return;
      }
      // Three at a time keeps slow connections responsive.
      const queue = [...accepted];
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const { row, file } = next;
          patch(row.key, { status: "uploading", progress: 1 });
          try {
            const plan = await planUploadAction(id, { name: file.name, size: file.size });
            if (!plan.ok) throw new Error(plan.error.message);
            await uploadFile({
              file,
              target: plan.data,
              tokenUrl: "/api/bids/upload-token",
              clientPayload: { scope: "bid", bidId: id, fileId: plan.data.fileId, name: file.name },
              onProgress: (progress) => patch(row.key, { progress: Math.max(1, Math.min(99, progress)) }),
            });
            const registered = await registerFileAction(id, { fileId: plan.data.fileId, name: file.name });
            if (!registered.ok) throw new Error(registered.error.message);
            patch(row.key, { status: "done", progress: 100, fileId: registered.data.id });
          } catch (error) {
            patch(row.key, { status: "error", error: error instanceof Error ? error.message : "The upload failed. Try again." });
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    },
    [disabled, ensureBid, patch, rows],
  );

  const remove = async (row: Row) => {
    if (row.fileId && bidId.current) {
      const result = await removeFileAction(bidId.current, row.fileId);
      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }
    }
    setRows((current) => current.filter((entry) => entry.key !== row.key));
  };

  const uploaded = rows.filter((row) => row.status === "done");
  const uploading = rows.some((row) => row.status === "uploading" || row.status === "queued");

  const start = async () => {
    if (!bidId.current || uploaded.length === 0) return;
    setStarting(true);
    setFormError(null);
    if (title.trim()) {
      const { updateBidAction } = await import("@/features/bids/actions");
      await updateBidAction(bidId.current, { title: title.trim() });
    }
    const result = await startProcessingAction(bidId.current);
    if (!result.ok) {
      setStarting(false);
      setFormError(result.error.message);
      if (result.error.code === "QUOTA_EXCEEDED") router.refresh();
      return;
    }
    router.push(`/app/bids/${result.data.bidId}`);
  };

  return (
    <div className="space-y-5" data-testid="new-bid-form">
      <div
        data-testid="dropzone"
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void addFiles(Array.from(event.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
          disabled ? "bg-muted/40 opacity-60" : dragging ? "border-primary bg-primary/5" : "bg-card",
        )}
      >
        <UploadCloud aria-hidden className="size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Drop the whole tender pack here</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          The ITT, specification, questionnaires, response forms, pricing schedule and every clarification. PDF, Word (.docx), Excel (.xlsx), CSV, text or a ZIP of them — up to 50 MB per file, 200 MB in all.
        </p>
        <input
          ref={input}
          id="pack-files"
          data-testid="file-input"
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" className="mt-4" disabled={disabled} onClick={() => input.current?.click()}>
          Choose files
        </Button>
      </div>

      {rows.length > 0 ? (
        <ul className="divide-y rounded-lg border bg-card" aria-label="Files" data-testid="file-list">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-3 px-3 py-2.5" data-file-status={row.status}>
              <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{row.name}</p>
                {row.status === "error" ? (
                  <p role="alert" className="flex items-start gap-1 text-xs text-destructive">
                    <TriangleAlert aria-hidden className="mt-0.5 size-3 shrink-0" />
                    {row.error}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(row.size)}
                    {row.status === "uploading" ? ` · uploading ${row.progress}%` : row.status === "queued" ? " · waiting" : " · uploaded"}
                  </p>
                )}
                {row.status === "uploading" ? (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={row.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${row.name}`}>
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${row.progress}%` }} />
                  </div>
                ) : null}
              </div>
              {row.status === "done" ? <CircleCheck aria-label="Uploaded" className="size-4 shrink-0 text-success" /> : row.status === "uploading" ? <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" /> : null}
              {row.status !== "uploading" ? (
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${row.name}`} onClick={() => void remove(row)}>
                  <X aria-hidden className="size-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="bid-title">Name this bid (optional)</Label>
        <Input id="bid-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="We will use the tender's own title if you leave this blank" maxLength={200} disabled={disabled} />
      </div>

      {formError ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" data-testid="allowance-note">
          {allowance}
        </p>
        <Button onClick={() => void start()} disabled={disabled || starting || uploading || uploaded.length === 0} data-testid="start-check">
          {starting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {starting ? "Starting…" : uploading ? "Uploading…" : `Check this pack${uploaded.length > 0 ? ` (${uploaded.length} file${uploaded.length === 1 ? "" : "s"})` : ""}`}
        </Button>
      </div>
    </div>
  );
}
