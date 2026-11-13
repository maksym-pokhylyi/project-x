"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFactConfirmedAction } from "@/features/bids/actions";
import { cn } from "@/lib/utils";

/**
 * "Confirmed by you" tick on the key facts where one wrong value is fatal (deadline, how
 * to submit…). The check is the user's; the tick only records that they made it.
 */
export function FactConfirm({ bidId, field, confirmedAt, readOnly }: { bidId: string; field: string; confirmedAt: string | null; readOnly: boolean }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(Boolean(confirmedAt));
  const [pending, startTransition] = useTransition();
  if (readOnly) {
    return confirmed ? (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <Check aria-hidden className="size-3" /> Confirmed against the documents
      </span>
    ) : null;
  }
  return (
    <button
      type="button"
      aria-pressed={confirmed}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const next = !confirmed;
          setConfirmed(next);
          const result = await setFactConfirmedAction(bidId, field, next);
          if (!result.ok) setConfirmed(!next);
          else router.refresh();
        })
      }
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium transition-colors",
        confirmed ? "border-success/30 bg-success/10 text-success" : "border-dashed text-ink-2 hover:border-solid hover:text-ink",
      )}
    >
      <Check aria-hidden className={cn("size-3", confirmed ? "" : "opacity-40")} />
      {confirmed ? "Confirmed by you" : "I have checked this"}
    </button>
  );
}
