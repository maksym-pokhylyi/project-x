"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { replayWebhookAction, retryJobAction } from "@/server/actions/admin";

export function ReplayWebhookButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await replayWebhookAction(eventId);
        setPending(false);
        if (!result.ok) toast.error(result.error.message);
        else toast.success(`Replayed: ${result.data.outcome ?? "done"}`);
        router.refresh();
      }}
    >
      {pending ? "Replaying…" : "Replay"}
    </Button>
  );
}

export function RetryJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await retryJobAction(jobId);
        setPending(false);
        if (!result.ok) toast.error(result.error.message);
        else toast.success("Job re-queued.");
        router.refresh();
      }}
    >
      {pending ? "Retrying…" : "Retry"}
    </Button>
  );
}
