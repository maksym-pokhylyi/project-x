"use client";

import { useRouter } from "next/navigation";
import { useState, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { openBillingPortalAction } from "@/server/actions/billing";
import type { ActionResult } from "@/server/http";

/**
 * One step of managing a subscription, as a server action the page passes to a card:
 * pause, cancel, resume, update the card. It takes no arguments (the workspace comes from
 * the session) and returns the usual ActionResult. If its data carries a `url`, that
 * address is opened (a hosted Paddle page); otherwise the page is refreshed.
 */
export type BillingStep = () => Promise<ActionResult<unknown>>;

/** Where in the Paddle customer portal a fallback button lands. */
export type PortalPlace = "overview" | "cancel" | "payment_method";

const urlFrom = (data: unknown): string | null => {
  if (!data || typeof data !== "object" || !("url" in data)) return null;
  const { url } = data as { url: unknown };
  return typeof url === "string" && url ? url : null;
};

/**
 * A button on a billing card. Give it the server action for the step (`action`), or the
 * place in the Paddle customer portal to open while there is no such action (`portal`).
 * `confirm` adds the second click of "two clicks": a dialog that says what will happen.
 */
export function BillingStepButton({
  action,
  portal,
  confirm,
  done,
  variant = "outline",
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "loading" | "asChild"> & {
  action?: BillingStep;
  portal?: PortalPlace;
  confirm?: { title: string; description: string; confirmLabel: string };
  /** Said in a toast when the step succeeded. */
  done?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function run() {
    setPending(true);
    try {
      if (action) {
        const result = await action();
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        const url = urlFrom(result.data);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        else if (done) toast.success(done);
        router.refresh();
        return;
      }
      const result = await openBillingPortalAction();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const { portalUrl, cancelUrl, updatePaymentMethodUrl } = result.data;
      const url = portal === "cancel" ? (cancelUrl ?? portalUrl) : portal === "payment_method" ? (updatePaymentMethodUrl ?? portalUrl) : (portalUrl ?? updatePaymentMethodUrl ?? cancelUrl);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast.error("Paddle could not open billing just now. Use the link in your Paddle receipt, or try again.");
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  if (!action && !portal) return null;

  return (
    <>
      <Button variant={variant} loading={pending && !confirming} onClick={() => (confirm ? setConfirming(true) : void run())} {...props}>
        {children}
      </Button>
      {confirm ? (
        <Dialog open={confirming} onOpenChange={(open) => (pending ? undefined : setConfirming(open))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirm.title}</DialogTitle>
              <DialogDescription>{confirm.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
                Keep it as it is
              </Button>
              <Button loading={pending} onClick={() => void run()}>
                {confirm.confirmLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
