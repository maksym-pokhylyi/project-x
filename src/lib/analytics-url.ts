/**
 * Keeps secrets that travel in URLs out of analytics.
 *
 * Page-view events record the page URL and the referrer. On the authentication routes
 * those URLs ARE credentials: `/reset-password?token=…`, `/verify-email/confirm?token=…`,
 * `/accept-invitation/<id>`, the auth API callbacks. Sent to an analytics provider they
 * would let anyone with access to that project take over accounts.
 *
 * Pure and dependency-free: used by the browser instrumentation and unit-tested.
 */

/** Routes whose query string and fragment are never recorded. */
const AUTH_ROUTE = /^\/(sign-in|sign-up|verify-email|forgot-password|reset-password|accept-invitation|api\/auth|dev)(\/|$)/;
/** Path segments that are themselves a capability. */
const OPAQUE_SEGMENTS: Array<[RegExp, string]> = [
  [/^\/accept-invitation\/[^/]+/, "/accept-invitation/[id]"],
  [/^\/api\/auth\/reset-password\/[^/]+/, "/api/auth/reset-password/[token]"],
];
/** Parameters removed wherever they appear. */
const SENSITIVE_PARAMS = /^(token|key|code|state|sig|signature|expires|password|email|invitation(_?id)?)$/i;

export function sanitizeAnalyticsPath(pathname: string): string {
  for (const [pattern, replacement] of OPAQUE_SEGMENTS) {
    if (pattern.test(pathname)) return pathname.replace(pattern, replacement);
  }
  return pathname;
}

/**
 * Returns the URL as it may be recorded. Accepts absolute URLs and paths; anything that
 * cannot be parsed is returned without its query string.
 */
export function sanitizeAnalyticsUrl(input: string): string {
  if (!input) return input;
  const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
  let url: URL;
  try {
    url = new URL(input, "http://relative.invalid");
  } catch {
    return input.split(/[?#]/)[0] ?? "";
  }
  if (AUTH_ROUTE.test(url.pathname)) {
    url.search = "";
    url.hash = "";
  } else {
    for (const name of [...url.searchParams.keys()]) {
      if (SENSITIVE_PARAMS.test(name)) url.searchParams.delete(name);
    }
  }
  url.pathname = sanitizeAnalyticsPath(url.pathname);
  return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

/** URL-carrying properties of a PostHog event (page views, page leaves, person properties). */
const URL_PROPERTIES = ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer", "$prev_pageview_pathname", "$pathname", "$initial_pathname"];

/** Sanitises every URL in an analytics event in place and returns it (PostHog `before_send`). */
export function sanitizeAnalyticsEvent<T extends { properties?: Record<string, unknown>; $set?: Record<string, unknown>; $set_once?: Record<string, unknown> } | null>(event: T): T {
  if (!event) return event;
  for (const bag of [event.properties, event.$set, event.$set_once, event.properties?.$set, event.properties?.$set_once]) {
    if (!bag || typeof bag !== "object") continue;
    const record = bag as Record<string, unknown>;
    for (const name of URL_PROPERTIES) {
      const value = record[name];
      if (typeof value === "string" && value !== "$direct") record[name] = sanitizeAnalyticsUrl(value);
    }
  }
  return event;
}
