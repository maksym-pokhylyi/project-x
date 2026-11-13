import "server-only";
import { unstable_rethrow } from "next/navigation";
import { trustedOrigins } from "@/env";
import { AppError, ForbiddenError, serializeError, type SerializedError } from "@/lib/errors";
import { reportError } from "@/lib/report-error";

/** Correlation id: Vercel's request id when present, otherwise generated. */
export function requestIdFrom(headers: Headers): string {
  return headers.get("x-vercel-id") ?? headers.get("x-request-id") ?? crypto.randomUUID();
}

export function json(body: unknown, init: ResponseInit & { requestId?: string } = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  if (init.requestId) headers.set("x-request-id", init.requestId);
  return Response.json(body, { ...init, headers });
}

type RouteHandler<Context> = (request: Request, context: Context, meta: { requestId: string }) => Promise<Response>;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF check for cookie-authenticated Route Handlers. SameSite=Lax alone is not a complete
 * defence (sibling subdomains, top-level form posts in some browsers), so a state-changing
 * request must come from one of our own origins:
 *  - `Origin` present  -> must be a trusted origin (the same list Better Auth uses);
 *  - no `Origin` but `Sec-Fetch-Site` -> must be same-origin (or a direct navigation);
 *  - neither header -> not a browser (curl, server-to-server): no ambient cookies to abuse.
 */
export function isTrustedRequestOrigin(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const origin = request.headers.get("origin");
  if (origin) return trustedOrigins.includes(origin.replace(/\/+$/, ""));
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

/**
 * Wraps a Route Handler with uniform error handling:
 *  - AppError (expected)  -> its status + `{ error: { code, message, details }, requestId }`
 *  - anything else        -> error_log/Sentry via reportError + a generic 500
 * The request id is echoed in `x-request-id` so users can quote it to support.
 *
 * POST/PUT/PATCH/DELETE requests are refused (403) unless they come from one of our own
 * origins (`isTrustedRequestOrigin`). Pass `{ csrf: false }` only for endpoints that do not
 * rely on the session cookie (webhooks with their own signature).
 */
export function route<Context = unknown>(handler: RouteHandler<Context>, options: { csrf?: boolean } = {}) {
  return async (request: Request, context: Context): Promise<Response> => {
    const requestId = requestIdFrom(request.headers);
    try {
      if (options.csrf !== false && !isTrustedRequestOrigin(request)) throw new ForbiddenError("Cross-site request refused.");
      const response = await handler(request, context, { requestId });
      if (!response.headers.has("x-request-id")) {
        try {
          response.headers.set("x-request-id", requestId);
        } catch {
          // immutable headers (e.g. a redirect Response): fine
        }
      }
      return response;
    } catch (error) {
      unstable_rethrow(error); // let redirect()/notFound()/forbidden() through
      if (error instanceof AppError) {
        return json({ error: serializeError(error), requestId }, { status: error.status, requestId });
      }
      const url = new URL(request.url);
      await reportError(error, { requestId, route: url.pathname, method: request.method });
      return json({ error: serializeError(error), requestId }, { status: 500, requestId });
    }
  };
}

/** Result type returned by every Server Action. */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: SerializedError };

/**
 * Runs a Server Action body with the same error policy as `route()`.
 * Expected errors come back as `{ ok: false, error }`; unexpected ones are reported
 * and returned as a generic INTERNAL error (never leaking details to the client).
 */
export async function runAction<T>(name: string, body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await body() };
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof AppError)) await reportError(error, { route: `action:${name}` });
    return { ok: false, error: serializeError(error) };
  }
}
