"use client";

import "@/features/bids/components/bid-theme.css";
import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { UPLOAD_FAILED_MESSAGE, UploadError, uploadFile } from "@/features/bids/components/upload-client";
import { fileKindFromName, MAX_LIBRARY_FILE_BYTES, unsupportedFileReason } from "@/features/bids/constants";
import { LIBRARY_DOC_KIND_LABELS, LIBRARY_DOC_KINDS, type LibraryDocKind } from "@/features/bids/types";
import { cn } from "@/lib/utils";
import { deleteLibraryDocAction, planLibraryUploadAction, registerLibraryDocAction, updateLibraryDocAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/forms/native-select";
import { FileInput } from "@/features/bids/components/ui/file-input";

export type LibraryDocItem = {
  id: string;
  title: string;
  fileName: string;
  kind: LibraryDocKind;
  size: number;
  status: "processing" | "ready" | "failed";
  error: string | null;
  summary: string | null;
  facts: string[];
  expiresAt: string | null;
  createdAt: string;
  /** Bids with an answer that cites this document. */
  usedIn: number;
};

type UploadRow = { key: string; name: string; /** null: uploading without progress events */ progress: number | null; error?: string; /** kept for "Try again" */ file?: File; replace?: LibraryDocItem | null };

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Documents table (design handoff: Documents): search, upload, and per document its type,
 * when it was uploaded, how many bids use it, Replace and Remove. Certificates carry their
 * expiry. Documents are read and summarised in the background.
 */
export function DocsPanel({ docs, now }: { docs: LibraryDocItem[]; now: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<LibraryDocItem | null>(null);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const processing = docs.some((doc) => doc.status === "processing");

  // Documents are read and summarised in the background: refresh until they settle.
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [processing, router]);

  const add = async (files: File[], replace?: LibraryDocItem): Promise<void> => {
    setError(null);
    for (const file of files) {
      const key = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const kind = fileKindFromName(file.name);
      const reason =
        unsupportedFileReason(file.name) ??
        (kind === "zip" ? "ZIP files cannot be added here. Upload the documents one by one." : null) ??
        (file.size > MAX_LIBRARY_FILE_BYTES ? "Documents must be 20 MB or smaller." : null) ??
        (file.size === 0 ? "This file is empty." : null);
      if (reason) {
        setUploads((current) => [...current, { key, name: file.name, progress: 0, error: reason }]);
        continue;
      }
      setUploads((current) => [...current, { key, name: file.name, progress: 1 }]);
      try {
        const plan = await planLibraryUploadAction({ name: file.name, size: file.size });
        if (!plan.ok) throw new UploadError(plan.error.message, false);
        await uploadFile({
          file,
          target: plan.data,
          tokenUrl: "/api/library/upload-token",
          clientPayload: { scope: "library", docId: plan.data.docId, name: file.name },
          onProgress: (progress) => setUploads((current) => current.map((row) => (row.key === key ? { ...row, progress } : row))),
        });
        const registered = await registerLibraryDocAction({ docId: plan.data.docId, name: file.name, ...(replace ? { kind: replace.kind } : {}) });
        if (!registered.ok) throw new UploadError(registered.error.message, false);
        // The old file goes only once its replacement is safely in.
        if (replace) await deleteLibraryDocAction(replace.id);
        setUploads((current) => current.filter((row) => row.key !== key));
        router.refresh();
      } catch (caught) {
        // Never left "uploading": a connection failure keeps the file at hand so the row can be tried again.
        const retryable = caught instanceof UploadError ? caught.retryable : true;
        const message = caught instanceof UploadError ? caught.message : UPLOAD_FAILED_MESSAGE;
        setUploads((current) => current.map((row) => (row.key === key ? { ...row, error: message, ...(retryable ? { file, replace: replace ?? null } : {}) } : row)));
      }
    }
  };

  const act = (work: () => Promise<{ ok: boolean; error?: { message: string } }>) =>
    startTransition(async () => {
      setError(null);
      const result = await work();
      if (!result.ok) setError(result.error?.message ?? "Something went wrong.");
      router.refresh();
    });

  const needle = query.trim().toLowerCase();
  const shown = needle ? docs.filter((doc) => `${doc.fileName} ${doc.title} ${LIBRARY_DOC_KIND_LABELS[doc.kind]}`.toLowerCase().includes(needle)) : docs;

  return (
    <div className="rounded-card border border-line bg-surface" data-testid="docs-panel" id="documents">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
          <label htmlFor="doc-search" className="text-15 font-medium">
            Search documents
          </label>
          <Input id="doc-search" className="max-w-[360px]" type="search" placeholder="File name or type" value={query} onChange={(event) => setQuery(event.target.value)}/>
        </div>
        <FileInput
          ref={input}
          multiple
          accept=".pdf,.docx,.xlsx,.csv,.txt"
          className="sr-only"
          data-testid="library-file-input"
          aria-label="Upload documents"
          onChange={(event) => {
            void add(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <FileInput
          ref={replaceInput}
          accept=".pdf,.docx,.xlsx,.csv,.txt"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            const old = replacing.current;
            event.target.value = "";
            replacing.current = null;
            if (file && old) void add([file], old);
          }}
        />
        <Button type="button"  onClick={() => input.current?.click()}>
          <Upload aria-hidden className="size-4" />
          Upload documents
        </Button>
      </div>

      {uploads.length > 0 ? (
        <ul className="border-t border-line text-sm">
          {uploads.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-5 py-2.5 last:border-b-0 sm:px-6">
              <span className="font-mono min-w-0 flex-[1_1_220px] text-13 [overflow-wrap:anywhere]">{row.name}</span>
              {row.error ? (
                <>
                  <span role="alert" className="flex-[2_1_240px] text-13 text-danger">
                    {row.error}
                  </span>
                  {row.file ? (
                    <Button variant="link"
                      type="button"
                      className="text-13"
                      data-testid="retry-upload"
                      onClick={() => {
                        const { file, replace } = row;
                        setUploads((current) => current.filter((item) => item.key !== row.key));
                        if (file) void add([file], replace ?? undefined);
                      }}
>
                      Try again
                    </Button>
                  ) : null}
                  <Button variant="link" type="button" className="text-13" onClick={() => setUploads((current) => current.filter((item) => item.key !== row.key))}>
                    Dismiss
                  </Button>
                </>
              ) : (
                <span className="inline-flex items-center gap-2 text-13 font-semibold tabular-nums">
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                  {row.progress === null ? "Uploading…" : `Uploading ${row.progress}%`}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="border-t border-line bg-danger-tint px-5 py-2.5 text-sm text-danger sm:px-6">
          {error}
        </p>
      ) : null}

      {docs.length === 0 ? (
        <div className="border-t border-line px-5 py-10 text-center sm:px-6" data-testid="docs-empty">
          <p className="text-17 font-semibold">No documents yet</p>
          <p className="mx-auto mt-1 max-w-[520px] text-sm text-ink-2">Upload your policies, case studies, certificates, accounts and past bids. Drafts are written only from what is here, and each claim is marked with the document it came from.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-2">
                <th scope="col" className="border-b border-line py-3 pr-3 pl-6 font-semibold">Document</th>
                <th scope="col" className="border-b border-line p-3 font-semibold">Type</th>
                <th scope="col" className="border-b border-line p-3 font-semibold">Uploaded</th>
                <th scope="col" className="border-b border-line p-3 font-semibold">Used in</th>
                <th scope="col" className="border-b border-line py-3 pr-6 pl-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((doc, index) => {
                const cell = cn("py-3.5 align-top", index < shown.length - 1 ? "border-b border-line" : "");
                const expired = doc.expiresAt ? new Date(`${doc.expiresAt}T23:59:59Z`).getTime() < now : false;
                return (
                  <tr key={doc.id} data-testid="library-doc" data-status={doc.status}>
                    <td className={cn(cell, "max-w-[420px] pr-3 pl-6")}>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <a href={`/api/library/${doc.id}/file`} target="_blank" rel="noopener noreferrer" className="font-mono link text-13 [overflow-wrap:anywhere]">
                          {doc.fileName}
                        </a>
                        {doc.expiresAt ? (
                          <span className={cn("rounded px-1.5 py-px text-xs font-semibold", expired ? "bg-danger-tint text-danger" : "bg-accent-tint text-accent-ink")}>
                            {expired ? "expired" : "expires"} {shortDate(`${doc.expiresAt}T12:00:00Z`)}
                          </span>
                        ) : null}
                      </span>
                      {doc.status === "processing" ? (
                        <span className="mt-1 flex items-center gap-1.5 text-13 text-ink-2">
                          <Loader2 aria-hidden className="size-3.5 animate-spin" />
                          Being read…
                        </span>
                      ) : doc.status === "failed" ? (
                        <span role="alert" className="mt-1 block text-13 text-danger">
                          Not readable: {doc.error ?? "this file could not be read."} Drafts cannot use it.
                        </span>
                      ) : (
                        <details className="mt-1 text-13">
                          <summary className="link inline-flex min-h-8 cursor-pointer items-center text-ink-2">What it says, and its dates</summary>
                          {doc.summary ? <p className="mt-1">{doc.summary}</p> : null}
                          {doc.error ? <p className="mt-1 text-accent-ink">{doc.error}</p> : null}
                          {doc.facts.length > 0 ? (
                            <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5">
                              {doc.facts.slice(0, 6).map((fact) => (
                                <li key={fact}>{fact}</li>
                              ))}
                            </ul>
                          ) : null}
                          <label className="mt-2 flex flex-wrap items-center gap-2">
                            Valid until
                            <Input
                              type="date"
                              className="w-auto"
                              defaultValue={doc.expiresAt ?? ""}
                              disabled={pending}
                              onChange={(event) => {
                                const value = event.target.value;
                                if (value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value)) act(() => updateLibraryDocAction(doc.id, { expiresAt: value || null }));
                              }}
/>
                          </label>
                        </details>
                      )}
                    </td>
                    <td className={cn(cell, "px-3")}>
                      <label className="sr-only" htmlFor={`kind-${doc.id}`}>
                        Type of {doc.fileName}
                      </label>
                      <NativeSelect id={`kind-${doc.id}`} className="w-auto min-w-[9rem] py-1.5" value={doc.kind} disabled={pending} onChange={(event) => act(() => updateLibraryDocAction(doc.id, { kind: event.target.value }))}>
                        {LIBRARY_DOC_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {LIBRARY_DOC_KIND_LABELS[kind]}
                          </option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className={cn(cell, "px-3 whitespace-nowrap tabular-nums")}>{shortDate(doc.createdAt)}</td>
                    <td className={cn(cell, "px-3 whitespace-nowrap tabular-nums", doc.usedIn === 0 ? "text-ink-2" : "")}>{doc.usedIn === 0 ? "Not yet" : `${doc.usedIn} bid${doc.usedIn === 1 ? "" : "s"}`}</td>
                    <td className={cn(cell, "pr-6 pl-3 text-right whitespace-nowrap")}>
                      <Button variant="link"
                        type="button"
                        className="mr-5 text-sm"
                        disabled={pending}
                        onClick={() => {
                          replacing.current = doc;
                          replaceInput.current?.click();
                        }}
>
                        Replace
                      </Button>
                      <Button variant="link"
                        type="button"
                        className="text-sm"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm(`Remove “${doc.fileName}”? Drafts will no longer be able to use it.`)) act(() => deleteLibraryDocAction(doc.id));
                        }}
>
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-ink-2">
                    No document matches “{query.trim()}”.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
