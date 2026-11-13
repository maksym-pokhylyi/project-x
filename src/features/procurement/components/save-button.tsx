"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setTenderStateAction } from "../actions";
import { SaveToggle } from "@/components/ui/save-toggle";

/**
 * Save / Saved for one procurement, wired to the workspace's saved list. The button turns
 * at once (optimistic) and settles on what the server stored; if the request fails it
 * turns back and a toast says why. `saved` is the real state from the server.
 */
export function SaveButton({ ocid, saved, itemLabel, className }: { ocid: string; saved: boolean; itemLabel?: string; className?: string }) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setTenderStateAction({ ocid, state: next ? "saved" : null });
      if (!result.ok) toast.error(result.error.message);
    });
  }

  return <SaveToggle pressed={optimistic} onClick={toggle} aria-busy={pending || undefined} itemLabel={itemLabel} className={className} data-testid="save-toggle" />;
}
