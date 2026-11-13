"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { track } from "@/lib/analytics";
import { auth } from "@/lib/auth";
import { ValidationError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseInput } from "@/lib/validation";
import { runAction, type ActionResult } from "../http";
import { requireOrg, requireUser } from "../session";
import { deleteAccount, deleteWorkspace, planAccountDeletion, type AccountDeletionPlan } from "../tenant-data";

/**
 * Permanently deletes the ACTIVE workspace with all of its data and files (owner only).
 * The caller must type the workspace's exact name. Refused while a subscription is live.
 */
export async function deleteWorkspaceAction(input: unknown): Promise<ActionResult<{ files: number }>> {
  return runAction("workspace.delete", async () => {
    const ctx = await requireOrg({ role: "owner" });
    const { confirmName } = parseInput(z.object({ confirmName: z.string().max(200) }), input);
    if (confirmName.trim() !== ctx.organization.name.trim()) {
      throw new ValidationError("Type the workspace name exactly to confirm.", { confirmName: ["The name does not match."] });
    }
    await enforceRateLimit(`workspace-delete:${ctx.user.id}`, { limit: 10, windowSeconds: 3600 });
    const result = await deleteWorkspace(ctx.organization.id);
    await track("workspace.deleted", { userId: ctx.user.id }, { files: result.files });
    return result;
  });
}

/** What deleting the signed-in user's account would remove, and anything that blocks it. */
export async function previewAccountDeletionAction(): Promise<ActionResult<AccountDeletionPlan>> {
  return runAction("account.preview_delete", async () => {
    const user = await requireUser();
    return planAccountDeletion(user.id);
  });
}

/**
 * Permanently deletes the signed-in user's account. The caller must type their e-mail
 * address and — when the account has a password — enter it, so a borrowed session alone is
 * not enough. Refused while they are the only owner of a workspace that has other members
 * or a live subscription.
 */
export async function deleteAccountAction(input: unknown): Promise<ActionResult<{ workspacesDeleted: number }>> {
  return runAction("account.delete", async () => {
    const user = await requireUser();
    const { confirmEmail, password } = parseInput(z.object({ confirmEmail: z.string().max(320), password: z.string().max(128).optional() }), input);
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new ValidationError("Type your email address exactly to confirm.", { confirmEmail: ["The address does not match."] });
    }
    await enforceRateLimit(`account-delete:${user.id}`, { limit: 5, windowSeconds: 900 });

    const [credential] = await db
      .select({ password: accounts.password })
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")));
    if (credential?.password) {
      const context = await auth.$context;
      const valid = Boolean(password) && (await context.password.verify({ hash: credential.password, password: password! }));
      if (!valid) throw new ValidationError("Enter your current password to confirm.", { password: ["Wrong password."] });
    }
    return deleteAccount(user.id);
  });
}
