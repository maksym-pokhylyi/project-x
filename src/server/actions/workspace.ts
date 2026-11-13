"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { shortToken, slugify } from "@/lib/ids";
import { parseInput, workspaceSchema } from "@/lib/validation";
import { z } from "zod";
import { fromAuthError } from "../auth-errors";
import { runAction, type ActionResult } from "../http";
import { requireOrg, requireUser } from "../session";

/** Renames the active workspace. Admins and owners. */
export async function updateWorkspaceAction(input: unknown): Promise<ActionResult<{ name: string }>> {
  return runAction("workspace.update", async () => {
    const ctx = await requireOrg({ role: "admin" });
    const { name } = parseInput(workspaceSchema, input);
    try {
      await auth.api.updateOrganization({
        headers: await headers(),
        body: { organizationId: ctx.organization.id, data: { name } },
      });
    } catch (error) {
      throw fromAuthError(error);
    }
    return { name };
  });
}

/** Creates an additional workspace owned by the current user and switches to it. */
export async function createWorkspaceAction(input: unknown): Promise<ActionResult<{ organizationId: string }>> {
  return runAction("workspace.create", async () => {
    await requireUser();
    const { name } = parseInput(workspaceSchema, input);
    try {
      const organization = await auth.api.createOrganization({
        headers: await headers(),
        body: { name, slug: `${slugify(name, 30)}-${shortToken(4)}` },
      });
      return { organizationId: organization.id };
    } catch (error) {
      throw fromAuthError(error);
    }
  });
}

/** Switches the session's active workspace. Better Auth verifies membership. */
export async function switchWorkspaceAction(input: unknown): Promise<ActionResult<{ organizationId: string }>> {
  return runAction("workspace.switch", async () => {
    await requireUser();
    const { organizationId } = parseInput(z.object({ organizationId: z.string().min(1).max(64) }), input);
    try {
      await auth.api.setActiveOrganization({ headers: await headers(), body: { organizationId } });
    } catch (error) {
      throw fromAuthError(error);
    }
    return { organizationId };
  });
}
