import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { appUrl } from "@/env";
import { readCookie, sha256Hex, sign, verifySignature } from "./crypto";

/**
 * Sign-up binding: proof that THIS browser chose the password of an unverified account.
 *
 * Why: anyone can register someone else's address. Without a binding, the real owner who
 * later clicks a verification link would activate an account whose password is known to
 * whoever registered it first (pre-registration account takeover).
 *
 * How:
 *  - A successful e-mail sign-up sets a signed, HttpOnly cookie that names the created user
 *    and commits to the stored password hash.
 *  - The verification link completes directly only in a browser that presents a matching
 *    cookie (see `beforeEmailVerification` in src/lib/auth.ts).
 *  - Anywhere else the visitor proves control of the mailbox by holding the link, but not
 *    that they chose the password — so they are asked to choose one, which REPLACES the
 *    stored password and revokes every session (see `confirmEmailAction`).
 *
 * The cookie is set on EVERY sign-up response, including the generic "already registered"
 * one (with a decoy signature), so its presence does not reveal whether an address exists.
 */
const PURPOSE = "signup-binding:v1";
const TTL_SECONDS = 25 * 60 * 60; // a little longer than the verification link (24 h)

const secure = appUrl.startsWith("https://");
/** `__Host-` (https only) stops sibling subdomains from planting a binding cookie. */
export const SIGNUP_BINDING_COOKIE = secure ? "__Host-signup-binding" : "signup-binding";

export const signupBindingCookieOptions = {
  httpOnly: true,
  secure,
  // Lax: the cookie must accompany the top-level navigation from the e-mail client.
  sameSite: "lax" as const,
  path: "/",
  maxAge: TTL_SECONDS,
};

function payload(userId: string, expires: number, credentialFingerprint: string): string {
  return `${userId}\n${expires}\n${credentialFingerprint}`;
}

async function credentialFingerprint(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ password: accounts.password })
    .from(accounts)
    .innerJoin(users, eq(users.id, accounts.userId))
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"), eq(users.emailVerified, false)));
  return row?.password ? sha256Hex(row.password) : null;
}

/**
 * Cookie value for the sign-up response. Real when `userId` is an unverified account with
 * a password (i.e. it was just created by this request); otherwise an indistinguishable decoy.
 */
export async function issueSignupBinding(userId: string, now: Date = new Date()): Promise<string> {
  const expires = Math.floor(now.getTime() / 1000) + TTL_SECONDS;
  const fingerprint = (await credentialFingerprint(userId)) ?? `decoy:${randomBytes(32).toString("hex")}`;
  return `v1.${userId}.${expires}.${sign(PURPOSE, payload(userId, expires, fingerprint))}`;
}

/** True when the request carries a valid binding for exactly this user and their current password. */
export async function signupBindingMatches(userId: string, cookieHeader: string | null | undefined, now: Date = new Date()): Promise<boolean> {
  const value = readCookie(cookieHeader, SIGNUP_BINDING_COOKIE);
  if (!value) return false;
  const [version, boundUserId, expiresRaw, signature, ...rest] = value.split(".");
  if (version !== "v1" || rest.length > 0 || !boundUserId || !expiresRaw || !signature) return false;
  if (boundUserId !== userId || !/^\d{1,12}$/.test(expiresRaw)) return false;
  const expires = Number(expiresRaw);
  if (expires * 1000 < now.getTime()) return false;
  const fingerprint = await credentialFingerprint(userId);
  if (!fingerprint) return false;
  return verifySignature(PURPOSE, payload(userId, expires, fingerprint), signature);
}
