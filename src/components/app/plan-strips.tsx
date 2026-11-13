import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Dot } from "@/components/ui/dot";
import { plusVat } from "@/config/billing-copy";
import { planPrice } from "@/config/plan-display";
import { PLANS, isBillingInterval, isPlanKey } from "@/config/plans";
import { BILLING_PATH } from "@/lib/billing/handoff";
import { cn } from "@/lib/utils";
import type { OrgContext } from "@/server/session";

const formatDate = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "Free plan" beside the workspace name, as on the Radar artboard. */
export function FreePlanChip({ className }: { className?: string }) {
  return (
    <Badge variant="secondary" data-testid="plan-chip" className={className}>
      {PLANS.free.name} plan
    </Badge>
  );
}

/** "See plans": the way from anywhere in the app to the one place where plans are compared. */
export function SeePlansLink({ className }: { className?: string }) {
  return (
    <Link href="/pricing" className={cn("link inline-flex min-h-11 shrink-0 items-center rounded-sm text-sm", className)}>
      See plans
    </Link>
  );
}

/**
 * Phones, Free plan only: the bar under the top bar of RadarFirstRun-390, with the workspace
 * name and the "Free plan" chip on the left and "See plans" on the right. From 768 px the
 * same two things sit in the top bar itself.
 */
export function FreePlanBar({ ctx }: { ctx: OrgContext }) {
  if (ctx.entitlements.planKey !== "free") return null;
  return (
    <div data-slot="plan-bar" className="border-b border-line bg-surface md:hidden">
      <div className="container-app flex min-h-11 items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-13 leading-[1.5] text-ink-2">
          <span className="truncate">{ctx.organization.name}</span>
          <FreePlanChip className="text-ink" />
        </p>
        <SeePlansLink />
      </div>
    </div>
  );
}

/**
 * The trial strip under the top bar (TrialStrip artboards), shown while the subscription is
 * in its trial: how long is left, what the trial includes and when the first payment is
 * taken. The trial is card-up-front, so there is nothing to "add": owners get "Manage",
 * which goes to Billing. Every figure comes from the subscription record and the catalogue.
 */
export function TrialStrip({ ctx, now = new Date() }: { ctx: OrgContext; now?: Date }) {
  const subscription = ctx.subscription;
  if (ctx.entitlements.source !== "trialing" || !subscription?.trialEnd || !isPlanKey(subscription.planKey)) return null;
  const plan = PLANS[subscription.planKey];
  const interval = isBillingInterval(subscription.billingInterval) ? subscription.billingInterval : "month";
  const days = Math.max(0, Math.ceil((subscription.trialEnd.getTime() - now.getTime()) / 86_400_000));
  const left = days === 0 ? "Ends today" : days === 1 ? "1 day left" : `${days} days left`;
  const bids = plan.trialFullBids ?? 0;
  return (
    <div data-slot="trial-strip" data-testid="trial-strip" role="status" className="bg-accent-tint">
      <div className="container-app flex flex-wrap items-center justify-between gap-x-3 pb-3 text-sm leading-[1.5] text-ink tabular-nums md:min-h-11 md:justify-start md:gap-x-2.5 md:pb-0">
        <p className="order-1 flex items-center gap-2 md:gap-2.5">
          <Dot />
          <span className="font-semibold">Trial</span>
          <span className="font-semibold text-accent-ink">{left}</span>
        </p>
        {/* Two facts, each an inline block: where the line is too short (phones) it breaks
            between them, after the dot, and never inside the amount or the date. */}
        <p className="order-3 basis-full md:order-2 md:basis-auto">
          {bids ? (
            <span className="inline-block">
              {bids} full bid{bids === 1 ? "" : "s"} included ·&nbsp;
            </span>
          ) : null}
          <span className="inline-block">
            First payment {plusVat(planPrice(plan.key, interval).amount)} on {formatDate(subscription.trialEnd)}
          </span>
        </p>
        {ctx.role === "owner" ? (
          <Link href={BILLING_PATH} className="link order-2 inline-flex min-h-11 items-center rounded-sm font-medium md:order-3 md:ml-1.5">
            Manage
          </Link>
        ) : (
          /* Keeps the first row 44 px tall on phones, like the row with the link. */
          <span aria-hidden className="order-2 min-h-11 md:hidden" />
        )}
      </div>
    </div>
  );
}
