"use client";

import { FileText, Loader2, Trash2, TriangleAlert, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/features/bids/components/upload-client";
import { fileKindFromName, formatBytes, MAX_LIBRARY_FILE_BYTES, unsupportedFileReason } from "@/features/bids/constants";
import { isPastDate } from "@/features/bids/locations";
import { LIBRARY_DOC_KIND_LABELS, LIBRARY_DOC_KINDS, type LibraryDocKind } from "@/features/bids/types";
import { cn } from "@/lib/utils";
import { deleteLibraryDocAction, planLibraryUploadAction, registerLibraryDocAction, updateLibraryDocAction } from "../actions";

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
};

type UploadRow = { key: string; name: string; progress: number; error?: string };

/** Documents table of the evidence library: upload, type, summary, expiry, delete. */
export function DocsPanel({ docs }: { docs: LibraryDocItem[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const processing = docs.some((doc) => doc.status === "processing");

  // Documents are read and summarised in the background: refresh until they settle.
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [processing, router]);

  const add = async (files: File[]) => {
    setError(null);
    for (const file of files) {
      const key = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const kind = fileKindFromName(file.name);
      const reason = unsupportedFileReason(file.name) ?? (kind === "zip" ? "ZIP files cannot be added to the library. Upload the documents one by one." : null) ?? (file.size > MAX_LIBRARY_FILE_BYTES ? "Library documents must be 20 MB or smaller." : null) ?? (file.size === 0 ? "This file is empty." : null);
      if (reason) {
        setUploads((current) => [...current, { key, name: file.name, progress: 0, error: reason }]);
        continue;
      }
      setUploads((current) => [...current, { key, name: file.name, progress: 1 }]);
      try {
        const plan = await planLibraryUploadAction({ name: file.name, size: file.size });
        if (!plan.ok) throw new Error(plan.error.message);
        await uploadFile({
          file,
          target: plan.data,
          tokenUrl: "/api/library/upload-token",
          clientPayload: { scope: "library", docId: plan.data.docId, name: file.name },
          onProgress: (progress) => setUploads((current) => current.map((row) => (row.key === key ? { ...row, progress } : row))),
        });
        const registered = await registerLibraryDocAction({ docId: plan.data.docId, name: file.name });
        if (!registered.ok) throw new Error(registered.error.message);
        setUploads((current) => current.filter((row) => row.key !== key));
        router.refresh();
      } catch (caught) {
        setUploads((current) => current.map((row) => (row.key === key ? { ...row, error: caught instanceof Error ? caught.message : "The upload failed. Try again." } : row)));
      }
    }
  };

  return (
    <div className="space-y-4" data-testid="docs-panel">
      <div
        className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed bg-card px-6 py-6 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void add(Array.from(event.dataTransfer.files));
        }}
      >
        <UploadCloud aria-hidden className="size-6 text-muted-foreground" />
        <p className="text-sm">
          Drop policies, case studies, past bids, CVs and certificates here — PDF, Word, Excel or text, up to 20 MB each.
        </p>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.csv,.txt"
          className="sr-only"
          data-testid="library-file-input"
          aria-label="Add documents to the library"
          onChange={(event) => {
            void add(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          Choose files
        </Button>
      </div>

      {uploads.length > 0 ? (
        <ul className="divide-y rounded-lg border bg-card text-sm">
          {uploads.map((row) => (
            <li key={row.key} className="flex items-center gap-3 px-3 py-2">
              {row.error ? <TriangleAlert aria-hidden className="size-4 shrink-0 text-destructive" /> : <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              {row.error ? (
                <>
                  <span role="alert" className="text-xs text-destructive">
                    {row.error}
                  </span>
                  <Button variant="ghost" size="xs" onClick={() => setUploads((current) => current.filter((entry) => entry.key !== row.key))}>
                    Dismiss
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground tabular-nums">{row.progress}%</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {docs.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-8 text-center" data-testid="docs-empty">
          <h3 className="text-sm font-semibold">No documents yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Drafts quote from what is here and nothing else. Start with two or three case studies, your health and safety policy and your insurance certificates — for example “Case study: grounds maintenance for Leeds City Council, 2024”.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Document
                </th>
                <th scope="col" className="w-36 px-3 py-2 font-medium">
                  Type
                </th>
                <th scope="col" className="w-36 px-3 py-2 font-medium">
                  Valid until
                </th>
                <th scope="col" className="w-12 px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {docs.map((doc) => {
                const expired = isPastDate(doc.expiresAt);
                return (
                  <tr key={doc.id} data-testid="library-doc" data-status={doc.status} className="align-top hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <a href={`/api/library/${doc.id}/file`} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-4 hover:underline">
                            {doc.title}
                          </a>
                          <p className="text-xs text-muted-foreground">
                            {doc.fileName} · {formatBytes(doc.size)}
                          </p>
                          {doc.status === "processing" ? (
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Loader2 aria-hidden className="size-3 animate-spin" /> Reading and summarising…
                            </p>
                          ) : doc.status === "failed" ? (
                            <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                              {doc.error ?? "This file could not be read."} It is not used in drafts.
                            </p>
                          ) : (
                            <>
                              {doc.summary ? <p className="mt-1 max-w-[68ch] text-[13px] leading-5 text-muted-foreground">{doc.summary}</p> : null}
                              {doc.error ? <p className="mt-1 text-xs text-warning">{doc.error}</p> : null}
                              {doc.facts.length > 0 ? (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:underline">{doc.facts.length} key facts</summary>
                                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                                    {doc.facts.map((fact) => (
                                      <li key={fact}>{fact}</li>
                                    ))}
                                  </ul>
                                </details>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <NativeSelect
                        aria-label={`Type of ${doc.title}`}
                        className="h-8 w-full text-xs"
                        value={doc.kind}
                        disabled={pending}
                        onChange={(event) =>
                          startTransition(async () => {
                            const result = await updateLibraryDocAction(doc.id, { kind: event.target.value });
                            if (!result.ok) setError(result.error.message);
                            else router.refresh();
                          })
                        }
                      >
                        {LIBRARY_DOC_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {LIBRARY_DOC_KIND_LABELS[kind]}
                          </option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="date"
                        aria-label={`Valid until date of ${doc.title}`}
                        className={cn("h-8 w-full rounded-md border border-input bg-background px-2 text-xs", expired ? "border-destructive text-destructive" : "")}
                        defaultValue={doc.expiresAt ?? ""}
                        disabled={pending}
                        onBlur={(event) => {
                          const value = event.target.value || null;
                          if (value === doc.expiresAt) return;
                          startTransition(async () => {
                            const result = await updateLibraryDocAction(doc.id, { expiresAt: value });
                            if (!result.ok) setError(result.error.message);
                            else router.refresh();
                          });
                        }}
                      />
                      {expired ? <p className="mt-0.5 text-xs font-medium text-destructive">Expired</p> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={pending}
                        aria-label={`Delete ${doc.title}`}
                        onClick={() => {
                          if (!window.confirm(`Delete “${doc.title}” from your library? Drafts will no longer be able to use it.`)) return;
                          startTransition(async () => {
                            const result = await deleteLibraryDocAction(doc.id);
                            if (!result.ok) setError(result.error.message);
                            else router.refresh();
                          });
                        }}
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
