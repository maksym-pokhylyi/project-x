import type { Metadata } from "next";
import {
  AllowanceCard,
  BidPassCard,
  BillingRow,
  CurrentPlanCard,
  PauseCancelCard,
  PaymentMethodCard,
  ReceiptsCard,
  formatBillingDate,
  type CurrentPlanCardProps,
  type PauseCancelCardProps,
} from "@/components/billing/billing-cards";
import { ConfirmPanel, type BillingClientConfig, type BillingIntent } from "@/components/billing/confirm-panel";
import { plusVat } from "@/config/billing-copy";
import { ANNUAL_SAVING, planDisplay } from "@/config/plan-display";
import { PAID_PLAN_KEYS, PLANS, isBillingInterval, isPlanKey, type BillingInterval, type PaidPlanKey } from "@/config/plans";
import { env, features } from "@/env";
import { billingHandoff } from "@/lib/billing/handoff";
import { getPriceCatalogue } from "@/lib/billing/prices";
import { getBidAllowance } from "@/server/bid-allowance";
import { listMembers } from "@/server/members";
import { requireOrgForPage, type OrgContext } from "@/server/session";

export const metadata: Metadata = { title: "Billing" };

const isPaidPlan = (value: unknown): value is PaidPlanKey => isPlanKey(value) && value !== "free";

/** What the "Current plan" card says for the state the subscription is in. */
function currentPlan(ctx: OrgContext): CurrentPlanCardProps {
  const subscription = ctx.subscription;
  const { source, graceEndsAt } = ctx.entitlements;
  const subscribed = subscription && isPaidPlan(subscription.planKey) && subscription.status !== "canceled" ? subscription.planKey : null;
  const interval: BillingInterval = isBillingInterval(subscription?.billingInterval) ? subscription.billingInterval : "month";

  if (!subscription || !subscribed) {
    return {
      planName: PLANS.free.name,
      price: null,
      summary: PLANS.free.summary,
      note: subscription?.status === "canceled" ? "Your subscription has ended. This workspace is on Free." : null,
      changePlan: { label: "See plans", href: "/pricing" },
    };
  }

  const plan = planDisplay(subscribed);
  const price = interval === "year" ? plan.annual : plan.monthly;
  const base = { planName: plan.name, price: { amount: price.amount, period: price.period }, summary: plan.billingLine, changePlan: { label: "Change plan", href: "/pricing" } };
  const date = (value: Date | null | undefined) => (value ? formatBillingDate(value) : null);
  const renewal = date(subscription.currentPeriodEnd);
  const trialEnd = date(subscription.trialEnd);
  const cancelAt = date(subscription.cancelAt);

  if (subscription.status === "paused") {
    return { ...base, status: { label: "Paused", tone: "neutral" }, note: "Your subscription is paused. This workspace is on Free until it resumes." };
  }
  if (source === "period_lapsed") {
    return { ...base, status: { label: "Renewal not confirmed", tone: "warning" }, note: "We could not confirm the renewal of this subscription. The workspace is limited to Free for now." };
  }
  if (source === "past_due_grace") {
    return {
      ...base,
      status: { label: "Payment failed", tone: "danger" },
      note: "The last payment failed. Update your payment method to keep your plan.",
      dateLine: graceEndsAt ? { label: "Paid features until", value: formatBillingDate(graceEndsAt) } : null,
    };
  }
  if (source === "past_due_expired") {
    return { ...base, status: { label: "Past due", tone: "danger" }, note: `The last payment failed and the grace period is over. Update your payment method to restore ${plan.name}.` };
  }
  if (cancelAt) {
    return { ...base, status: { label: "Ending", tone: "warning" }, note: "A cancellation is scheduled. Nothing more is charged.", dateLine: { label: "Access until", value: cancelAt } };
  }
  /* Monthly, renewing: the one case where "Switch to annual" is offered, as on the artboard. */
  const switchInterval =
    interval === "month" && plan.annual.amount
      ? { lead: "Switch to annual:", detail: `${plan.annual.line}, ${ANNUAL_SAVING}`, href: billingHandoff({ plan: subscribed, interval: "year" }) }
      : null;
  if (subscription.status === "trialing") {
    return {
      ...base,
      status: { label: "Trial", tone: "info" },
      note: plan.trialFullBids ? `Your trial includes ${plan.trialFullBids} full bid${plan.trialFullBids === 1 ? "" : "s"}. Nothing is charged until it ends.` : "Nothing is charged until the trial ends.",
      dateLine: trialEnd ? { label: "First payment", value: `${plusVat(price.amount)} on ${trialEnd}` } : null,
      switchInterval,
    };
  }
  return { ...base, dateLine: renewal ? { label: "Next payment", value: renewal } : null, switchInterval };
}

/**
 * Billing, as in docs/design/handoff/Billing-1440 and Billing-390: what you are on, your
 * allowance and seats, pausing and cancelling, the Bid Pass, the payment method and the
 * receipts. Plans are compared and chosen in ONE place, /pricing; this page only confirms a
 * choice, in the panel that opens when the address carries the hand-off
 * (?plan=…&interval=… or ?buy=bid_pass — see src/lib/billing/handoff.ts).
 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string; buy?: string }> }) {
  // Owner only: admins and members get the 403 page.
  const ctx = await requireOrgForPage({ role: "owner" });
  const params = await searchParams;
  const [people, allowance] = await Promise.all([listMembers(ctx), getBidAllowance(ctx)]);

  const subscription = ctx.subscription;
  const isLive = subscription ? ["active", "trialing", "past_due"].includes(subscription.status) : false;
  const subscribedPlan = subscription && isPlanKey(subscription.planKey) ? subscription.planKey : null;
  const subscribedInterval: BillingInterval | null = isBillingInterval(subscription?.billingInterval) ? subscription.billingInterval : null;
  /* Self-service links exist only where Paddle knows the customer and the API key is set. */
  const portalAvailable = features.paddleApi && Boolean(subscription?.paddleCustomerId);
  const planFullBids = ctx.entitlements.limits["bids.monthly"] ?? 0;

  const pauseState: PauseCancelCardProps["state"] =
    !subscription || subscription.status === "canceled" ? "none" : subscription.status === "paused" ? "paused" : subscription.cancelAt ? "cancelling" : isLive ? "active" : "none";

  const intent: BillingIntent | null =
    params.buy === "bid_pass" ? { kind: "bid_pass" } : isPaidPlan(params.plan) ? { kind: "plan", plan: params.plan, interval: isBillingInterval(params.interval) ? params.interval : "month" } : null;

  const catalogue = getPriceCatalogue();
  const config: BillingClientConfig = {
    // `features.paddleCheckout` is false for sandbox credentials on real production without ALLOW_SANDBOX_BILLING=1.
    paddle: features.paddleCheckout && env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ? { environment: env.PADDLE_ENV, clientToken: env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN } : null,
    availablePrices: Object.fromEntries(
      PAID_PLAN_KEYS.map((plan) => [plan, { month: Boolean(catalogue[plan].month), year: Boolean(catalogue[plan].year) }]),
    ) as Record<PaidPlanKey, Record<BillingInterval, boolean>>,
    bidPassAvailable: Boolean(env.PADDLE_PRICE_BID_PASS),
    showSetupHints: !features.isRealProduction,
  };

  return (
    <div className="flex flex-col pt-1 md:pt-3">
      <h1 className="type-page text-ink">Billing</h1>

      <div className="mt-5 flex flex-col gap-4 md:mt-7 md:gap-6">
        <BillingRow>
          <CurrentPlanCard {...currentPlan(ctx)} />
          <AllowanceCard
            allowance={allowance}
            planFullBids={planFullBids}
            planName={ctx.plan.name}
            renewsAt={isLive ? (subscription?.currentPeriodEnd ?? null) : null}
            seats={{ used: ctx.seats.used, limit: ctx.seats.limit }}
            people={people.map((person) => ({ id: person.id, name: person.name, email: person.email, isOwner: person.role === "owner", isYou: person.userId === ctx.user.id }))}
            inviteHref={ctx.seats.limit === null || ctx.seats.used < ctx.seats.limit ? "/app/settings/members" : null}
          />
        </BillingRow>
        <BillingRow>
          {/* No pause, cancel or resume actions are passed yet: the card falls back to the Paddle portal. */}
          <PauseCancelCard state={pauseState} endsOn={subscription?.cancelAt ? formatBillingDate(subscription.cancelAt) : null} portalAvailable={portalAvailable} />
          <BidPassCard passes={allowance?.bidPasses ?? null} buyHref={billingHandoff({ buy: "bid_pass" })} hasMonthlyBids={planFullBids > 0} />
        </BillingRow>
        <BillingRow>
          {/* The card on file and the receipts are not read from Paddle yet: both cards say where they are. */}
          <PaymentMethodCard method={null} hasSubscription={Boolean(subscription?.paddleCustomerId) && subscription?.status !== "canceled"} portalAvailable={portalAvailable} />
          <ReceiptsCard receipts={null} email={subscription?.customerEmail ?? null} portalAvailable={portalAvailable} />
        </BillingRow>
      </div>

      {intent ? (
        <ConfirmPanel
          key={intent.kind === "plan" ? `${intent.plan}:${intent.interval}` : "bid_pass"}
          intent={intent}
          config={config}
          subscribed={isLive && subscribedPlan ? { plan: subscribedPlan, interval: subscribedInterval } : null}
          paused={subscription?.status === "paused" && Boolean(subscription.paddleSubscriptionId)}
          trialEligible={!subscription}
        />
      ) : null}
    </div>
  );
}
