"use client";

import type { Paddle } from "@paddle/paddle-js";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { billingCopy } from "@/config/billing-copy";
import { BID_PASS_DISPLAY, inWords, planDisplay } from "@/config/plan-display";
import { planRank, type BillingInterval, type PaidPlanKey, type PlanKey } from "@/config/plans";
import { changePlanAction, startCheckoutAction, type CheckoutParams } from "@/server/actions/billing";
import type { ActionResult } from "@/server/http";

export type BillingClientConfig = {
  /** null when NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set (or sandbox billing is not allowed on this deployment). */
  paddle: { environment: "sandbox" | "production"; clientToken: string } | null;
  /** Which plan/interval combinations have a Paddle price id configured. */
  availablePrices: Record<PaidPlanKey, Record<BillingInterval, boolean>>;
  /** The Bid Pass has a Paddle price id configured. */
  bidPassAvailable: boolean;
  /** Show developer-facing configuration hints (never in a real production deployment). */
  showSetupHints: boolean;
};

/** What the visitor came to do: the hand-off from /pricing, an upgrade panel or a card on this page. */
export type BillingIntent = { kind: "plan"; plan: PaidPlanKey; interval: BillingInterval } | { kind: "bid_pass" };

export type ConfirmPanelProps = {
  intent: BillingIntent;
  config: BillingClientConfig;
  /** The live subscription (active, trialing or past due), if the workspace has one. */
  subscribed: { plan: PlanKey; interval: BillingInterval | null } | null;
  /** A paused subscription exists: a new one cannot be started beside it. */
  paused: boolean;
  /** The workspace has never subscribed, so a plan with a trial starts with it. */
  trialEligible: boolean;
  /** Prepares a Bid Pass checkout (price id, customer, signed custom data). Not built yet: without it the panel says so. */
  startBidPassCheckout?: () => Promise<ActionResult<CheckoutParams>>;
  /** What a downgrade costs or returns, from the billing backend. */
  downgradeNote?: string;
  /** Why the plan cannot be changed right now (during a trial, or while a pause or cancellation is scheduled). */
  changeBlocked?: string | null;
};

const INTERVALS = [
  { value: "month", label: "Monthly" },
  { value: "year", label: "Annual" },
] as const;

const BILLING_PATH = "/app/settings/billing";

/**
 * The confirm step of Billing: the one place where a plan is bought or changed and a Bid
 * Pass is bought. It opens over the Billing page when the address carries the hand-off
 * (?plan=…&interval=… or ?buy=bid_pass): what you are getting, what it costs, what happens
 * next in one sentence, and ONE button. Closing it returns to the plain Billing page.
 *
 *  - no subscription  -> "Continue to payment": Paddle overlay checkout (custom data signed by the server)
 *  - live subscription -> "Confirm change": the plan changes through the Paddle API, prorated
 * Paid access is granted only by the webhook; nothing here marks anything as paid.
 */
export function ConfirmPanel({ intent, config, subscribed, paused, trialEligible, startBidPassCheckout, downgradeNote, changeBlocked }: ConfirmPanelProps) {
  const router = useRouter();
  const paddleRef = useRef<Paddle | null>(null);
  const [open, setOpen] = useState(true);
  const [interval, setInterval] = useState<BillingInterval>(intent.kind === "plan" ? intent.interval : "month");
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    router.replace(BILLING_PATH, { scroll: false });
  }

  async function getPaddle(): Promise<Paddle | null> {
    if (paddleRef.current) return paddleRef.current;
    if (!config.paddle) return null;
    const { initializePaddle } = await import("@paddle/paddle-js");
    const instance = await initializePaddle({ environment: config.paddle.environment, token: config.paddle.clientToken });
    paddleRef.current = instance ?? null;
    return paddleRef.current;
  }

  async function openCheckout(prepare: () => Promise<ActionResult<CheckoutParams>>, successKind: "plan" | "pass") {
    setBusy(true);
    try {
      const result = await prepare();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const paddle = await getPaddle();
      if (!paddle) {
        toast.error("The checkout could not be loaded. Disable ad blockers for this page and try again.");
        return;
      }
      // The overlay takes over from here; the panel has done its job.
      setOpen(false);
      paddle.Checkout.open({
        items: [{ priceId: result.data.priceId, quantity: 1 }],
        customer: { email: result.data.customerEmail },
        customData: result.data.customData,
        settings: {
          displayMode: "overlay",
          allowLogout: false,
          successUrl: `${window.location.origin}${BILLING_PATH}/success${successKind === "pass" ? "?bought=bid_pass" : ""}`,
        },
      });
    } finally {
      setBusy(false);
    }
  }

  async function changePlan(plan: PaidPlanKey, name: string) {
    setBusy(true);
    const result = await changePlanAction({ plan, interval });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Changing to ${name}. This page updates as soon as Paddle confirms the change.`);
    close();
    // The webhook usually lands within a couple of seconds.
    window.setTimeout(() => router.refresh(), 3000);
  }

  /* ---- what the panel says ------------------------------------------------------------ */

  let title: string;
  let priceLine: string;
  let sentence: string;
  let blocked: string | null = null;
  let primary: { label: string; run: () => void } | null = null;
  let showToggle = false;

  if (intent.kind === "bid_pass") {
    title = `Buy a ${BID_PASS_DISPLAY.name}`;
    priceLine = `${BID_PASS_DISPLAY.price} ${BID_PASS_DISPLAY.period}`;
    sentence = `One full bid for ${BID_PASS_DISPLAY.price}. ${billingCopy.bidPassExpiryIt}`;
    if (!config.paddle || !config.bidPassAvailable || !startBidPassCheckout) blocked = "Payments are not open yet.";
    else primary = { label: "Continue to payment", run: () => void openCheckout(startBidPassCheckout, "pass") };
  } else {
    const plan = planDisplay(intent.plan);
    const price = interval === "year" ? plan.annual : plan.monthly;
    showToggle = true;
    priceLine = price.line;
    const configured = Boolean(config.paddle) && config.availablePrices[intent.plan]?.[interval];
    const samePlan = subscribed?.plan === intent.plan;
    if (subscribed && samePlan && subscribed.interval === interval) {
      title = `You are on ${plan.name}`;
      sentence = `This workspace is already on ${plan.name}, billed ${interval === "year" ? "annually" : "monthly"}.`;
      blocked = "Nothing to change.";
    } else if (subscribed) {
      const down = planRank(intent.plan) < planRank(subscribed.plan) || (samePlan && interval === "month");
      title = samePlan ? `Switch ${plan.name} to ${interval === "year" ? "annual" : "monthly"} billing` : `Change to ${plan.name}`;
      sentence = down ? (downgradeNote ?? "Your plan changes now. Paddle credits what is left of your current billing period.") : billingCopy.upgrade;
      if (!configured) blocked = "Payments are not open yet.";
      else if (changeBlocked) blocked = changeBlocked;
      else primary = { label: "Confirm change", run: () => void changePlan(intent.plan, plan.name) };
    } else {
      title = `Start ${plan.name}`;
      const trial = trialEligible && plan.trialDays ? plan.trialDays : null;
      sentence = trial
        ? `${trial}-day trial${plan.trialFullBids ? `, ${inWords(plan.trialFullBids)} full bid${plan.trialFullBids === 1 ? "" : "s"} included` : ""}. Card needed to start; nothing is charged for ${trial} days.`
        : `You are charged ${price.amount} today, then ${interval === "year" ? "yearly" : "monthly"}.`;
      if (paused) blocked = "This workspace has a paused subscription. Resume or cancel it before starting a new one.";
      else if (!configured) blocked = "Payments are not open yet.";
      else primary = { label: "Continue to payment", run: () => void openCheckout(() => startCheckoutAction({ plan: intent.plan, interval }), "plan") };
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next || busy ? undefined : close())}>
      <DialogContent data-testid="billing-confirm" className="gap-0 sm:max-w-[30rem]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Check the price and what happens next, then continue.</DialogDescription>
        </DialogHeader>

        {showToggle ? (
          <SegmentedToggle aria-label="Billing period" value={interval} onValueChange={setInterval} options={INTERVALS} className="mt-5 w-full [&>button]:min-w-0 [&>button]:flex-1" />
        ) : null}

        <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-32 leading-[1.15] font-semibold tracking-[-0.02em] text-ink" data-testid="billing-confirm-price">
            {priceLine}
          </span>
          <span className="text-13 leading-[1.5] text-ink-2">excluding VAT</span>
        </p>
        <p className="mt-2 text-15 leading-[1.5] text-ink" data-testid="billing-confirm-next">
          {sentence}
        </p>
        <p className="mt-1.5 text-13 leading-[1.5] text-ink-2">{billingCopy.vat.replace("Prices exclude VAT. ", "")}</p>

        {blocked ? (
          <div role="status" className="mt-5 rounded-control bg-info-tint px-4 py-3 text-sm leading-[1.5] text-ink" data-testid="billing-not-configured">
            <p className="font-semibold">{blocked}</p>
            {config.showSetupHints && blocked.startsWith("Payments") ? (
              <p className="mt-1 text-13 text-ink-2">
                Set <code>NEXT_PUBLIC_PADDLE_CLIENT_TOKEN</code> and the <code>PADDLE_PRICE_*</code> variables (run <code>pnpm paddle:setup</code>).
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="mt-6">
          <Button variant="outline" disabled={busy} onClick={close}>
            {primary ? "Not now" : "Back to Billing"}
          </Button>
          {primary ? (
            <Button loading={busy} onClick={primary.run}>
              {primary.label}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
