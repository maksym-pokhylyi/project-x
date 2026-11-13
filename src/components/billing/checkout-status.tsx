"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Status = { isPaid: boolean; planKey: string };

const POLL_MS = 2000;
const MAX_ATTEMPTS = 45; // ~90 seconds

/**
 * Shown after Paddle redirects back from checkout. It does NOT trust that redirect:
 * it polls /api/billing/status until the webhook has activated the plan in our database.
 */
export function CheckoutStatus({ planNames }: { planNames: Record<string, string> }) {
  const router = useRouter();
  const [state, setState] = useState<"waiting" | "active" | "timeout">("waiting");
  const [planKey, setPlanKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    async function poll() {
      attempts += 1;
      try {
        const response = await fetch("/api/billing/status", { cache: "no-store" });
        if (response.ok) {
          const status = (await response.json()) as Status;
          if (!cancelled && status.isPaid) {
            setPlanKey(status.planKey);
            setState("active");
            router.refresh();
            return;
          }
        }
      } catch {
        // transient network error: keep polling
      }
      if (cancelled) return;
      if (attempts >= MAX_ATTEMPTS) setState("timeout");
      else timer = window.setTimeout(poll, POLL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [router]);

  if (state === "active") {
    return (
      <div className="flex flex-col items-center gap-3 text-center" role="status">
        <CheckCircle2 aria-hidden className="size-10 text-success" />
        <h1 className="type-h2 text-ink">You are on the {planKey ? (planNames[planKey] ?? planKey) : "new"} plan</h1>
        <p className="max-w-sm text-sm text-ink-2">Your workspace has been upgraded. Paddle is sending your receipt by e-mail.</p>
        <Button asChild>
          <Link href="/app">Continue</Link>
        </Button>
      </div>
    );
  }

  if (state === "timeout") {
    return (
      <div className="flex flex-col items-center gap-3 text-center" role="status">
        <h1 className="type-h2 text-ink">Still confirming your payment</h1>
        <p className="max-w-sm text-sm text-ink-2">
          This is taking longer than usual. You do not need to pay again: your plan will update automatically as soon as
          the payment is confirmed. If it has not updated in a few minutes, contact support.
        </p>
        <Button asChild variant="outline">
          <Link href="/app/settings/billing">Back to billing</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center" role="status" aria-live="polite">
      <Loader2 aria-hidden className="size-8 animate-spin text-ink-2" />
      <h1 className="type-h2 text-ink">Confirming your payment…</h1>
      <p className="max-w-sm text-sm text-ink-2">This usually takes a few seconds. Please keep this page open.</p>
    </div>
  );
}
