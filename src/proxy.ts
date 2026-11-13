import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect for signed-out visitors of /app and /admin: if there is no
 * session cookie at all, go straight to /sign-in without rendering anything.
 *
 * This is a UX shortcut, NOT the security boundary — a cookie can be forged. Every page,
 * Server Action and Route Handler validates the session against the database through
 * requireUser()/requireOrg() in src/server/session.ts.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
