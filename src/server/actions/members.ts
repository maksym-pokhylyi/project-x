"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ConflictError } from "@/lib/errors";
import { inviteSchema, memberRoleSchema, parseInput } from "@/lib/validation";
import { fromAuthError } from "../auth-errors";
import { runAction, type ActionResult } from "../http";
import { getInvitationInOrg, getMemberInOrg } from "../members";
import { requireOrg, requireUser } from "../session";

const idSchema = z.string().min(1).max(64);

/**
 * Member management for the ACTIVE workspace. Each action:
 *  1. takes the workspace from the session (requireOrg) — never from input,
 *  2. checks that the target row belongs to that workspace (404 otherwise),
 *  3. delegates to Better Auth, which enforces role permissions (e.g. admins cannot
 *     remove owners) and the plan's seat limit, and writes the audit entry.
 */
export async function inviteMemberAction(input: unknown): Promise<ActionResult<{ invitationId: string }>> {
  return runAction("member.invite", async () => {
    const ctx = await requireOrg({ role: "admin" });
    const { email, role } = parseInput(inviteSchema, input);
    // The per-workspace invitation limit lives in the Better Auth hook, so the raw endpoint obeys it too.
    try {
      const invitation = await auth.api.createInvitation({
        headers: await headers(),
        body: { email, role, organizationId: ctx.organization.id },
      });
      return { invitationId: invitation.id };
    } catch (error) {
      throw fromAuthError(error, { seatLimit: ctx.entitlements.limits.seats });
    }
  });
}

export async function cancelInvitationAction(input: unknown): Promise<ActionResult> {
  return runAction("member.cancel_invitation", async () => {
    const ctx = await requireOrg({ role: "admin" });
    const invitationId = parseInput(idSchema, input);
    await getInvitationInOrg(ctx, invitationId);
    try {
      await auth.api.cancelInvitation({ headers: await headers(), body: { invitationId } });
    } catch (error) {
      throw fromAuthError(error);
    }
    return undefined;
  });
}

export async function removeMemberAction(input: unknown): Promise<ActionResult> {
  return runAction("member.remove", async () => {
    const ctx = await requireOrg({ role: "admin" });
    const memberId = parseInput(idSchema, input);
    const member = await getMemberInOrg(ctx, memberId);
    if (member.userId === ctx.user.id) throw new ConflictError("You cannot remove yourself. Ask another owner or admin.");
    try {
      await auth.api.removeMember({
        headers: await headers(),
        body: { memberIdOrEmail: memberId, organizationId: ctx.organization.id },
      });
    } catch (error) {
      throw fromAuthError(error);
    }
    return undefined;
  });
}

export async function updateMemberRoleAction(input: unknown): Promise<ActionResult> {
  return runAction("member.update_role", async () => {
    const ctx = await requireOrg({ role: "admin" });
    const { memberId, role } = parseInput(z.object({ memberId: idSchema, role: memberRoleSchema }), input);
    const member = await getMemberInOrg(ctx, memberId);
    if (member.userId === ctx.user.id) throw new ConflictError("You cannot change your own role.");
    try {
      await auth.api.updateMemberRole({
        headers: await headers(),
        body: { memberId, role, organizationId: ctx.organization.id },
      });
    } catch (error) {
      throw fromAuthError(error);
    }
    return undefined;
  });
}

/** Accepts an invitation for the signed-in user and makes that workspace active. */
export async function acceptInvitationAction(input: unknown): Promise<ActionResult> {
  return runAction("member.accept_invitation", async () => {
    await requireUser();
    const invitationId = parseInput(idSchema, input);
    try {
      await auth.api.acceptInvitation({ headers: await headers(), body: { invitationId } });
    } catch (error) {
      throw fromAuthError(error);
    }
    return undefined;
  });
}
