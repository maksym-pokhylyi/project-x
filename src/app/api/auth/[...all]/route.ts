import { toNextJsHandler } from "better-auth/next-js";
import { createHash } from "node:crypto";
import { auth } from "@/lib/auth";
import { clientIp, rateLimit, rateLimitHeaders, type RateLimitRule } from "@/lib/rate-limit";

/**
 * Better Auth endpoints (/api/auth/*) behind our Postgres rate limiter.
 *
 * Limits are per client IP and per endpoint group; sign-in is additionally limited per
 * target e-mail so a distributed guess attack on one account is slowed down too.
 * GET endpoints (session reads, e-mail link callbacks with single-use tokens) are not limited.
 */
const handler = toNextJsHandler(auth);

const GROUPS: Array<{ name: string; pattern: RegExp; rule: RateLimitRule }> = [
  { name: "sign-in", pattern: /^\/sign-in\//, rule: { limit: 10, windowSeconds: 60 } },
  { name: "sign-up", pattern: /^\/sign-up\//, rule: { limit: 20, windowSeconds: 3600 } },
  { name: "password-reset", pattern: /^\/(request-password-reset|reset-password)/, rule: { limit: 5, windowSeconds: 900 } },
  { name: "verification", pattern: /^\/send-verification-email/, rule: { limit: 5, windowSeconds: 900 } },
  { name: "invitation", pattern: /^\/organization\/invite-member/, rule: { limit: 30, windowSeconds: 3600 } },
];
const DEFAULT_GROUP = { name: "default", rule: { limit: 120, windowSeconds: 60 } };
const PER_EMAIL_SIGN_IN: RateLimitRule = { limit: 10, windowSeconds: 900 };

function tooManyRequests(result: Awaited<ReturnType<typeof rateLimit>>): Response {
  return Response.json(
    { code: "RATE_LIMITED", message: `Too many attempts. Try again in ${result.retryAfterSeconds} seconds.` },
    { status: 429, headers: rateLimitHeaders(result) },
  );
}

async function signInEmailKey(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    if (typeof body.email !== "string") return null;
    return createHash("sha256").update(body.email.trim().toLowerCase()).digest("hex").slice(0, 32);
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  const group = GROUPS.find((candidate) => candidate.pattern.test(path)) ?? DEFAULT_GROUP;

  const byIp = await rateLimit(`auth:${group.name}:ip:${clientIp(request.headers)}`, group.rule);
  if (!byIp.ok) return tooManyRequests(byIp);

  if (path === "/sign-in/email") {
    const emailKey = await signInEmailKey(request);
    if (emailKey) {
      const byEmail = await rateLimit(`auth:sign-in:email:${emailKey}`, PER_EMAIL_SIGN_IN);
      if (!byEmail.ok) return tooManyRequests(byEmail);
    }
  }
  return handler.POST(request);
}

export const GET = handler.GET;
