"use client";

import type { Paddle } from "@paddle/paddle-js";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PricingTable } from "@/components/billing/pricing-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { planRank, type BillingInterval, type PaidPlanKey, type Plan, type PlanKey } from "@/config/plans";
import { changePlanAction, startCheckoutAction } from "@/server/actions/billing";

export type BillingClientConfig = {
  /** null when NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set. */
  paddle: { environment: "sandbox" | "production"; clientToken: string } | null;
  /** Which plan/interval combinations have a Paddle price id configured. */
  availablePrices: Record<PaidPlanKey, Record<BillingInterval, boolean>>;
  /** Show developer-facing configuration hints (never in a real production deployment). */
  showSetupHints: boolean;
};

/**
 * Plan cards for the Billing page.
 *  - no live subscription  -> Paddle overlay checkout (customData comes from the server)
 *  - live subscription     -> change plan through the Paddle API (prorated immediately)
 * Paid access is granted only by the webhook; this component never marks anything as paid.
 */
export function BillingPlans({
  config,
  currentPlan,
  subscribedPlan,
  subscribedInterval,
  hasLiveSubscription,
  defaultInterval,
}: {
  config: BillingClientConfig;
  currentPlan: PlanKey;
  subscribedPlan: PlanKey | null;
  subscribedInterval: BillingInterval | null;
  hasLiveSubscription: boolean;
  defaultInterval: BillingInterval;
}) {
  const router = useRouter();
  const paddleRef = useRef<Paddle | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<{ plan: Plan; interval: BillingInterval } | null>(null);

  async function getPaddle(): Promise<Paddle | null> {
    if (paddleRef.current) return paddleRef.current;
    if (!config.paddle) return null;
    const { initializePaddle } = await import("@paddle/paddle-js");
    const instance = await initializePaddle({ environment: config.paddle.environment, token: config.paddle.clientToken });
    paddleRef.current = instance ?? null;
    return paddleRef.current;
  }

  async function checkout(plan: Plan, interval: BillingInterval) {
    setBusy(`${plan.key}:${interval}`);
    try {
      const result = await startCheckoutAction({ plan: plan.key, interval });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const paddle = await getPaddle();
      if (!paddle) {
        toast.error("The checkout could not be loaded. Disable ad blockers for this page and try again.");
        return;
      }
      paddle.Checkout.open({
        items: [{ priceId: result.data.priceId, quantity: 1 }],
        customer: { email: result.data.customerEmail },
        customData: result.data.customData,
        settings: {
          displayMode: "overlay",
          allowLogout: false,
          successUrl: `${window.location.origin}/app/settings/billing/success`,
        },
      });
    } finally {
      setBusy(null);
    }
  }

  async function confirmChange() {
    if (!pendingChange) return;
    const { plan, interval } = pendingChange;
    setBusy(`${plan.key}:${interval}`);
    const result = await changePlanAction({ plan: plan.key, interval });
    setBusy(null);
    setPendingChange(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Switching to ${plan.name}. This page updates as soon as Paddle confirms the change.`);
    // The webhook usually lands within a couple of seconds.
    window.setTimeout(() => router.refresh(), 3000);
  }

  function renderAction(plan: Plan, interval: BillingInterval) {
    if (plan.key === "free") {
      return (
        <p className="flex min-h-11 items-center text-13 text-ink-2">
          {hasLiveSubscription ? "Cancel your subscription under “Manage billing” to return to Free." : "Included with every workspace."}
        </p>
      );
    }
    const isSubscribedPrice = hasLiveSubscription && subscribedPlan === plan.key && subscribedInterval === interval;
    if (isSubscribedPrice) {
      return (
        <Button className="w-full" variant="outline" disabled>
          Current plan
        </Button>
      );
    }
    const configured = Boolean(config.paddle) && config.availablePrices[plan.key as PaidPlanKey]?.[interval];
    if (!configured) {
      return (
        <div className="space-y-1.5" data-testid="billing-not-configured">
          <Button className="w-full" variant="outline" disabled>
            Billing not configured
          </Button>
          {config.showSetupHints ? (
            <p className="text-xs text-ink-2">
              Set <code>NEXT_PUBLIC_PADDLE_CLIENT_TOKEN</code> and the <code>PADDLE_PRICE_*</code> variables (run{" "}
              <code>pnpm paddle:setup</code>).
            </p>
          ) : null}
        </div>
      );
    }
    const key = `${plan.key}:${interval}`;
    if (!hasLiveSubscription) {
      return (
        <Button className="w-full" variant={plan.recommended ? "default" : "outline"} disabled={busy !== null} onClick={() => void checkout(plan, interval)}>
          {busy === key ? "Opening checkout…" : `Upgrade to ${plan.name}`}
        </Button>
      );
    }
    const verb = subscribedPlan && planRank(plan.key) < planRank(subscribedPlan) ? "Downgrade" : subscribedPlan === plan.key ? "Switch" : "Upgrade";
    return (
      <Button className="w-full" variant="outline" disabled={busy !== null} onClick={() => setPendingChange({ plan, interval })}>
        {busy === key ? "Updating…" : `${verb} to ${plan.name}${subscribedPlan === plan.key ? (interval === "year" ? " annual" : " monthly") : ""}`}
      </Button>
    );
  }

  return (
    <>
      <PricingTable renderAction={renderAction} currentPlan={currentPlan} defaultInterval={defaultInterval} layout="compact" highlightRecommended={false} />
      <Dialog open={pendingChange !== null} onOpenChange={(open) => (open ? undefined : setPendingChange(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change to {pendingChange?.plan.name}?</DialogTitle>
            <DialogDescription>
              Your subscription switches to {pendingChange?.plan.name} ({pendingChange?.interval === "year" ? "annual" : "monthly"}) right away.
              The price difference for the current period is charged or credited pro rata by Paddle.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingChange(null)}>
              Keep current plan
            </Button>
            <Button disabled={busy !== null} onClick={() => void confirmChange()}>
              Confirm change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
