import { isBillingInterval } from "@/config/plans";
import { json, route } from "@/server/http";
import { requireOrg } from "@/server/session";

/**
 * What /pricing needs to know about a signed-in visitor, so that the static page can mark
 * "Current plan" and point its buttons at Billing: the plan of the ACTIVE workspace, the
 * billing period of a live subscription, and whether this person may change the plan.
 * Read-only; answers 401 for visitors who are not signed in (the page then shows the
 * signed-out buttons). The workspace comes from the session, never from the request.
 */
export const dynamic = "force-dynamic";

export type PricingViewer = {
  /** The plan whose limits apply now. */
  planKey: string;
  /** Billing period of the live subscription; null without one. */
  interval: "month" | "year" | null;
  /** A subscription that is active, in trial or past due exists: other plans are a change, not a new purchase. */
  hasSubscription: boolean;
  /** Only owners can buy or change a plan. */
  canManageBilling: boolean;
};

export const GET = route(async (_request, _context, { requestId }) => {
  const ctx = await requireOrg();
  const subscription = ctx.subscription;
  const live = subscription ? ["active", "trialing", "past_due"].includes(subscription.status) : false;
  const viewer: PricingViewer = {
    planKey: ctx.entitlements.planKey,
    interval: live && isBillingInterval(subscription?.billingInterval) ? subscription.billingInterval : null,
    hasSubscription: live,
    canManageBilling: ctx.role === "owner",
  };
  return json(viewer, { requestId });
});
