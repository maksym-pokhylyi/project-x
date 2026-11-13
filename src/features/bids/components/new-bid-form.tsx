"use client";

import "./bid-theme.css";
import { Check, Loader2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { createBidAction, planUploadAction, registerFileAction, removeFileAction, startProcessingAction, updateBidAction } from "@/features/bids/actions";
import { ACCEPT_ATTRIBUTE, fileExtension, formatBytes, MAX_BID_BYTES, MAX_BID_FILES, MAX_FILE_BYTES, unsupportedFileReason } from "@/features/bids/constants";
import { tenderReferenceFromInput, type TenderSummary } from "@/features/bids/tender-lookup";
import { cn } from "@/lib/utils";
import { daysLeftLabel } from "./ui";
import { uploadFile } from "./upload-client";

type Row = {
  key: string;
  name: string;
  size: number;
  /** skipped = a file we do not read (a drawing or photo): listed, never uploaded, no action needed. */
  status: "queued" | "uploading" | "done" | "error" | "skipped";
  progress: number;
  error?: string;
  fileId?: string;
};

export type ExistingFile = { id: string; name: string; size: number };

/** Files that are normally drawings or photographs: not read, and nothing the bidder needs to fix. */
const NOT_READ = new Set(["png", "jpg", "jpeg", "gif", "tif", "tiff", "bmp", "heic", "dwg", "dxf", "svg"]);

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const word = (n: number, lower = false) => {
  const text = n < NUMBER_WORDS.length ? NUMBER_WORDS[n]! : String(n);
  return lower ? text.toLowerCase() : text;
};

/** Why the check cannot start yet, in plain words; null when it can. */
function notReadyReason(rows: Row[]): string | null {
  const uploading = rows.filter((row) => row.status === "uploading").length;
  const waiting = rows.filter((row) => row.status === "queued").length;
  const failed = rows.filter((row) => row.status === "error").length;
  const ready = rows.filter((row) => row.status === "done").length;
  const parts = [
    uploading > 0 ? `${word(uploading, true)} ${uploading === 1 ? "is" : "are"} uploading` : null,
    waiting > 0 ? `${word(waiting, true)} ${waiting === 1 ? "is" : "are"} waiting` : null,
    failed > 0 ? `${word(failed, true)} ${failed === 1 ? "needs" : "need"} replacing or removing` : null,
  ].filter((part): part is string => Boolean(part));
  const total = uploading + waiting + failed;
  if (total > 0) {
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0]!;
    return `${word(total)} ${total === 1 ? "file is" : "files are"} not ready: ${list}.`;
  }
  return ready === 0 ? "Add at least one file from the pack to start." : null;
}

/**
 * New bid check (design handoff: NewCheck). Step 1 says which tender this is — prefilled by
 * the Radar, pasted as a Find a Tender link, or left for the pack to tell us. Step 2 takes
 * the pack: files go straight from the browser to storage, each with its own state, and
 * the draft survives a refresh. Nothing is spent until "Start the check".
 */
export function NewBidForm({
  initialBidId,
  initialFiles,
  noticeId,
  tender,
  disabled,
  notice,
}: {
  initialBidId: string | null;
  initialFiles: ExistingFile[];
  /** Notice id or slug this check is linked to, if any. */
  noticeId: string | null;
  /** The notice as the Radar knows it; null when it is not known (then only the reference is shown). */
  tender: (Omit<TenderSummary, "closesAt"> & { closesAt: string | null }) | null;
  /** True when the workspace has no check left: the form is shown but cannot be used. */
  disabled: boolean;
  /** Shown between the two steps: the upgrade panel when there is nothing left to start a check with. */
  notice?: ReactNode;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialFiles.map((file) => ({ key: file.id, name: file.name, size: file.size, status: "done", progress: 100, fileId: file.id })));
  const [dragging, setDragging] = useState(false);
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const bidId = useRef<string | null>(initialBidId);
  const creating = useRef<Promise<string | null> | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<Row | null>(null);

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
      const live = (row: Row) => row.status !== "error" && row.status !== "skipped";
      let total = rows.filter(live).reduce((sum, row) => sum + row.size, 0);
      let count = rows.filter(live).length;
      const accepted: Array<{ row: Row; file: File }> = [];
      const added: Row[] = [];
      for (const file of files) {
        const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
        const base: Row = { key, name: file.name, size: file.size, status: "queued", progress: 0 };
        if (NOT_READ.has(fileExtension(file.name))) {
          added.push({ ...base, status: "skipped", error: "drawings and photographs are not read" });
          continue;
        }
        const reason =
          unsupportedFileReason(file.name) ??
          (file.size === 0 ? "This file is empty." : null) ??
          (file.size > MAX_FILE_BYTES ? `Larger than 50 MB (${formatBytes(file.size)}). Split it, or leave out drawings and photos.` : null) ??
          (count >= MAX_BID_FILES ? `A bid holds at most ${MAX_BID_FILES} files.` : null) ??
          (total + file.size > MAX_BID_BYTES ? "The pack would exceed 200 MB in total." : null) ??
          (rows.some((row) => row.name === file.name && row.size === file.size && live(row)) ? "Already added." : null);
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
        for (const { row } of accepted) patch(row.key, { status: "error", error: "Could not start the bid check. Try again." });
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

  const reason = notReadyReason(rows);
  const uploadedCount = rows.filter((row) => row.status === "done").length;

  const start = async () => {
    if (!bidId.current || reason) return;
    setStarting(true);
    setFormError(null);
    const result = await startProcessingAction(bidId.current);
    if (!result.ok) {
      setStarting(false);
      setFormError(result.error.message);
      if (result.error.code === "QUOTA_EXCEEDED") router.refresh();
      return;
    }
    router.push(`/app/bids/${result.data.bidId}`);
  };

  /** Links (or unlinks) the tender; the page reloads so the server can look the notice up. */
  const setTender = async (reference: string | null) => {
    setLinkError(null);
    if (bidId.current) {
      const result = await updateBidAction(bidId.current, { noticeId: reference });
      if (!result.ok) return setLinkError(result.error.message);
    }
    const url = new URL(window.location.href);
    if (reference) url.searchParams.set("tender", reference);
    else url.searchParams.delete("tender");
    url.searchParams.delete("notice");
    router.replace(`${url.pathname}${url.search}`);
    router.refresh();
  };
  const submitLink = () => {
    if (!link.trim()) return;
    const reference = tenderReferenceFromInput(link);
    if (!reference) return setLinkError("That is not a Find a Tender notice link. It looks like https://www.find-tender.service.gov.uk/Notice/012345-2026");
    setLink("");
    void setTender(reference);
  };

  const closes = tender?.closesAt ? new Date(tender.closesAt) : null;
  const left = closes ? daysLeftLabel(closes) : null;

  return (
    <div className="flex flex-col gap-10" data-testid="new-bid-form">
      {/* --- 1 · Which tender? ------------------------------------------------------------------ */}
      <section aria-labelledby="tender-h" className="flex flex-col gap-4">
        <h2 id="tender-h" className="bid-h2">
          1 · Which tender?
        </h2>
        {noticeId ? (
          <div className="bid-card flex flex-wrap items-start gap-x-8 gap-y-4 px-5 py-5 sm:px-6" data-testid="tender-card">
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
              <p className="text-[17px] leading-[1.35] font-semibold">{tender?.title ?? "Linked to a tender notice"}</p>
              <p className="text-[15px]">{tender?.buyerName ?? "The title, buyer and deadline will be read from the pack you upload."}</p>
              <p className="flex flex-wrap items-center gap-2">
                <span className="bid-pill bid-pill-info text-xs">Tender notice</span>
                <span className="bid-mono text-xs text-(--bid-muted)">{tender?.reference ?? noticeId}</span>
              </p>
            </div>
            {closes && left ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-(--bid-muted)">Closes</span>
                <span className="flex items-center gap-2 text-[17px] font-semibold tabular-nums">
                  <span aria-hidden className={cn("size-[9px] rounded-full", left.past ? "bg-(--bid-line-strong)" : left.urgent ? "bg-(--bid-danger)" : "bg-(--bid-amber)")} />
                  {new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" }).format(closes)}
                </span>
                <span className="flex items-center gap-2 text-[13px] text-(--bid-muted)">
                  {new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(closes)}
                  <span className="rounded bg-(--bid-amber-tint) px-1.5 py-px text-xs font-semibold text-(--bid-ink)">{left.label}</span>
                </span>
              </div>
            ) : null}
            <button type="button" className="bid-btn" onClick={() => void setTender(null)} disabled={disabled}>
              Change
            </button>
          </div>
        ) : null}
        <div className="flex max-w-[560px] flex-col gap-1.5">
          <label htmlFor="tender-link" className="text-[15px] font-medium">
            {noticeId ? "Or paste a Find a Tender link" : "Paste a Find a Tender link (optional)"}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="tender-link"
              className="bid-input min-w-0 flex-[1_1_260px]"
              type="url"
              inputMode="url"
              placeholder="https://www.find-tender.service.gov.uk/Notice/…"
              value={link}
              disabled={disabled}
              onChange={(event) => setLink(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitLink();
                }
              }}
              aria-describedby="tender-link-hint"
              aria-invalid={linkError ? true : undefined}
            />
            {link.trim() ? (
              <button type="button" className="bid-btn" onClick={submitLink}>
                Link this tender
              </button>
            ) : null}
          </div>
          {linkError ? (
            <p role="alert" className="text-[13px] text-(--bid-danger)">
              {linkError}
            </p>
          ) : (
            <p id="tender-link-hint" className="text-[13px] text-(--bid-muted)">
              {noticeId ? "Replaces the tender above." : "You can skip this: the title, buyer and deadline are read from the pack."}
            </p>
          )}
        </div>
      </section>

      {notice}

      {/* --- 2 · Upload the tender pack --------------------------------------------------------- */}
      <section aria-labelledby="upload-h" className="flex flex-col gap-4">
        <h2 id="upload-h" className="bid-h2">
          2 · Upload the tender pack
        </h2>
        {disabled ? <p className="text-[15px] text-(--bid-muted)">Upload opens once you have a bid to use.</p> : null}
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
            "flex flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed px-6 py-8 text-center",
            disabled ? "border-(--bid-line) bg-(--bid-paper-deep) opacity-70" : dragging ? "border-(--bid-brand) bg-(--bid-brand-tint)" : "border-(--bid-line-strong) bg-(--bid-surface)",
          )}
        >
          <Upload aria-hidden className="size-6" strokeWidth={1.6} />
          <p className="text-[17px] font-semibold">Drop the files here</p>
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
          <input
            ref={replaceInput}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              const old = replacing.current;
              event.target.value = "";
              replacing.current = null;
              if (!file || !old) return;
              setRows((current) => current.filter((entry) => entry.key !== old.key));
              void addFiles([file]);
            }}
          />
          <button type="button" className="bid-btn" disabled={disabled} onClick={() => input.current?.click()}>
            Choose files
          </button>
          <p className="max-w-[560px] text-sm text-(--bid-muted)">PDF, Word, Excel, CSV, text or ZIP, up to 50 MB a file. Send everything the buyer sent, including appendices and clarifications.</p>
        </div>

        {rows.length > 0 ? (
          <div className="bid-card" data-testid="file-list">
            <h3 className="px-5 py-4 text-[15px] font-semibold sm:px-6">
              Files <span className="font-normal text-(--bid-muted)">· {rows.length} added</span>
            </h3>
            <ul aria-label="Files">
              {rows.map((row) => (
                <li key={row.key} className="bid-rule flex flex-wrap items-center gap-x-6 gap-y-1.5 px-5 py-3 sm:px-6" data-file-status={row.status}>
                  <span className={cn("bid-mono min-w-0 flex-[1_1_240px] text-[13px] [overflow-wrap:anywhere]", row.status === "skipped" ? "text-(--bid-muted)" : "")}>{row.name}</span>
                  <span className="w-20 shrink-0 text-[13px] text-(--bid-muted) tabular-nums">{formatBytes(row.size)}</span>
                  <span className="flex min-w-0 flex-[2_1_260px] flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
                    {row.status === "done" ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-(--bid-brand)">
                        <Check aria-hidden className="size-3.5" strokeWidth={2.6} />
                        Uploaded
                      </span>
                    ) : row.status === "uploading" ? (
                      <>
                        <span className="font-semibold tabular-nums">Uploading {row.progress}%</span>
                        <span className="flex h-1 w-40 max-w-full rounded-full bg-(--bid-line)" role="progressbar" aria-valuenow={row.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${row.name}`}>
                          <span className="rounded-full bg-(--bid-ink) transition-[width]" style={{ width: `${row.progress}%` }} />
                        </span>
                      </>
                    ) : row.status === "queued" ? (
                      <span className="text-(--bid-muted)">Waiting</span>
                    ) : row.status === "skipped" ? (
                      <>
                        <span className="bid-pill bid-pill-info text-xs">No action needed</span>
                        <span>Will be skipped: {row.error}.</span>
                      </>
                    ) : (
                      <>
                        <span role="alert" className="flex min-w-0 flex-[1_1_200px] items-start gap-2 text-(--bid-danger)">
                          <span aria-hidden className="font-bold">
                            !
                          </span>
                          {row.error}
                        </span>
                        <button
                          type="button"
                          className="bid-btn bid-btn-sm"
                          onClick={() => {
                            replacing.current = row;
                            replaceInput.current?.click();
                          }}
                        >
                          Replace
                        </button>
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded text-(--bid-ink) hover:bg-(--bid-paper) disabled:opacity-40"
                    aria-label={`Remove ${row.name}`}
                    disabled={row.status === "uploading"}
                    onClick={() => void remove(row)}
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-3 border-t border-(--bid-line) pt-7">
        {formError ? (
          <p role="alert" className="rounded-lg bg-(--bid-danger-tint) px-4 py-3 text-sm text-(--bid-danger)">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <button
            type="button"
            className={cn("bid-btn px-6 text-[17px]", disabled || reason ? "border-(--bid-paper-deep) bg-(--bid-paper-deep) text-(--bid-muted)" : "bid-btn-primary")}
            style={{ minHeight: 48 }}
            onClick={() => void start()}
            disabled={disabled || starting || Boolean(reason)}
            data-testid="start-check"
            aria-describedby="start-reason"
          >
            {starting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {starting ? "Starting…" : "Start the check"}
          </button>
          <Link href="/app/bids" className="bid-link text-[15px] font-medium" data-testid="save-later">
            Save and finish later
          </Link>
        </div>
        <p id="start-reason" className="text-[15px]" data-testid="start-reason" aria-live="polite">
          {disabled ? "You have no bid checks left on your plan." : (reason ?? `${word(uploadedCount)} ${uploadedCount === 1 ? "file is" : "files are"} ready. Starting takes two to four minutes; you can leave the page.`)}
        </p>
      </div>
    </div>
  );
}
