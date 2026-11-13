import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { guardedAuthPost } from "@/lib/auth-guard";

/**
 * Better Auth endpoints (/api/auth/*). Every POST goes through the rate limiter in
 * src/lib/auth-guard.ts (per IP, per e-mail + IP pair for sign-in, per target address for
 * endpoints that send e-mail). GET endpoints (session reads, e-mail link callbacks with
 * single-use tokens) are not limited.
 */
const handler = toNextJsHandler(auth);

export async function POST(request: Request): Promise<Response> {
  return guardedAuthPost(request, handler.POST);
}

export const GET = handler.GET;
