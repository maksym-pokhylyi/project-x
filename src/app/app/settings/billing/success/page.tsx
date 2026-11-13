import type { Metadata } from "next";
import { formatBillingDate } from "@/components/billing/billing-cards";
import { CheckoutStatus, type Confirmation } from "@/components/billing/checkout-status";
import { billingCopy } from "@/config/billing-copy";
import { BID_PASS_DISPLAY, planDisplay } from "@/config/plan-display";
import { isBillingInterval, isPlanKey } from "@/config/plans";
import { site } from "@/config/site";
import { BILLING_PATH } from "@/lib/billing/handoff";
import { getBidAllowance } from "@/server/bid-allowance";
import { requireOrgForPage, type OrgContext } from "@/server/session";

export const metadata: Metadata = { title: "Payment confirmation" };

/** "You are on Bid Desk": the facts of the subscription, once the webhook has written it. */
function planConfirmation(ctx: OrgContext): Confirmation | null {
  const subscription = ctx.subscription;
  if (!subscription || !ctx.entitlements.isPaid || !isPlanKey(subscription.planKey) || subscription.planKey === "free") return null;
  const plan = planDisplay(subscription.planKey);
  const interval = isBillingInterval(subscription.billingInterval) ? subscription.billingInterval : "month";
  const price = interval === "year" ? plan.annual : plan.monthly;
  const trialing = subscription.status === "trialing" && subscription.trialEnd;
  const trialEnd = subscription.trialEnd ? formatBillingDate(subscription.trialEnd) : null;
  const renewal = subscription.currentPeriodEnd ? formatBillingDate(subscription.currentPeriodEnd) : null;
  const priceRow = {
    term: "Price",
    value: (
      <>
        <span className="font-semibold">{price.line}</span>, excluding VAT
      </>
    ),
  };
  const strong = (text: string) => <span className="font-semibold">{text}</span>;

  return {
    title: `You are on ${plan.name}`,
    lead: trialing && trialEnd ? `Your ${plan.trialDays ? `${plan.trialDays}-day ` : ""}trial has started. You will not be charged until ${trialEnd}.` : "Your plan is active. Paddle is sending your receipt by email.",
    rows: trialing && trialEnd
      ? [
          { term: "Plan", value: strong(plan.name) },
          priceRow,
          { term: "Trial ends", value: strong(trialEnd) },
          { term: "First payment", value: strong(`${price.amount} on ${trialEnd}`) },
          { term: "Included", value: plan.trialFullBids ? `${plan.billingLine}. The trial includes ${plan.trialFullBids} full bid${plan.trialFullBids === 1 ? "" : "s"}.` : plan.billingLine },
          { term: "Receipts", value: "Paddle emails one after each payment." },
        ]
      : [
          { term: "Plan", value: strong(plan.name) },
          priceRow,
          ...(renewal ? [{ term: "Next payment", value: strong(renewal) }] : []),
          { term: "Included", value: plan.billingLine },
          { term: "Receipt", value: subscription.customerEmail ? `Sent to ${subscription.customerEmail} by Paddle` : "Sent by Paddle to the email you paid with" },
        ],
    primary: { label: "Start a bid check", href: "/app/bids/new" },
    secondary: { label: "Invite your team", href: "/app/settings/members" },
    link: { label: "Billing", href: BILLING_PATH },
    note: billingCopy.pauseOrCancel,
  };
}

/** "Bid Pass added": shown when the billing backend reports the pass on the workspace. */
function passConfirmation(email: string | null): Confirmation {
  return {
    title: `${BID_PASS_DISPLAY.name} added`,
    lead: `You have one full bid to use on any tender. ${billingCopy.bidPassExpiryIt}`,
    rows: [
      {
        term: "Bought",
        value: (
          <>
            <span className="font-semibold">{BID_PASS_DISPLAY.name}</span>, one full bid
          </>
        ),
      },
      {
        term: "Price",
        value: (
          <>
            <span className="font-semibold">{BID_PASS_DISPLAY.price}</span>, excluding VAT
          </>
        ),
      },
      { term: "Receipt", value: email ? `Sent to ${email} by Paddle` : "Sent by Paddle to the email you paid with" },
      { term: "Refund", value: `An unused ${BID_PASS_DISPLAY.name} is refunded on request within ${site.legal.refundWindowDays} days.` },
    ],
    primary: { label: "Use it now: start a bid check", href: "/app/bids/new" },
    link: { label: "Back to Bids", href: "/app/bids" },
  };
}

/**
 * After checkout (CheckoutPlan and CheckoutPass artboards). The redirect from Paddle proves
 * nothing: the page says "You are on Bid Desk" or "Bid Pass added" only once our own records
 * say so, and until then shows what it is waiting for (see CheckoutStatus).
 */
export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ bought?: string }> }) {
  const ctx = await requireOrgForPage({ role: "owner" });
  const { bought } = await searchParams;

  if (bought === "bid_pass") {
    // Until the bids module is connected the allowance is unknown (null): the page waits, then says it is taking longer.
    const allowance = await getBidAllowance(ctx);
    const added = (allowance?.bidPasses ?? 0) > 0;
    return (
      <div className="pt-3 md:pt-7">
        <CheckoutStatus kind="pass" confirmed={added} confirmation={added ? passConfirmation(ctx.subscription?.customerEmail ?? ctx.user.email) : null} />
      </div>
    );
  }

  const confirmation = planConfirmation(ctx);
  return (
    <div className="pt-3 md:pt-7">
      <CheckoutStatus kind="plan" confirmed={confirmation !== null} confirmation={confirmation} />
    </div>
  );
}
