import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

/**
 * Small, purpose-separated crypto helpers.
 *
 * Every signed value in the app (sign-up binding cookie, known-device cookie, checkout
 * custom data, dev-tools access) uses its own key derived from one root secret, so a
 * signature made for one purpose can never be replayed for another.
 */
export function derivedKey(purpose: string, rootSecret: string = env.BETTER_AUTH_SECRET): Buffer {
  return createHmac("sha256", rootSecret).update(`derive:${purpose}`).digest();
}

/** HMAC-SHA256 of `message` under the key for `purpose`, base64url-encoded. */
export function sign(purpose: string, message: string, rootSecret?: string): string {
  return createHmac("sha256", derivedKey(purpose, rootSecret)).update(message).digest("base64url");
}

/** Constant-time string comparison (length differences are not secret). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Verifies a signature produced by `sign()` in constant time. */
export function verifySignature(purpose: string, message: string, signature: string, rootSecret?: string): boolean {
  return safeEqual(sign(purpose, message, rootSecret), signature);
}

/** Short, stable, non-reversible key for an e-mail address (rate-limit keys, cookies). */
export function emailKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Reads one cookie from a raw `Cookie` header. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}
