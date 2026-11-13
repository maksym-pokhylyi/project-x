"use client";

import "./bid-theme.css";
import { Archive, ArchiveRestore, ChevronDown, Download, Lock, MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { useState, useTransition } from "react";
import { deleteBidAction, setBidArchivedAction, unlockFullBidAction } from "@/features/bids/actions";

/** "Export to Word": the downloads of one bid, as a menu next to the title. */
export function ExportMenu({ bidId, canExportAnswers, answersReady }: { bidId: string; canExportAnswers: boolean; answersReady: number }) {
  const base = `/api/bids/${bidId}/export`;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="bid-btn" data-testid="export-menu">
          <Download aria-hidden className="size-4" />
          Export to Word
          <ChevronDown aria-hidden className="size-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionPadding={12} className="bid-pop z-50 w-[min(21rem,calc(100vw-1.5rem))] p-1.5 outline-none">
          <a href={`${base}/brief`} className="bid-menu-item" data-testid="export-brief" download>
            Bid check (Word)
            <span className="text-xs font-normal text-(--bid-muted)">Verdict, key facts, requirements and questions, with sources</span>
          </a>
          <a href={`${base}/requirements-docx`} className="bid-menu-item" data-testid="export-requirements-docx" download>
            Requirements checklist (Word)
          </a>
          <a href={`${base}/requirements-csv`} className="bid-menu-item" data-testid="export-requirements-csv" download>
            Requirements checklist (CSV, for Excel)
          </a>
          {canExportAnswers ? (
            <a href={`${base}/answers`} className="bid-menu-item" data-testid="export-answers" download>
              Answers (Word)
              <span className="text-xs font-normal text-(--bid-muted)">
                {answersReady === 0 ? "No answers written yet" : `${answersReady} answer${answersReady === 1 ? "" : "s"} so far, with word counts and open gaps`}
              </span>
            </a>
          ) : (
            <span className="bid-menu-item" aria-disabled="true">
              <span className="inline-flex items-center gap-1.5">
                <Lock aria-hidden className="size-3.5" />
                Answers (Word)
              </span>
              <span className="text-xs font-normal">Needs a Bid Desk plan or a Bid Pass</span>
            </span>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Archive / restore / delete, tucked behind "More" in the bid header. */
export function BidActions({ bidId, status }: { bidId: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (work: () => Promise<{ ok: boolean; error?: { message: string } }>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await work();
      if (!result.ok) setError(result.error?.message ?? "Something went wrong.");
      else if (after) after();
      else router.refresh();
    });
  if (status === "processing") return null;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="bid-btn bid-btn-quiet px-3" aria-label="More actions for this bid" data-testid="bid-more">
          <MoreHorizontal aria-hidden className="size-5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionPadding={12} className="bid-pop z-50 w-64 p-1.5 outline-none">
          {status === "archived" ? (
            <button type="button" className="bid-menu-item" disabled={pending} onClick={() => run(() => setBidArchivedAction(bidId, false))}>
              <span className="inline-flex items-center gap-2">
                <ArchiveRestore aria-hidden className="size-4" />
                Restore this bid
              </span>
            </button>
          ) : status === "ready" || status === "failed" ? (
            <button type="button" className="bid-menu-item" disabled={pending} onClick={() => run(() => setBidArchivedAction(bidId, true))}>
              <span className="inline-flex items-center gap-2">
                <Archive aria-hidden className="size-4" />
                Archive (read-only)
              </span>
            </button>
          ) : null}
          <button
            type="button"
            className="bid-menu-item text-(--bid-danger)"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Delete this bid, its files and all answers? This cannot be undone.")) run(() => deleteBidAction(bidId), () => router.push("/app/bids"));
            }}
          >
            <span className="inline-flex items-center gap-2 text-(--bid-danger)">
              <Trash2 aria-hidden className="size-4" />
              Delete this bid
            </span>
          </button>
          {error ? (
            <p role="alert" className="px-3 py-2 text-xs text-(--bid-danger)">
              {error}
            </p>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** "Unlock drafting on this bid" with a plan allowance or a Bid Pass. */
export function UnlockButton({ bidId, label }: { bidId: string; label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className="bid-btn bid-btn-sm"
        disabled={pending}
        data-testid="unlock-full-bid"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await unlockFullBidAction(bidId);
            if (!result.ok) setError(result.error.message);
            else router.refresh();
          })
        }
      >
        {pending ? "Unlocking…" : label}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-(--bid-danger)">
          {error}
        </span>
      ) : null}
    </span>
  );
}
