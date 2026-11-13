import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { analyticsOriginsFromEnv, buildContentSecurityPolicy, createNonce } from "@/lib/csp";

/**
 * Runs before the dynamic document routes (see `config.matcher`). Two jobs:
 *
 * 1. Optimistic redirect for signed-out visitors of /app and /admin: if there is no
 *    session cookie at all, go straight to /sign-in without rendering anything.
 *    This is a UX shortcut, NOT the security boundary — a cookie can be forged. Every page,
 *    Server Action and Route Handler validates the session against the database through
 *    requireUser()/requireOrg() in src/server/session.ts.
 *
 * 2. A per-request Content-Security-Policy NONCE (src/lib/csp.ts). The policy is put on
 *    the REQUEST headers — Next.js reads the nonce from there and stamps it on every script
 *    it renders — and on the response, where it replaces the static policy from
 *    next.config.ts. On these pages an injected inline script does not run.
 */
const PROTECTED = /^\/(app|admin)(\/|$)/;

const isDevelopment = process.env.NODE_ENV === "development";
const upgradeInsecureRequests = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://") || Boolean(process.env.VERCEL);
const analyticsOrigins = analyticsOriginsFromEnv(process.env.NEXT_PUBLIC_POSTHOG_KEY, process.env.NEXT_PUBLIC_POSTHOG_HOST);

export function proxy(request: NextRequest) {
  if (PROTECTED.test(request.nextUrl.pathname) && !getSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signIn);
  }

  const nonce = createNonce();
  const policy = buildContentSecurityPolicy({ nonce, isDevelopment, upgradeInsecureRequests, analyticsOrigins });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", policy);
  return response;
}

export const config = {
  // Every dynamically rendered page. Static pages (marketing, legal, /forgot-password) are
  // prerendered and cannot carry a nonce: they keep the static policy from next.config.ts.
  matcher: [
    "/app/:path*",
    "/admin/:path*",
    "/sign-in",
    "/sign-up",
    "/verify-email/:path*",
    "/reset-password",
    "/accept-invitation/:path*",
    "/unsubscribe",
    "/dev/:path*",
    // Paddle's default payment link: loads Paddle.js, so it gets the strict (nonce) policy.
    "/pay",
  ],
};
