import "server-only";
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { isNotificationKind, type NotificationKind } from "./config";

/**
 * Unsubscribe tokens.
 *
 * A token names one (user, workspace, kind) and carries an HMAC-SHA256 over exactly that.
 * It is the whole credential of the unsubscribe link: no session, no database row, and it
 * does not expire — the link in a two-year-old e-mail must still work.
 *
 * What it can do: turn e-mails OFF for the member it names, for anyone who holds it. That
 * is deliberate (an unsubscribe is honoured generously, RFC 8058 clients send no cookies)
 * and harmless: nothing is revealed and the member can switch things back on in Settings.
 *
 * What it can do only for the address it was sent to: the token also carries a short keyed
 * tag of the recipient's address. The confirmation page prints the address, and offers
 * "Subscribe again", only while that tag still matches the address on the account. So a
 * link left behind in an old mailbox (a previous employer's, say) never shows the address
 * the person uses now and never switches e-mails back ON.
 *
 * Keys: HKDF-SHA256 over BETTER_AUTH_SECRET with fixed context labels, so each key is used
 * for one thing only and no new environment variable is needed. Rotating
 * BETTER_AUTH_SECRET invalidates links in e-mails already sent; the page then points to
 * Settings.
 *
 *   token = base64url(user \n workspace \n kind [\n address-tag]) "." base64url(HMAC)
 */
const CONTEXT = "bidfolio:notifications:unsubscribe:v1";
const ADDRESS_CONTEXT = "bidfolio:notifications:unsubscribe-address:v1";
const SALT = "bidfolio:hkdf:v1";
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const TAG = /^[A-Za-z0-9_-]{11}$/;
const TOKEN = /^[A-Za-z0-9_-]{8,400}\.[A-Za-z0-9_-]{43}$/;

let cachedKeys: { secret: string; signing: Buffer; address: Buffer } | null = null;

function keys() {
  const secret = env.BETTER_AUTH_SECRET;
  if (cachedKeys?.secret !== secret) {
    const derive = (context: string) => Buffer.from(hkdfSync("sha256", secret, SALT, context, 32));
    cachedKeys = { secret, signing: derive(CONTEXT), address: derive(ADDRESS_CONTEXT) };
  }
  return cachedKeys;
}

const mac = (payload: string) => createHmac("sha256", keys().signing).update(`${CONTEXT}\n${payload}`).digest();

/** 64 bits of a keyed hash of the address: enough to tell "same address" apart, useless for guessing one. */
function addressTag(email: string): string {
  return createHmac("sha256", keys().address).update(email.trim().toLowerCase()).digest().subarray(0, 8).toString("base64url");
}

export type UnsubscribeSubject = { userId: string; organizationId: string; kind: NotificationKind };

/** What a valid token says. `addressTag` is null for a token issued without an address. */
export type VerifiedUnsubscribe = UnsubscribeSubject & { addressTag: string | null };

/** `email`: the address the e-mail goes to (see above). */
export function signUnsubscribeToken(subject: UnsubscribeSubject & { email?: string | null }): string {
  if (!ID.test(subject.userId) || !ID.test(subject.organizationId) || !isNotificationKind(subject.kind)) {
    throw new Error("unsubscribe token: ids contain characters that cannot be signed");
  }
  const parts = [subject.userId, subject.organizationId, subject.kind];
  if (subject.email) parts.push(addressTag(subject.email));
  const payload = parts.join("\n");
  return `${Buffer.from(payload).toString("base64url")}.${mac(payload).toString("base64url")}`;
}

/** The subject of a token whose signature is ours; null for anything else. Constant-time, no database. */
export function verifyUnsubscribeToken(token: unknown): VerifiedUnsubscribe | null {
  if (typeof token !== "string" || !TOKEN.test(token)) return null;
  const [encoded, signature] = token.split(".") as [string, string];
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const given = Buffer.from(signature, "base64url");
  const expected = mac(payload);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const [userId, organizationId, kind, tag, ...rest] = payload.split("\n");
  if (rest.length > 0 || !userId || !organizationId || !ID.test(userId) || !ID.test(organizationId) || !isNotificationKind(kind)) return null;
  if (tag !== undefined && !TAG.test(tag)) return null;
  // Reject a second encoding of the same payload (padding, alternative alphabets).
  if (Buffer.from(payload).toString("base64url") !== encoded) return null;
  return { userId, organizationId, kind, addressTag: tag ?? null };
}

/** True when the token was issued for an e-mail sent to `email`. */
export function tokenNamesAddress(verified: Pick<VerifiedUnsubscribe, "addressTag">, email: string | null | undefined): boolean {
  if (!verified.addressTag || !email) return false;
  const given = Buffer.from(verified.addressTag);
  const expected = Buffer.from(addressTag(email));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
