"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { parseInput, profileSchema } from "@/lib/validation";
import { fromAuthError } from "../auth-errors";
import { runAction, type ActionResult } from "../http";
import { requireUser } from "../session";

export async function updateProfileAction(input: unknown): Promise<ActionResult<{ name: string }>> {
  return runAction("profile.update", async () => {
    await requireUser();
    const { name } = parseInput(profileSchema, input);
    try {
      await auth.api.updateUser({ headers: await headers(), body: { name } });
    } catch (error) {
      throw fromAuthError(error);
    }
    return { name };
  });
}
