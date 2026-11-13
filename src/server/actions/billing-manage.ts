"use server";

import { z } from "zod";
import type { EventMap } from "@/config/events";
import { env, features } from "@/env";
import { track } from "@/lib/analytics";
import { recordAudit } from "@/lib/audit";
import { signCheckoutData, type SignedCheckoutData } from "@/lib/billing/checkout-signature";
import {
  BillingManageError,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  undoScheduledChange,
  type ManageAction,
  type ManageResult,
} from "@/lib/billing/manage";
import { ONE_OFF_KINDS, ONE_OFF_PRODUCTS, getOneOffPriceId, type OneOffKind } from "@/lib/billing/one-off";
import { BillingNotConfiguredError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseInput } from "@/lib/validation";
import { runAction, type ActionResult } from "../http";
import { assertWorkspaceWritable, requireOrg, type OrgContext } from "../session";

/**
 * Billing management for the ACTIVE workspace: pause, resume, cancel, undo — and the
 * checkout of one-off purchases (Bid Pass).
 *
 * WHO: pause / resume / cancel / undo are for owners only, like every other billing action.
 * A one-off purchase may be started by owners and admins (the people who run bids); the
 * signed checkout data names the buyer.
 *
 * READ-ONLY WORKSPACES: `requireOrg({ write: true })` refuses while a workspace has more
 * members than its plan allows. The four management actions deliberately do NOT pass it —
 * that is where the exemption belongs (src/server/session.ts: "reads, member management and
 * billing do not pass it, so the workspace can be repaired"): pausing or cancelling is often
 * what PUT the workspace over its seat limit, and resuming is how its owner gets out of it.
 * Buying a Bid Pass is different: it is product capacity that a read-only workspace could
 * not use, so that checkout is refused until the workspace is writable again.
 *
 * Nothing here writes subscription state: Paddle's webhook does (src/lib/billing/webhooks.ts).
 * The returned ManageResult tells the UI what Paddle acknowledged; the page shows the new
 * state once the webhook has arrived (a few seconds).
 */

/** The management actions take no parameters: anything else — e.g. an organization id — is rejected. */
const noInput = z.union([z.undefined(), z.null(), z.strictObject({})]);

const AUDIT_ACTION: Record<ManageAction, string> = {
  pause: "billing.pause_requested",
  resume: "billing.resume_requested",
  cancel: "billing.cancel_requested",
  undo: "billing.scheduled_change_undo_requested",
};

async function trackManage(ctx: OrgContext, result: ManageResult): Promise<void> {
  const context = { organizationId: ctx.organization.id, userId: ctx.user.id };
  const plan = result.planKey;
  switch (result.action) {
    case "pause":
      return track("billing.pause_requested", context, { plan });
    case "resume": {
      const mode: EventMap["billing.resume_requested"]["mode"] = result.step === "resume_now" ? "resume_now" : "keep_active";
      return track("billing.resume_requested", context, { plan, mode });
    }
    case "cancel":
      return track("billing.cancel_requested", context, { plan, effective: result.step === "cancel_now" ? "immediately" : "period_end" });
    case "undo":
      return track("billing.scheduled_change_undone", context, { plan, change: result.change ?? "cancel" });
  }
}

async function manageAction(
  action: ManageAction,
  input: unknown,
  run: (organizationId: string) => Promise<ManageResult>,
): Promise<ActionResult<ManageResult>> {
  return runAction(`billing.${action}`, async () => {
    // Owner only. No `write: true`: billing must stay manageable while the workspace is over its seat limit.
    const ctx = await requireOrg({ role: "owner" });
    parseInput(noInput, input);
    await enforceRateLimit(`billing-manage:${ctx.organization.id}`, { limit: 20, windowSeconds: 3600 });
    const target = ctx.subscription?.paddleSubscriptionId ? `subscription:${ctx.subscription.paddleSubscriptionId}` : null;
    const actor = { type: "user", id: ctx.user.id } as const;

    let result: ManageResult;
    try {
      result = await run(ctx.organization.id);
    } catch (error) {
      // Paddle did not answer: the request may or may not have been applied. Leave a trace of the attempt.
      if (error instanceof BillingManageError && error.reason === "paddle_unavailable") {
        await recordAudit({ organizationId: ctx.organization.id, actor, action: AUDIT_ACTION[action], target, metadata: { outcome: "unconfirmed" } });
      }
      throw error;
    }

    await recordAudit({
      organizationId: ctx.organization.id,
      actor,
      action: AUDIT_ACTION[action],
      target,
      metadata: { step: result.step, change: result.change, effectiveAt: result.effectiveAt, plan: result.planKey },
    });
    await trackManage(ctx, result);
    return result;
  });
}

/** Pauses the subscription at the end of the paid period (owner only). Refused during a trial and while past due. */
export async function pauseSubscriptionAction(input?: unknown): Promise<ActionResult<ManageResult>> {
  return manageAction("pause", input, (organizationId) => pauseSubscription(organizationId));
}

/** Removes a scheduled pause, or resumes a paused subscription immediately — Paddle then charges the card at once (owner only). */
export async function resumeSubscriptionAction(input?: unknown): Promise<ActionResult<ManageResult>> {
  return manageAction("resume", input, (organizationId) => resumeSubscription(organizationId));
}

/** Cancels at the end of the paid period or trial; immediately for a paused or past-due subscription (owner only). */
export async function cancelSubscriptionAction(input?: unknown): Promise<ActionResult<ManageResult>> {
  return manageAction("cancel", input, (organizationId) => cancelSubscription(organizationId));
}

/** Removes a scheduled cancellation or pause: the subscription continues (owner only). */
export async function undoScheduledChangeAction(input?: unknown): Promise<ActionResult<ManageResult>> {
  return manageAction("undo", input, (organizationId) => undoScheduledChange(organizationId));
}

export type OneOffCheckoutParams = {
  kind: OneOffKind;
  /** "Bid Pass" */
  label: string;
  priceId: string;
  quantity: 1;
  customerEmail: string;
  /** Signed by the server for this workspace and this buyer; the webhook records the purchase only with a valid signature. */
  customData: SignedCheckoutData;
  /** What Paddle.js needs to open the overlay: `initializePaddle({ environment, token: clientToken })`. */
  paddle: { environment: "sandbox" | "production"; clientToken: string };
};

const oneOffCheckoutSchema = z.strictObject({ kind: z.enum(ONE_OFF_KINDS) });

/**
 * Prepares the overlay checkout of a one-off product for the ACTIVE workspace (owners and
 * admins). Open it exactly like a plan checkout:
 *
 *   paddle.Checkout.open({ items: [{ priceId, quantity }], customer: { email: customerEmail }, customData, settings })
 *
 * The purchase exists only once Paddle's `transaction.completed` webhook has been processed.
 */
export async function startOneOffCheckoutAction(input: unknown): Promise<ActionResult<OneOffCheckoutParams>> {
  return runAction("billing.start_one_off_checkout", async () => {
    const ctx = await requireOrg({ role: "admin" });
    const { kind } = parseInput(oneOffCheckoutSchema, input);
    // Do not sell what cannot be used: a workspace over its seat limit is read-only.
    assertWorkspaceWritable(ctx);
    const clientToken = env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!features.paddleCheckout || !clientToken) throw new BillingNotConfiguredError();
    const priceId = getOneOffPriceId(kind);
    if (!priceId) throw new BillingNotConfiguredError();
    await enforceRateLimit(`checkout-one-off:${ctx.organization.id}`, { limit: 20, windowSeconds: 3600 });
    await track("billing.one_off_checkout_started", { organizationId: ctx.organization.id, userId: ctx.user.id }, { kind });
    return {
      kind,
      label: ONE_OFF_PRODUCTS[kind].label,
      priceId,
      quantity: 1,
      customerEmail: ctx.user.email,
      customData: signCheckoutData({ organizationId: ctx.organization.id, userId: ctx.user.id }),
      paddle: { environment: env.PADDLE_ENV, clientToken },
    };
  });
}
