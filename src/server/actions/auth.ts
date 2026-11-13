"use server";

import { verifyJWT } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { accounts, sessions, users } from "@/db/schema";
import { env } from "@/env";
import { track } from "@/lib/analytics";
import { auth } from "@/lib/auth";
import { ConflictError, ValidationError } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { safeRedirect } from "@/lib/redirects";
import { parseInput, passwordSchema } from "@/lib/validation";
import { runAction, type ActionResult } from "../http";

const confirmEmailSchema = z.object({
  token: z.string().min(20).max(4096),
  password: passwordSchema,
  redirect: z.string().max(2048).optional(),
});

const INVALID_LINK = "This verification link is invalid or has expired. Sign in to receive a new one.";

/**
 * Completes e-mail verification for a visitor who opened the link WITHOUT the sign-up
 * binding cookie (another device, another person's earlier registration, a second sign-up).
 *
 * Holding the link proves control of the mailbox; it does not prove that this person chose
 * the password stored on the account. So the password they choose here REPLACES it, every
 * existing session is revoked, and only then is the address marked verified — a password
 * set by anyone else never survives verification.
 *
 * The link stops working for this purpose the moment the account is verified, so it cannot
 * be replayed later to change a password.
 */
export async function confirmEmailAction(input: unknown): Promise<ActionResult<{ redirectTo: string; signedIn: boolean }>> {
  return runAction("auth.confirm_email", async () => {
    const requestHeaders = await headers();
    await enforceRateLimit(`auth:confirm-email:ip:${clientIp(requestHeaders)}`, { limit: 10, windowSeconds: 900 });
    const { token, password, redirect } = parseInput(confirmEmailSchema, input);

    const payload = (await verifyJWT(token, env.BETTER_AUTH_SECRET)) as { email?: unknown; userId?: unknown; updateTo?: unknown } | null;
    if (!payload || typeof payload.email !== "string" || payload.updateTo !== undefined) throw new ValidationError(INVALID_LINK);
    const email = payload.email.toLowerCase();

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user || (typeof payload.userId === "string" && payload.userId !== user.id)) throw new ValidationError(INVALID_LINK);
    if (user.emailVerified) {
      throw new ConflictError("This email address is already confirmed. Sign in, or reset your password if you do not know it.");
    }

    const context = await auth.$context;
    const hash = await context.password.hash(password);
    const now = new Date();
    await db.transaction(async (tx) => {
      // Conditional on "still unverified": two concurrent confirmations cannot both win.
      const verified = await tx
        .update(users)
        .set({ emailVerified: true })
        .where(and(eq(users.id, user.id), eq(users.emailVerified, false)))
        .returning({ id: users.id });
      if (verified.length === 0) throw new ConflictError("This email address is already confirmed. Sign in to continue.");
      await tx.delete(sessions).where(eq(sessions.userId, user.id));
      const replaced = await tx
        .update(accounts)
        .set({ password: hash })
        .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")))
        .returning({ id: accounts.id });
      if (replaced.length === 0) {
        await tx.insert(accounts).values({ id: newId(), accountId: user.id, providerId: "credential", userId: user.id, password: hash, createdAt: now, updatedAt: now });
      }
    });
    await track("user.email_verified", { userId: user.id });

    // Best effort: start a session with the password that was just chosen.
    let signedIn = false;
    try {
      await auth.api.signInEmail({ body: { email, password }, headers: requestHeaders });
      signedIn = true;
    } catch {
      signedIn = false;
    }
    const target = safeRedirect(redirect);
    return { redirectTo: signedIn ? target : `/sign-in?redirect=${encodeURIComponent(target)}`, signedIn };
  });
}
