"use client";

import "./bid-theme.css";
import { Archive, ArchiveRestore, ChevronDown, Download, Lock, MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteBidAction, setBidArchivedAction, unlockFullBidAction } from "@/features/bids/actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** "Export to Word": the downloads of one bid, as a menu next to the title. */
export function ExportMenu({ bidId, canExportAnswers, answersReady, label = "Export to Word" }: { bidId: string; canExportAnswers: boolean; answersReady: number; label?: string }) {
  const base = `/api/bids/${bidId}/export`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" type="button" data-testid="export-menu">
          <Download aria-hidden className="size-4" />
          {label}
          <ChevronDown aria-hidden className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(21rem,calc(100vw-1.5rem))]">
        <DropdownMenuItem asChild className="flex-col items-start gap-0.5">
          <a href={`${base}/brief`} data-testid="export-brief" download>
            Bid check (Word)
            <span className="text-xs text-ink-2">Verdict, key facts, requirements and questions, with sources</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}/requirements-docx`} data-testid="export-requirements-docx" download>
            Requirements checklist (Word)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}/requirements-csv`} data-testid="export-requirements-csv" download>
            Requirements checklist (CSV, for Excel)
          </a>
        </DropdownMenuItem>
        {canExportAnswers ? (
          <DropdownMenuItem asChild className="flex-col items-start gap-0.5">
            <a href={`${base}/answers`} data-testid="export-answers" download>
              Answers (Word)
              <span className="text-xs text-ink-2">{answersReady === 0 ? "No answers written yet" : `${answersReady} answer${answersReady === 1 ? "" : "s"} so far, with word counts and open gaps`}</span>
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled className="flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1.5">
              <Lock aria-hidden className="size-3.5" />
              Answers (Word)
            </span>
            <span className="text-xs">Needs a Bid Desk plan or a Bid Pass</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" type="button" aria-label="More actions for this bid" data-testid="bid-more">
            <MoreHorizontal aria-hidden className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {status === "archived" ? (
            <DropdownMenuItem disabled={pending} onSelect={() => run(() => setBidArchivedAction(bidId, false))}>
              <ArchiveRestore aria-hidden className="size-4" />
              Restore this bid
            </DropdownMenuItem>
          ) : status === "ready" || status === "failed" ? (
            <DropdownMenuItem disabled={pending} onSelect={() => run(() => setBidArchivedAction(bidId, true))}>
              <Archive aria-hidden className="size-4" />
              Archive (read-only)
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onSelect={() => {
              if (window.confirm("Delete this bid, its files and all answers? This cannot be undone.")) run(() => deleteBidAction(bidId), () => router.push("/app/bids"));
            }}
          >
            <Trash2 aria-hidden className="size-4" />
            Delete this bid
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <p role="alert" className="basis-full text-xs text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** "Unlock drafting on this bid" with a plan allowance or a Bid Pass. */
export function UnlockButton({ bidId, label }: { bidId: string; label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant="outline" size="sm"
        type="button"
        
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
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
