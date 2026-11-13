import "server-only";
import { appUrl, env } from "@/env";
import { emailKey, readCookie, sign, verifySignature } from "./crypto";
import { clientIp, peekRateLimit, rateLimit, rateLimitHeaders, type RateLimitResult, type RateLimitRule } from "./rate-limit";

/**
 * Guard in front of the Better Auth POST endpoints (/api/auth/*): our Postgres rate
 * limiter, used by src/app/api/auth/[...all]/route.ts.
 *
 *  - Per client IP and endpoint group (below).
 *  - Sign-in, per (e-mail, IP) PAIR: 10 attempts / 15 min. Keyed on the pair so that an
 *    outsider hammering someone's address only ever locks out themselves.
 *  - Sign-in, per e-mail: a high ceiling on FAILED attempts (100 / hour) bounds a
 *    distributed guessing attack. It never applies to a browser that has signed in to that
 *    account before (signed "known device" cookie), so the real owner cannot be locked out
 *    of their usual device by other people's failures.
 *  - E-mail-sending endpoints, per target address: 5 / hour, so nobody's inbox can be
 *    flooded with verification, reset or "account exists" mail through us.
 *  - Password-reset and sign-up responses take a minimum time, so their duration does not
 *    reveal whether an address is registered.
 * GET endpoints (session reads, e-mail link callbacks with single-use tokens) are not limited.
 */
const GROUPS: Array<{ name: string; pattern: RegExp; rule: RateLimitRule }> = [
  { name: "sign-in", pattern: /^\/sign-in\//, rule: { limit: 10, windowSeconds: 60 } },
  { name: "sign-up", pattern: /^\/sign-up\//, rule: { limit: 20, windowSeconds: 3600 } },
  { name: "password-reset", pattern: /^\/(request-password-reset|reset-password)/, rule: { limit: 5, windowSeconds: 900 } },
  { name: "verification", pattern: /^\/send-verification-email/, rule: { limit: 5, windowSeconds: 900 } },
  { name: "invitation", pattern: /^\/organization\/invite-member/, rule: { limit: 30, windowSeconds: 3600 } },
];
const DEFAULT_GROUP = { name: "default", rule: { limit: 120, windowSeconds: 60 } };

export const SIGN_IN_PER_PAIR: RateLimitRule = { limit: 10, windowSeconds: 900 };
export const SIGN_IN_FAILURES_PER_EMAIL: RateLimitRule = { limit: 100, windowSeconds: 3600 };
export const MAIL_PER_ADDRESS: RateLimitRule = { limit: 5, windowSeconds: 3600 };
const MAIL_PATHS = new Set(["/request-password-reset", "/send-verification-email", "/sign-up/email"]);

/** Minimum response time (ms) of endpoints whose work differs between known and unknown addresses. */
const MINIMUM_DURATION_MS: Record<string, number> = { "/request-password-reset": 600, "/sign-up/email": 800 };

// --- "known device" cookie --------------------------------------------------------------

const KNOWN_DEVICE_PURPOSE = "known-device:v1";
const secure = appUrl.startsWith("https://");
export const KNOWN_DEVICE_COOKIE = secure ? "__Host-known-device" : "known-device";
const KNOWN_DEVICE_MAX_AGE = 180 * 24 * 60 * 60;

/** Cookie value proving that this browser completed a sign-in for the address before. */
export function knownDeviceValue(emailHash: string): string {
  return `v1.${emailHash}.${sign(KNOWN_DEVICE_PURPOSE, emailHash)}`;
}

function isKnownDevice(request: Request, emailHash: string): boolean {
  const value = readCookie(request.headers.get("cookie"), KNOWN_DEVICE_COOKIE);
  if (!value) return false;
  const [version, boundHash, signature, ...rest] = value.split(".");
  if (version !== "v1" || rest.length > 0 || !boundHash || !signature || boundHash !== emailHash) return false;
  return verifySignature(KNOWN_DEVICE_PURPOSE, emailHash, signature);
}

function withKnownDeviceCookie(response: Response, emailHash: string): Response {
  const headers = new Headers(response.headers);
  headers.append(
    "set-cookie",
    `${KNOWN_DEVICE_COOKIE}=${knownDeviceValue(emailHash)}; Max-Age=${KNOWN_DEVICE_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// ----------------------------------------------------------------------------------------

function tooManyRequests(result: RateLimitResult): Response {
  return Response.json(
    { code: "RATE_LIMITED", message: `Too many attempts. Try again in ${result.retryAfterSeconds} seconds.` },
    { status: 429, headers: rateLimitHeaders(result) },
  );
}

async function targetEmailKey(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    if (typeof body.email !== "string" || body.email.length > 320) return null;
    return emailKey(body.email);
  } catch {
    return null;
  }
}

/** Resolves no earlier than `minimumMs` after `started` (no-op in tests, which measure nothing). */
async function padDuration(started: number, minimumMs: number | undefined): Promise<void> {
  if (!minimumMs || env.NODE_ENV === "test") return;
  const remaining = minimumMs - (Date.now() - started);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export async function guardedAuthPost(request: Request, handle: (request: Request) => Promise<Response>): Promise<Response> {
  const started = Date.now();
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  const group = GROUPS.find((candidate) => candidate.pattern.test(path)) ?? DEFAULT_GROUP;
  const ip = clientIp(request.headers);

  const byIp = await rateLimit(`auth:${group.name}:ip:${ip}`, group.rule);
  if (!byIp.ok) return tooManyRequests(byIp);

  if (path === "/sign-in/email") {
    const emailHash = await targetEmailKey(request);
    if (!emailHash) return handle(request);

    const byPair = await rateLimit(`auth:sign-in:pair:${emailHash}:${ip}`, SIGN_IN_PER_PAIR);
    if (!byPair.ok) return tooManyRequests(byPair);

    const failuresKey = `auth:sign-in:failures:${emailHash}`;
    if (!isKnownDevice(request, emailHash)) {
      const failures = await peekRateLimit(failuresKey, SIGN_IN_FAILURES_PER_EMAIL);
      if (!failures.ok) return tooManyRequests(failures);
    }

    const response = await handle(request);
    if (response.status === 401) await rateLimit(failuresKey, SIGN_IN_FAILURES_PER_EMAIL);
    return response.status === 200 ? withKnownDeviceCookie(response, emailHash) : response;
  }

  if (MAIL_PATHS.has(path)) {
    const emailHash = await targetEmailKey(request);
    if (emailHash) {
      const byAddress = await rateLimit(`auth:mail:${emailHash}`, MAIL_PER_ADDRESS);
      if (!byAddress.ok) return tooManyRequests(byAddress);
    }
  }

  const response = await handle(request);
  await padDuration(started, MINIMUM_DURATION_MS[path]);
  return response;
}
