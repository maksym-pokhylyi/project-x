"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFactConfirmedAction } from "@/features/bids/actions";
import { FactTick } from "./ui/fact-tick";

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
    <FactTick
      confirmed={confirmed}
      pending={pending}
      onToggle={() =>
        startTransition(async () => {
          const next = !confirmed;
          setConfirmed(next);
          const result = await setFactConfirmedAction(bidId, field, next);
          if (!result.ok) setConfirmed(!next);
          else router.refresh();
        })
      }
    />
  );
}
