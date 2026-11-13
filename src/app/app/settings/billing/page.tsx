import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { UsagePanel } from "@/components/app/usage-panel";
import { BillingPlans, type BillingClientConfig } from "@/components/billing/billing-plans";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
import { TestModeNotice } from "@/components/billing/test-mode-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PAID_PLAN_KEYS, PLANS, isBillingInterval, isPlanKey, type BillingInterval, type PaidPlanKey } from "@/config/plans";
import { env, features } from "@/env";
import { getPriceCatalogue } from "@/lib/billing/prices";
import { requireOrgForPage } from "@/server/session";
import { getUsageSummary } from "@/server/usage";

export const metadata: Metadata = { title: "Billing" };

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "info" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "success" },
  trialing: { label: "Trial", variant: "info" },
  past_due: { label: "Past due", variant: "destructive" },
  paused: { label: "Paused", variant: "outline" },
  canceled: { label: "Cancelled", variant: "outline" },
};

const formatDate = (date: Date | null | undefined) =>
  date ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string }> }) {
  // Owner only: admins and members get the 403 page.
  const ctx = await requireOrgForPage({ role: "owner" });
  const params = await searchParams;
  const usage = await getUsageSummary(ctx);
  const subscription = ctx.subscription;
  const isLive = subscription ? ["active", "trialing", "past_due"].includes(subscription.status) : false;
  const subscribedPlan = subscription && isPlanKey(subscription.planKey) ? subscription.planKey : null;
  const subscribedInterval: BillingInterval | null = isBillingInterval(subscription?.billingInterval) ? subscription.billingInterval : null;

  const catalogue = getPriceCatalogue();
  const config: BillingClientConfig = {
    // `features.paddleCheckout` is false for sandbox credentials on real production without ALLOW_SANDBOX_BILLING=1.
    paddle: features.paddleCheckout && env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ? { environment: env.PADDLE_ENV, clientToken: env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN } : null,
    availablePrices: Object.fromEntries(
      PAID_PLAN_KEYS.map((plan) => [plan, { month: Boolean(catalogue[plan].month), year: Boolean(catalogue[plan].year) }]),
    ) as Record<PaidPlanKey, Record<BillingInterval, boolean>>,
    showSetupHints: !features.isRealProduction,
  };

  const status = subscription ? STATUS_LABEL[subscription.status] : undefined;
  const renewal = formatDate(subscription?.currentPeriodEnd);
  const cancelAt = formatDate(subscription?.cancelAt);
  const trialEnd = formatDate(subscription?.trialEnd);
  const graceEnd = formatDate(ctx.entitlements.graceEndsAt);

  return (
    <>
      <PageHeader level={2} title="Billing" description="Plan, payment details and usage for this workspace." />
      <TestModeNotice inline />

      <Card data-testid="current-plan">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{ctx.plan.name} plan</CardTitle>
            {status ? <Badge variant={status.variant}>{status.label}</Badge> : <Badge variant="secondary">Free</Badge>}
          </div>
          <CardDescription>
            {!subscription || !isLive
              ? subscription?.status === "canceled"
                ? "Your subscription has ended. This workspace is on the Free plan."
                : subscription?.status === "paused"
                  ? "Your subscription is paused. This workspace is on the Free plan until it resumes."
                  : "This workspace is on the Free plan."
              : subscription.status === "past_due"
                ? graceEnd
                  ? `The last payment failed. Paid features stay available until ${graceEnd}; update your payment method to keep them.`
                  : `The last payment failed and the grace period is over. Update your payment method to restore the ${subscribedPlan ? PLANS[subscribedPlan].name : "paid"} plan.`
                : cancelAt
                  ? `Scheduled to cancel on ${cancelAt}. You keep paid features until then.`
                  : subscription.status === "trialing" && trialEnd
                    ? `Trial ends on ${trialEnd}; the first payment is taken then.`
                    : renewal
                      ? `Renews on ${renewal} (${subscribedInterval === "year" ? "annual" : "monthly"} billing).`
                      : "Subscription active."}
          </CardDescription>
        </CardHeader>
        {subscription?.customerEmail || subscription?.paddleCustomerId ? (
        <CardContent className="space-y-3">
          {subscription?.customerEmail ? (
            <p className="text-sm text-ink-2">
              Receipts are sent to <span className="font-medium text-ink">{subscription.customerEmail}</span>.
            </p>
          ) : null}
          {subscription?.paddleCustomerId ? (
            features.paddleApi ? (
              <ManageBillingButton />
            ) : (
              <p className="text-sm text-ink-2" data-testid="portal-not-configured">
                Self-service billing is unavailable because <code>PADDLE_API_KEY</code> is not configured. Use the links in
                your Paddle receipt, or contact support.
              </p>
            )
          ) : null}
        </CardContent>
        ) : null}
      </Card>

      <UsagePanel usage={usage} planName={ctx.plan.name} />

      <section aria-labelledby="plans-title" className="space-y-4">
        <h3 id="plans-title" className="font-display text-xl font-semibold text-ink">
          Plans
        </h3>
        <BillingPlans
          config={config}
          currentPlan={ctx.entitlements.planKey}
          subscribedPlan={subscribedPlan}
          subscribedInterval={subscribedInterval}
          hasLiveSubscription={isLive}
          defaultInterval={isBillingInterval(params.interval) ? params.interval : (subscribedInterval ?? "month")}
        />
      </section>
    </>
  );
}
