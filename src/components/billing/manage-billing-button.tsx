"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openBillingPortalAction } from "@/server/actions/billing";

type Links = { updatePaymentMethodUrl: string | null; cancelUrl: string | null };

/**
 * Opens a fresh Paddle customer-portal session (invoices, payment method, cancellation).
 * If Paddle cannot create a portal session, shows the subscription's own
 * update-payment / cancel links instead.
 */
export function ManageBillingButton() {
  const [pending, setPending] = useState(false);
  const [fallback, setFallback] = useState<Links | null>(null);

  async function open() {
    setPending(true);
    const result = await openBillingPortalAction();
    setPending(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    if (result.data.portalUrl) {
      window.open(result.data.portalUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setFallback({ updatePaymentMethodUrl: result.data.updatePaymentMethodUrl, cancelUrl: result.data.cancelUrl });
  }

  if (fallback) {
    return (
      <div className="flex flex-wrap gap-2">
        {fallback.updatePaymentMethodUrl ? (
          <Button asChild variant="outline">
            <a href={fallback.updatePaymentMethodUrl} target="_blank" rel="noopener noreferrer">
              Update payment method <ExternalLink aria-hidden className="size-4" />
            </a>
          </Button>
        ) : null}
        {fallback.cancelUrl ? (
          <Button asChild variant="outline">
            <a href={fallback.cancelUrl} target="_blank" rel="noopener noreferrer">
              Cancel subscription <ExternalLink aria-hidden className="size-4" />
            </a>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Button variant="outline" disabled={pending} onClick={() => void open()}>
      {pending ? "Opening…" : "Manage billing"} <ExternalLink aria-hidden className="size-4" />
    </Button>
  );
}
