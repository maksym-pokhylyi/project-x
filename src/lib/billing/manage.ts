import "server-only";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { reportError } from "@/lib/report-error";
import { getPaddle } from "./paddle";
import { describePaddleFailure } from "./paddle-errors";
import { getSubscription, type SubscriptionRow } from "./subscription";

/**
 * Pause, resume, cancel and undo for the workspace's subscription.
 *
 * WHAT EACH ONE DOES (Paddle API: subscriptions/pause, /resume, /cancel, update)
 *
 *   pauseSubscription    active, trialing            -> pause at the END of the paid period / of the trial
 *                                                       (`effective_from: next_billing_period`)
 *   cancelSubscription   active, trialing            -> cancel at the END of the paid period / of the trial
 *                                                       (replaces a scheduled pause, if there is one)
 *                        past_due, paused            -> cancel IMMEDIATELY (see below)
 *   resumeSubscription   a pause is scheduled        -> the scheduled pause is removed
 *                        paused                      -> resume IMMEDIATELY. If the period that was paid for
 *                                                       has ended, Paddle charges now and starts a new one;
 *                                                       if it is still running, it simply continues
 *   undoScheduledChange  a pause or cancel is        -> the scheduled change is removed
 *                        scheduled                      (`scheduled_change: null`)
 *
 * "End of the paid period" is the promise on the pricing page: the customer keeps what has
 * been paid for. Until the change takes effect the subscription stays `active` (or
 * `trialing`) in Paddle, so entitlements need no special case (./entitlements.ts).
 *
 * DECISIONS
 *  - PAUSING A TRIAL means: the trial runs to its end, then the subscription is paused
 *    instead of taking the first payment. Nothing is charged until the customer resumes;
 *    resuming takes the first payment. (Cancelling a trial also lets it run to its end.)
 *  - A PAST-DUE subscription cannot be paused: its current period is the one that was NOT
 *    paid, so there is nothing paid to pause at the end of. It can be cancelled, and that
 *    takes effect immediately — scheduling it for the end of the unpaid period would let
 *    Paddle's payment retries charge for a period the customer has just declined.
 *  - A PAUSED subscription can only be cancelled immediately (Paddle's rule).
 *  - A pause cannot replace a scheduled cancellation (Paddle refuses it): undo first.
 *
 * VERIFIED AGAINST THE PADDLE SANDBOX API (scripts/paddle-verify-sandbox.ts, 2026-11-13):
 * a scheduled pause/cancel leaves the status unchanged and sets `scheduled_change` to the
 * end of the billing period (of the trial for a trialing subscription); `scheduled_change:
 * null` removes it; cancel replaces a scheduled pause; pause while a change is scheduled is
 * refused (`subscription_locked_pending_changes`); resume of a subscription that is not
 * paused is refused (`subscription_must_be_paused`); a paused subscription refuses a
 * cancellation at period end; an unknown id answers 404 `invalid_url`. NOT exercised there:
 * a resume that starts a new period (it would have issued a further invoice).
 *
 * PRECONDITIONS — the same as changeSubscriptionPlan(): a subscription that Paddle knows and
 * that was bound to this workspace by its own owner's signed checkout (`verified_at`).
 *
 * OUR DATABASE IS NOT WRITTEN HERE. The resulting `subscription.updated` / `.paused` /
 * `.resumed` / `.canceled` webhook is the single writer of subscription state; the returned
 * ManageResult only tells the UI what Paddle acknowledged.
 */

export type ManageAction = "pause" | "resume" | "cancel" | "undo";

/** Why an action is refused. Reaches the client as `error.details.reason`. */
export type ManageRefusal =
  | "no_subscription"
  | "not_manageable"
  | "ended"
  | "already_paused"
  | "past_due"
  | "cancel_scheduled"
  | "pause_scheduled"
  | "nothing_to_resume"
  | "nothing_scheduled"
  | "paddle_refused"
  | "paddle_not_found"
  | "paddle_unavailable";

/** An expected refusal of a billing-management action: a message for the user and a machine-readable reason. */
export class BillingManageError extends AppError {
  readonly reason: ManageRefusal;

  constructor(reason: ManageRefusal, message: string, status = 409, details: Record<string, unknown> = {}) {
    super("CONFLICT", message, status, { reason, ...details });
    this.reason = reason;
  }
}

export type ManageStep =
  | { kind: "pause_at_period_end" }
  /** `continue_period`: paid time is left, nothing is charged. `new_period`: Paddle charges now and starts a new period. */
  | { kind: "resume_now"; billing: "continue_period" | "new_period" }
  | { kind: "remove_scheduled_change"; change: "cancel" | "pause" }
  | { kind: "cancel_at_period_end" }
  | { kind: "cancel_now" };

export type ManageDecision =
  /** `effectiveAt`: when the change is expected to take effect; null = at once. */
  | { ok: true; step: ManageStep; effectiveAt: Date | null }
  | { ok: false; reason: ManageRefusal; message: string };

export type ManageableSubscription = Pick<
  SubscriptionRow,
  "status" | "paddleSubscriptionId" | "verifiedAt" | "cancelAt" | "pauseAt" | "currentPeriodEnd" | "trialEnd"
>;

const day = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * PURE: what `action` would do to this subscription, or why it is refused. The one place the
 * rules live — the functions below enforce it and the Billing overview shows it.
 */
export function decideManageAction(action: ManageAction, subscription: ManageableSubscription | null | undefined, now: Date = new Date()): ManageDecision {
  const refuse = (reason: ManageRefusal, message: string): ManageDecision => ({ ok: false, reason, message });
  const allow = (step: ManageStep, effectiveAt: Date | null = null): ManageDecision => ({ ok: true, step, effectiveAt });

  if (!subscription?.paddleSubscriptionId) return refuse("no_subscription", "This workspace has no subscription to manage. Choose a plan first.");
  if (!subscription.verifiedAt) return refuse("not_manageable", "This subscription cannot be managed here. Please contact support.");
  const { status } = subscription;
  if (status === "canceled") return refuse("ended", "This subscription has ended. Start a new one from the plans on this page.");
  if (status !== "active" && status !== "trialing" && status !== "past_due" && status !== "paused") {
    return refuse("not_manageable", "This subscription cannot be managed here. Please contact support.");
  }

  const scheduled = subscription.cancelAt
    ? ({ change: "cancel", at: subscription.cancelAt } as const)
    : subscription.pauseAt
      ? ({ change: "pause", at: subscription.pauseAt } as const)
      : null;
  /** End of what has been paid for — or, in a trial, of the trial. */
  const periodEnd = (status === "trialing" ? (subscription.trialEnd ?? subscription.currentPeriodEnd) : subscription.currentPeriodEnd) ?? null;

  switch (action) {
    case "pause":
      if (status === "paused") return refuse("already_paused", "This subscription is already paused.");
      if (status === "past_due") {
        return refuse(
          "past_due",
          "The last payment for this subscription failed, so there is no paid period to pause at the end of. Update your payment method, or cancel the subscription.",
        );
      }
      if (scheduled?.change === "cancel") {
        return refuse("cancel_scheduled", `This subscription is already scheduled to cancel on ${day(scheduled.at)}. Undo the cancellation first if you would rather pause it.`);
      }
      if (scheduled?.change === "pause") return refuse("pause_scheduled", `This subscription is already scheduled to pause on ${day(scheduled.at)}.`);
      return allow({ kind: "pause_at_period_end" }, periodEnd);

    case "cancel":
      if (scheduled?.change === "cancel") return refuse("cancel_scheduled", `This subscription is already scheduled to cancel on ${day(scheduled.at)}.`);
      if (status === "paused" || status === "past_due") return allow({ kind: "cancel_now" });
      // A scheduled pause is simply replaced: Paddle keeps one scheduled change, and a cancellation wins.
      return allow({ kind: "cancel_at_period_end" }, periodEnd);

    case "resume":
      if (status === "paused") {
        // Paused in the middle of a period that was paid for (only possible from the Paddle dashboard): that time is not charged twice.
        const paidTimeLeft = subscription.currentPeriodEnd !== null && subscription.currentPeriodEnd.getTime() > now.getTime();
        return allow({ kind: "resume_now", billing: paidTimeLeft ? "continue_period" : "new_period" });
      }
      if (scheduled?.change === "pause") return allow({ kind: "remove_scheduled_change", change: "pause" });
      if (scheduled?.change === "cancel") {
        return refuse("nothing_to_resume", `This subscription is not paused: it is scheduled to cancel on ${day(scheduled.at)}. Undo the cancellation to keep it.`);
      }
      return refuse("nothing_to_resume", "This subscription is not paused.");

    case "undo":
      if (scheduled) return allow({ kind: "remove_scheduled_change", change: scheduled.change });
      if (status === "paused") return refuse("nothing_scheduled", "Nothing is scheduled for this subscription: it is paused. Resume it to continue.");
      return refuse("nothing_scheduled", "Nothing is scheduled for this subscription.");
  }
}

/** What Paddle answers (the SDK's Subscription entity): only what we read. */
export type RemoteSubscription = { status?: string; scheduledChange?: { action: string; effectiveAt: string } | null };

/** The parts of the Paddle SDK used here (injectable in tests). The real client is assignable to it. */
export type PaddleManageClient = {
  subscriptions: {
    pause(subscriptionId: string, body: { effectiveFrom: "next_billing_period" }): Promise<RemoteSubscription>;
    resume(
      subscriptionId: string,
      body: { effectiveFrom: "immediately"; onResume: "continue_existing_billing_period" | "start_new_billing_period" },
    ): Promise<RemoteSubscription>;
    cancel(subscriptionId: string, body: { effectiveFrom: "next_billing_period" | "immediately" }): Promise<RemoteSubscription>;
    update(subscriptionId: string, body: { scheduledChange: null }): Promise<RemoteSubscription>;
  };
};

export type ManageResult = {
  action: ManageAction;
  /** What was asked of Paddle. */
  step: ManageStep["kind"];
  /** For `remove_scheduled_change`: which scheduled change was removed. */
  change: "cancel" | "pause" | null;
  /** For `resume_now`: `new_period` = Paddle charged the card now; `continue_period` = nothing was charged. */
  billing: "continue_period" | "new_period" | null;
  subscriptionId: string;
  planKey: string;
  /**
   * When the change takes effect according to Paddle's answer (ISO 8601). Null: it took
   * effect at once, or nothing is scheduled any more.
   */
  effectiveAt: string | null;
};

/**
 * The Paddle request behind each step — exactly one API call. Exported so that
 * scripts/paddle-verify-sandbox.ts exercises these very calls against the real sandbox API.
 */
export function requestManageStep(api: PaddleManageClient, subscriptionId: string, step: ManageStep): Promise<RemoteSubscription> {
  switch (step.kind) {
    case "pause_at_period_end":
      return api.subscriptions.pause(subscriptionId, { effectiveFrom: "next_billing_period" });
    case "resume_now":
      return api.subscriptions.resume(subscriptionId, {
        effectiveFrom: "immediately",
        onResume: step.billing === "continue_period" ? "continue_existing_billing_period" : "start_new_billing_period",
      });
    case "remove_scheduled_change":
      // The only value Paddle accepts for `scheduled_change` on update is null: it removes the scheduled change.
      return api.subscriptions.update(subscriptionId, { scheduledChange: null });
    case "cancel_at_period_end":
      return api.subscriptions.cancel(subscriptionId, { effectiveFrom: "next_billing_period" });
    case "cancel_now":
      return api.subscriptions.cancel(subscriptionId, { effectiveFrom: "immediately" });
  }
}

const DOING: Record<ManageStep["kind"], string> = {
  pause_at_period_end: "pause the subscription",
  resume_now: "resume the subscription",
  remove_scheduled_change: "undo the scheduled change",
  cancel_at_period_end: "cancel the subscription",
  cancel_now: "cancel the subscription",
};

/** Turns whatever a Paddle call threw into the typed refusal shown to the user. */
async function paddleRefusal(error: unknown, step: ManageStep["kind"], organizationId: string): Promise<BillingManageError> {
  const failure = describePaddleFailure(error);
  if (failure.kind === "refused") {
    log.warn("paddle refused a billing-management request", { organizationId, step, code: failure.code, status: failure.status });
    return new BillingManageError("paddle_refused", `Paddle could not ${DOING[step]}: ${failure.reason}`, 409, { paddleCode: failure.code });
  }
  // Not something the customer can fix: tell the operator.
  await reportError(error, { route: "billing:manage", organizationId, extra: { step, paddleCode: failure.code, paddleStatus: failure.status } });
  if (failure.kind === "not_found") {
    return new BillingManageError("paddle_not_found", "Paddle does not know this subscription. Nothing was changed; please contact support.", 409, { paddleCode: failure.code });
  }
  return new BillingManageError(
    "paddle_unavailable",
    `We could not confirm with Paddle, our payment provider, that it would ${DOING[step]}. Check this page again in a minute before trying again.`,
    503,
    { paddleCode: failure.code },
  );
}

async function manage(action: ManageAction, organizationId: string, paddle?: PaddleManageClient): Promise<ManageResult> {
  const subscription = await getSubscription(organizationId);
  const decision = decideManageAction(action, subscription);
  if (!decision.ok) throw new BillingManageError(decision.reason, decision.message);
  // decideManageAction() only allows a subscription Paddle knows.
  const subscriptionId = subscription!.paddleSubscriptionId!;
  const api: PaddleManageClient = paddle ?? getPaddle();
  const { step } = decision;

  let remote: RemoteSubscription;
  try {
    remote = await requestManageStep(api, subscriptionId, step);
  } catch (error) {
    throw await paddleRefusal(error, step.kind, organizationId);
  }

  return {
    action,
    step: step.kind,
    change: step.kind === "remove_scheduled_change" ? step.change : null,
    billing: step.kind === "resume_now" ? step.billing : null,
    subscriptionId,
    planKey: subscription!.planKey,
    effectiveAt: remote.scheduledChange?.effectiveAt ?? null,
  };
}

/** Pauses the subscription at the end of the period that has been paid for. */
export function pauseSubscription(organizationId: string, paddle?: PaddleManageClient): Promise<ManageResult> {
  return manage("pause", organizationId, paddle);
}

/** Removes a scheduled pause, or resumes a paused subscription immediately (Paddle charges the card now). */
export function resumeSubscription(organizationId: string, paddle?: PaddleManageClient): Promise<ManageResult> {
  return manage("resume", organizationId, paddle);
}

/** Cancels at the end of the paid period (or of the trial); immediately for a paused or past-due subscription. */
export function cancelSubscription(organizationId: string, paddle?: PaddleManageClient): Promise<ManageResult> {
  return manage("cancel", organizationId, paddle);
}

/** Removes a scheduled cancellation or pause: the subscription simply continues. */
export function undoScheduledChange(organizationId: string, paddle?: PaddleManageClient): Promise<ManageResult> {
  return manage("undo", organizationId, paddle);
}
