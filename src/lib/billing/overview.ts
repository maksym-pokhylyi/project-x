import "server-only";
import { BID_PASS } from "@/config/plan-display";
import { PLANS, PLAN_CURRENCY, formatPrice, isBillingInterval, isPlanKey, type BillingInterval, type PlanKey } from "@/config/plans";
import { env, features } from "@/env";
import { listMembers } from "@/server/members";
import type { OrgContext } from "@/server/session";
import { hasRole, type Role } from "@/server/workspaces";
import type { EntitlementSource } from "./entitlements";
import { decideManageAction, type ManageAction, type ManageRefusal, type ManageStep } from "./manage";
import { getOneOffPriceId } from "./one-off";
import { planChangeBlocker } from "./paddle";
import { describePaymentMethod, normalizePaymentMethod, type PaymentMethodSummary } from "./payment-method";
import { listReceipts, type Receipt } from "./receipts";
import { isTrialEligible } from "./trial";

/**
 * Everything the Billing page shows, as ONE typed object.
 *
 * Read from our own database only — the subscription row, `billing_payments`, members — and
 * from configuration. It makes NO Paddle API call: the page must load when Paddle is down.
 * What needs Paddle (invoice PDFs, the customer portal, pausing…) happens on demand, in
 * actions and routes of their own.
 */
export type Money = {
  /** Minor units of `currency` (pence for GBP). */
  amountMinor: number;
  currency: string;
  /** "£149" */
  formatted: string;
};

export type ManageOption = {
  /** The action can be taken right now by this user. */
  allowed: boolean;
  /** What it would do: pause_at_period_end | resume_now | remove_scheduled_change | cancel_at_period_end | cancel_now. */
  step: ManageStep["kind"] | null;
  /** When it would take effect; null = at once (or not allowed). */
  effectiveAt: Date | null;
  /** Resume only: `new_period` = the card is charged at once and a new period starts; `continue_period` = nothing is charged now. */
  billing: "continue_period" | "new_period" | null;
  /** Why it is not allowed — the same reason the action would answer with — or "forbidden" / "not_configured". */
  reason: ManageRefusal | "forbidden" | "not_configured" | null;
  /** The sentence to show for `reason`. */
  message: string | null;
};

export type BillingOverview = {
  /** The plan whose limits and features apply right now. */
  plan: { key: PlanKey; name: string };
  /** The plan on the subscription — differs from `plan` when it is not honoured (paused, cancelled, grace period over). */
  subscribedPlan: { key: PlanKey; name: string } | null;
  interval: BillingInterval | null;
  /** Catalogue price of the subscribed plan for `interval`, before tax. */
  price: Money | null;
  status: "none" | "active" | "trialing" | "past_due" | "paused" | "canceled" | "unknown";
  /** Why `plan` applies (see resolveEntitlements). */
  entitlementSource: EntitlementSource;
  /** Next renewal — or the first payment of a trial. Null when cancelled, paused, past due, or a pause/cancellation is scheduled. */
  nextPaymentAt: Date | null;
  /** A cancellation is scheduled for this moment; the plan stays until then. */
  cancelAt: Date | null;
  /** A pause is scheduled for this moment; the plan stays until then. */
  pauseAt: Date | null;
  pausedAt: Date | null;
  canceledAt: Date | null;
  trialEndsAt: Date | null;
  /** The trial strip: "Trial · 9 days left · first payment £149 on 27 Nov 2026". Null outside a trial. */
  trial: {
    endsAt: Date;
    /** Whole days left, rounded up; 0 on the last day. */
    daysLeft: number;
    /** Null when the trial will not turn into a paid subscription (a cancellation or pause is scheduled). */
    firstPayment: (Money & { at: Date }) | null;
  } | null;
  /** Set while the last payment has failed. */
  pastDue: {
    since: Date | null;
    /** Paid features stay available until then; null once that time has passed. */
    graceEndsAt: Date | null;
    accessLost: boolean;
  } | null;
  seats: {
    used: number;
    limit: number | null;
    /** More members than the plan allows: the workspace is read-only (billing still works). */
    overLimit: boolean;
    members: Array<{ name: string; initials: string; role: Role }>;
  };
  /** "Visa ending 4242" — owners and admins only. Never more than these fields. */
  paymentMethod: (PaymentMethodSummary & { label: string }) | null;
  /** Where Paddle sends receipts — owners and admins only. */
  billingEmail: string | null;
  /** Newest first — owners and admins only. */
  receipts: Receipt[];
  /** Billing runs against the Paddle sandbox: show "Test mode — no real payments". */
  testMode: boolean;
  /** The user may pause, resume, cancel and change the plan (owners). */
  canManage: boolean;
  manage: Record<ManageAction, ManageOption>;
  /**
   * Can the plan or interval be changed now (changePlanAction)? Not during a trial and not
   * while a pause or cancellation is scheduled — `message` says why.
   */
  planChange: { allowed: boolean; message: string | null };
  /** Can "Manage billing" / "Update payment method" (openBillingPortalAction) work for this subscription? */
  managementLinks: {
    available: boolean;
    unavailableReason: "forbidden" | "not_configured" | "no_subscription" | "not_verified" | null;
  };
  oneOff: {
    bidPass: {
      /** The Bid Pass is on sale in this environment (checkout and price configured). */
      available: boolean;
      /** …and this user may buy it now (owner or admin, workspace not read-only). */
      canBuy: boolean;
      price: Money;
    };
  };
  /** A new subscription of this workspace would start with the trial (it never had a subscription). */
  trialEligible: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const KNOWN_STATUSES = ["active", "trialing", "past_due", "paused", "canceled"] as const;

const catalogueMoney = (pence: number): Money => ({ amountMinor: pence, currency: PLAN_CURRENCY, formatted: formatPrice(pence) });

/** "Olivia Owner" -> "OO", "olivia" -> "O", "" -> "?" */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase() || "?";
}

export async function getBillingOverview(ctx: OrgContext, now: Date = new Date()): Promise<BillingOverview> {
  const subscription = ctx.subscription;
  const { entitlements } = ctx;
  const isAdmin = hasRole(ctx.role, "admin");
  const canManage = ctx.role === "owner";

  const [members, receipts, trialEligible] = await Promise.all([
    listMembers(ctx),
    isAdmin ? listReceipts(ctx.organization.id) : Promise.resolve([]),
    isTrialEligible(ctx.organization.id),
  ]);

  const status: BillingOverview["status"] = !subscription
    ? "none"
    : (KNOWN_STATUSES as readonly string[]).includes(subscription.status)
      ? (subscription.status as BillingOverview["status"])
      : "unknown";
  const subscribedKey = subscription && isPlanKey(subscription.planKey) ? subscription.planKey : null;
  const interval = isBillingInterval(subscription?.billingInterval) ? subscription.billingInterval : null;
  const cataloguePrice = subscribedKey && interval ? (PLANS[subscribedKey].prices?.[interval] ?? null) : null;
  const price = cataloguePrice === null ? null : catalogueMoney(cataloguePrice);

  const cancelAt = subscription?.cancelAt ?? null;
  const pauseAt = subscription?.pauseAt ?? null;
  const scheduled = Boolean(cancelAt || pauseAt);
  const trialEndsAt = status === "trialing" ? (subscription?.trialEnd ?? subscription?.currentPeriodEnd ?? null) : null;
  const nextPaymentAt = scheduled ? null : status === "active" ? (subscription?.currentPeriodEnd ?? null) : status === "trialing" ? trialEndsAt : null;

  const manage = {} as Record<ManageAction, ManageOption>;
  for (const action of ["pause", "resume", "cancel", "undo"] as const) {
    const decision = decideManageAction(action, subscription, now);
    if (!decision.ok) {
      manage[action] = { allowed: false, step: null, effectiveAt: null, billing: null, reason: decision.reason, message: decision.message };
      continue;
    }
    const planned = { step: decision.step.kind, effectiveAt: decision.effectiveAt, billing: decision.step.kind === "resume_now" ? decision.step.billing : null };
    if (!canManage) manage[action] = { ...planned, allowed: false, reason: "forbidden", message: "Only an owner of this workspace can manage billing." };
    else if (!features.paddleApi) manage[action] = { ...planned, allowed: false, reason: "not_configured", message: "Billing is not configured for this environment." };
    else manage[action] = { ...planned, allowed: true, reason: null, message: null };
  }

  const planChangeBlockedBy = planChangeBlocker(subscription);
  const planChange = planChangeBlockedBy
    ? { allowed: false, message: planChangeBlockedBy }
    : !canManage
      ? { allowed: false, message: "Only an owner of this workspace can manage billing." }
      : !features.paddleApi
        ? { allowed: false, message: "Billing is not configured for this environment." }
        : { allowed: true, message: null };

  const storedMethod = isAdmin ? normalizePaymentMethod(subscription?.paymentMethod) : null;
  const bidPassOnSale = features.paddleCheckout && Boolean(env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) && getOneOffPriceId("bid_pass") !== null;

  return {
    plan: { key: entitlements.planKey, name: entitlements.plan.name },
    subscribedPlan: subscribedKey ? { key: subscribedKey, name: PLANS[subscribedKey].name } : null,
    interval,
    price,
    status,
    entitlementSource: entitlements.source,
    nextPaymentAt,
    cancelAt,
    pauseAt,
    pausedAt: subscription?.pausedAt ?? null,
    canceledAt: subscription?.canceledAt ?? null,
    trialEndsAt,
    trial: trialEndsAt
      ? {
          endsAt: trialEndsAt,
          daysLeft: Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS)),
          firstPayment: price && !scheduled ? { ...price, at: trialEndsAt } : null,
        }
      : null,
    pastDue:
      status === "past_due"
        ? { since: subscription?.pastDueSince ?? null, graceEndsAt: entitlements.graceEndsAt, accessLost: entitlements.source === "past_due_expired" }
        : null,
    seats: {
      used: ctx.seats.used,
      limit: ctx.seats.limit,
      overLimit: ctx.seats.overLimit,
      members: members.map((member) => ({ name: member.name, initials: initialsOf(member.name), role: member.role })),
    },
    paymentMethod: storedMethod ? { ...storedMethod, label: describePaymentMethod(storedMethod) } : null,
    billingEmail: isAdmin ? (subscription?.customerEmail ?? null) : null,
    receipts,
    testMode: features.billingTestMode,
    canManage,
    manage,
    planChange,
    managementLinks: !canManage
      ? { available: false, unavailableReason: "forbidden" }
      : !features.paddleApi
        ? { available: false, unavailableReason: "not_configured" }
        : !subscription?.paddleCustomerId || !subscription.paddleSubscriptionId
          ? { available: false, unavailableReason: "no_subscription" }
          : !subscription.verifiedAt
            ? { available: false, unavailableReason: "not_verified" }
            : { available: true, unavailableReason: null },
    oneOff: {
      bidPass: {
        available: bidPassOnSale,
        canBuy: bidPassOnSale && isAdmin && !ctx.seats.overLimit,
        price: catalogueMoney(BID_PASS.pricePence),
      },
    },
    trialEligible,
  };
}
