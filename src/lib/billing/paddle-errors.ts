import { errorReason } from "@/lib/describe-error";

/**
 * Reading a failed Paddle API call.
 *
 * The SDK throws `ApiError` for an error response: `{ type, code, detail, status }` (its
 * `name` is plain "Error"). Verified against the sandbox API: an unknown subscription or
 * transaction id answers 404 with code `invalid_url` ("URL called is invalid."), a missing
 * invoice 404 with code `not_found`. Anything else — a network failure, a timeout — is
 * whatever `fetch` threw.
 *
 * The text that may be shown or stored always goes through errorReason(): Paddle's own
 * description, scrubbed of e-mail addresses, tokens and long opaque strings.
 *
 * PURE module (no env, no I/O); recognises the error by shape, so injected clients work too.
 */
export type PaddleFailure = {
  /**
   * refused     Paddle understood the request and said no (the subscription's state does not allow it).
   * not_found   Paddle does not know the subscription / transaction / invoice.
   * unavailable We cannot tell what happened: authentication, rate limit, a Paddle outage, the network.
   */
  kind: "refused" | "not_found" | "unavailable";
  /** Paddle's error code (e.g. `subscription_locked_pending_changes`), when there is one. */
  code: string | null;
  status: number | null;
  /** Safe to show, log and store. */
  reason: string;
};

type ApiErrorShape = { code: string; detail: string; status?: unknown };

function isApiError(error: unknown): error is ApiErrorShape {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as Record<string, unknown>;
  return typeof candidate.code === "string" && typeof candidate.detail === "string";
}

const NOT_FOUND_CODES = new Set(["not_found", "invalid_url", "entity_not_found"]);

export function describePaddleFailure(error: unknown): PaddleFailure {
  const reason = errorReason(error);
  if (!isApiError(error)) return { kind: "unavailable", code: null, status: null, reason };
  const code = /^[a-z0-9_.-]{1,80}$/i.test(error.code) ? error.code : null;
  const status = typeof error.status === "number" && Number.isInteger(error.status) ? error.status : null;
  if (status === 404 || (code !== null && NOT_FOUND_CODES.has(code))) return { kind: "not_found", code, status, reason };
  // 401/403: our API key or its permissions; 429: rate limit; 5xx / no status: Paddle or the network.
  if (status === null || status === 401 || status === 403 || status === 429 || status >= 500) return { kind: "unavailable", code, status, reason };
  return { kind: "refused", code, status, reason };
}
