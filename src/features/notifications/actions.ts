"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { features } from "@/env";
import { track } from "@/lib/analytics";
import { sendEmail } from "@/lib/email/send";
import { AppError, ForbiddenError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseInput } from "@/lib/validation";
import { runAction, type ActionResult } from "@/server/http";
import { requireAdmin, requireOrg } from "@/server/session";
import { SCHEDULED_KINDS } from "./config";
import { getNotificationPrefs, kindsTurnedOff, resubscribe, updateNotificationPrefs, type PrefKey } from "./prefs";
import { buildPreview } from "./preview";

/**
 * Server Actions of the notifications module.
 *
 * Settings → Notifications: the member and the workspace always come from the session
 * (requireOrg) — a member changes their own preferences for the workspace they are in,
 * nobody else's. The preview action is for the founder (requireAdmin).
 */
const prefsSchema = z
  .object({
    weeklyDigest: z.boolean().optional(),
    dailyAlerts: z.boolean().optional(),
    deadlineReminders: z.boolean().optional(),
    productEmails: z.boolean().optional(),
    renewalReminders: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), "Nothing to change.");

export type NotificationPrefsState = Record<PrefKey, boolean> & { unsubscribedAll: boolean };

const SETTINGS_PATH = "/app/settings/notifications";

async function currentState(userId: string, organizationId: string): Promise<NotificationPrefsState> {
  const { unsubscribedAllAt, ...switches } = await getNotificationPrefs(userId, organizationId);
  return { ...switches, unsubscribedAll: unsubscribedAllAt !== null };
}

/** Flips one or more switches. Takes effect with the next e-mail; nothing already queued is recalled. */
export async function updateNotificationPrefsAction(input: unknown): Promise<ActionResult<NotificationPrefsState>> {
  return runAction("notifications.prefs.update", async () => {
    const ctx = await requireOrg();
    const changes = parseInput(prefsSchema, input);
    // The renewal reminder goes to owners only; so does its switch.
    if (changes.renewalReminders !== undefined && ctx.role !== "owner") throw new ForbiddenError("Only a workspace owner gets the renewal reminder.");

    const { before, after } = await updateNotificationPrefs(ctx.user.id, ctx.organization.id, changes);
    for (const kind of kindsTurnedOff(before, after)) {
      await track("notification_unsubscribed", { organizationId: ctx.organization.id, userId: ctx.user.id }, { kind, scope: "kind", via: "settings" });
    }
    revalidatePath(SETTINGS_PATH);
    return currentState(ctx.user.id, ctx.organization.id);
  });
}

const previewSchema = z.object({
  organizationId: z.string().min(1).max(64),
  kind: z.enum(SCHEDULED_KINDS),
  mode: z.enum(["auto", "live", "sample"]).default("auto"),
});

export type PreviewActionResult =
  | { status: "sent"; workspace: string; mode: "live" | "sample"; to: string; delivery: "resend" | "outbox" }
  | { status: "empty"; workspace: string; reason: string };

/**
 * /admin → "Send me a preview" (founder only): renders the e-mail a workspace would get and
 * sends it to the admin's OWN address — or, without a mail provider, to the dev outbox.
 * Nobody in the workspace is e-mailed and nothing is written to notification_log.
 */
export async function sendNotificationPreviewAction(input: unknown): Promise<ActionResult<PreviewActionResult>> {
  return runAction("notifications.preview", async () => {
    const admin = await requireAdmin();
    const { organizationId, kind, mode } = parseInput(previewSchema, input);
    await enforceRateLimit(`notifications-preview:${admin.id}`, { limit: 30, windowSeconds: 3600 });
    if (features.mailDelivery === "none") throw new AppError("CONFLICT", "This deployment has no way to deliver e-mail (no provider, no dev outbox).", 409);
    const preview = await buildPreview(organizationId, kind, { mode, recipientName: admin.name });
    if (preview.status === "empty") return { status: "empty", workspace: preview.workspace, reason: preview.reason };
    await sendEmail(admin.email, preview.email.template);
    return { status: "sent", workspace: preview.workspace, mode: preview.mode, to: admin.email, delivery: features.mailDelivery };
  });
}

/** "Turn emails back on" after an unsubscribe from everything: the switches apply again. */
export async function resubscribeAction(): Promise<ActionResult<NotificationPrefsState>> {
  return runAction("notifications.prefs.resubscribe", async () => {
    const ctx = await requireOrg();
    await resubscribe(ctx.user.id, ctx.organization.id);
    revalidatePath(SETTINGS_PATH);
    return currentState(ctx.user.id, ctx.organization.id);
  });
}
