"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteBidAction, setBidArchivedAction, unlockFullBidAction } from "@/features/bids/actions";

/** Archive / restore / delete controls in the bid header. */
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
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        {status === "archived" ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setBidArchivedAction(bidId, false))}>
            <ArchiveRestore aria-hidden className="size-3.5" />
            Restore
          </Button>
        ) : status === "ready" || status === "failed" ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setBidArchivedAction(bidId, true))}>
            <Archive aria-hidden className="size-3.5" />
            Archive
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Delete this bid, its files and all answers? This cannot be undone.")) run(() => deleteBidAction(bidId), () => router.push("/app/bids"));
          }}
        >
          <Trash2 aria-hidden className="size-3.5" />
          Delete
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** "Unlock drafting on this bid" with a plan allowance or a Bid Pass. */
export function UnlockButton({ bidId, label }: { bidId: string; label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
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
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
