"use client";

import { Bookmark, BookmarkCheck, EyeOff, Undo2 } from "lucide-react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { clearTenderStateAction, dismissTenderAction, saveTenderAction } from "../actions";

function Submit({ children, variant = "outline", label }: { children: React.ReactNode; variant?: "outline" | "ghost" | "secondary"; label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending} aria-label={label} className="min-h-10 sm:min-h-8">
      {children}
    </Button>
  );
}

/**
 * Save / Dismiss / Start a bid for one procurement. Plain forms bound to Server Actions:
 * they work before hydration and without JavaScript.
 */
export function TenderActions({ ocid, state, canBid = true }: { ocid: string; state: "saved" | "dismissed" | null; canBid?: boolean }) {
  return (
    <>
      {state === "saved" ? (
        <form action={clearTenderStateAction}>
          <input type="hidden" name="ocid" value={ocid} />
          <Submit variant="secondary" label="Remove from saved">
            <BookmarkCheck aria-hidden className="size-4" /> Saved
          </Submit>
        </form>
      ) : (
        <form action={saveTenderAction}>
          <input type="hidden" name="ocid" value={ocid} />
          <Submit>
            <Bookmark aria-hidden className="size-4" /> Save
          </Submit>
        </form>
      )}
      {state === "dismissed" ? (
        <form action={clearTenderStateAction}>
          <input type="hidden" name="ocid" value={ocid} />
          <Submit variant="ghost">
            <Undo2 aria-hidden className="size-4" /> Restore
          </Submit>
        </form>
      ) : state === "saved" ? null : (
        <form action={dismissTenderAction}>
          <input type="hidden" name="ocid" value={ocid} />
          <Submit variant="ghost">
            <EyeOff aria-hidden className="size-4" /> Dismiss
          </Submit>
        </form>
      )}
      {canBid ? (
        <Button asChild size="sm" className="min-h-10 sm:min-h-8">
          <Link href={`/app/bids/new?notice=${encodeURIComponent(ocid)}`}>Start a bid</Link>
        </Button>
      ) : null}
    </>
  );
}
