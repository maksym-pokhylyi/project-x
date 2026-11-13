import "server-only";
import { randomBytes } from "node:crypto";
import { env } from "@/env";
import { sign, verifySignature } from "@/lib/crypto";

/**
 * Server-signed checkout data.
 *
 * Paddle echoes the `customData` of a checkout back in its webhooks, and that is how a
 * payment is tied to a workspace. But the checkout is opened by the BROWSER (the client
 * token and price ids are public), so anything in `customData` can be forged from a
 * console: "this subscription belongs to workspace X". Therefore the server signs
 *
 *     organization_id · user_id · issued_at · nonce
 *
 * when the workspace's owner starts a checkout, and the webhook accepts a workspace named
 * in custom data only when the signature is valid for exactly that workspace. The nonce
 * makes the signed data single-use (one nonce can bind one subscription) and `issued_at`
 * bounds how long it can be used to attach a NEW subscription.
 *
 * Secret: BILLING_SIGNING_SECRET, or a key derived from BETTER_AUTH_SECRET when unset.
 */
const PURPOSE = "billing-checkout:v1";

/** How long after signing a checkout may still attach a new subscription (by the event's own timestamp). */
export const CHECKOUT_MAX_AGE_SECONDS = 24 * 60 * 60;
/** Tolerated clock difference between our signature and Paddle's `occurred_at`. */
export const CHECKOUT_CLOCK_SKEW_SECONDS = 10 * 60;

export type SignedCheckoutData = {
  organization_id: string;
  user_id: string;
  /** Unix seconds, as a string. */
  issued_at: string;
  nonce: string;
  sig: string;
};

export type CheckoutVerification =
  | { ok: true; organizationId: string; userId: string; issuedAt: Date; nonce: string }
  | { ok: false; reason: "absent" | "unsigned" | "malformed" | "bad_signature" };

const FIELD = /^[A-Za-z0-9_-]{1,128}$/;

const rootSecret = () => env.BILLING_SIGNING_SECRET ?? env.BETTER_AUTH_SECRET;
const message = (organizationId: string, userId: string, issuedAt: string, nonce: string) => `${organizationId}\n${userId}\n${issuedAt}\n${nonce}`;

/** Custom data for a checkout started by `userId` (an owner) for `organizationId`. Values come from the session. */
export function signCheckoutData(input: { organizationId: string; userId: string; issuedAt?: Date; nonce?: string }): SignedCheckoutData {
  const issuedAt = String(Math.floor((input.issuedAt ?? new Date()).getTime() / 1000));
  const nonce = input.nonce ?? randomBytes(16).toString("hex");
  if (![input.organizationId, input.userId, nonce].every((value) => FIELD.test(value))) {
    throw new Error("checkout data contains characters that cannot be signed");
  }
  return {
    organization_id: input.organizationId,
    user_id: input.userId,
    issued_at: issuedAt,
    nonce,
    sig: sign(PURPOSE, message(input.organizationId, input.userId, issuedAt, nonce), rootSecret()),
  };
}

/**
 * Checks custom data echoed by Paddle. Only `ok: true` may be used to decide which
 * workspace an event belongs to; freshness and single use are checked by the caller.
 */
export function verifyCheckoutData(customData: Record<string, unknown> | null | undefined): CheckoutVerification {
  const organizationId = customData?.organization_id;
  if (organizationId === undefined || organizationId === null || organizationId === "") return { ok: false, reason: "absent" };
  const { user_id: userId, issued_at: issuedAt, nonce, sig } = customData ?? {};
  if (sig === undefined || sig === null) return { ok: false, reason: "unsigned" };
  if (
    typeof organizationId !== "string" ||
    typeof userId !== "string" ||
    typeof issuedAt !== "string" ||
    typeof nonce !== "string" ||
    typeof sig !== "string" ||
    ![organizationId, userId, nonce].every((value) => FIELD.test(value)) ||
    !/^\d{1,12}$/.test(issuedAt) ||
    !/^[A-Za-z0-9_-]{20,128}$/.test(sig)
  ) {
    return { ok: false, reason: "malformed" };
  }
  if (!verifySignature(PURPOSE, message(organizationId, userId, issuedAt, nonce), sig, rootSecret())) return { ok: false, reason: "bad_signature" };
  return { ok: true, organizationId, userId, issuedAt: new Date(Number(issuedAt) * 1000), nonce };
}
