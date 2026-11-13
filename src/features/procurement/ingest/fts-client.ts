import type { OcdsReleasePackage } from "../domain/ocds";

/**
 * Find a Tender OCDS API client (no key; Open Government Licence v3.0).
 *
 *   GET {base}/api/1.0/ocdsReleasePackages?updatedFrom=YYYY-MM-DDTHH:MM:SS&updatedTo=…&limit=100
 *
 * - `limit` is at most 100; the response carries `links.next` (a full URL with a cursor)
 *   until the last page.
 * - Rate limiting: HTTP 429 (or 503) with `Retry-After` in seconds (~120) after bursts.
 *   One request every ~10 s is safe; pacing is the caller's job (see run.ts).
 * - `stages` accepts ONE stage per call; we do not use it.
 */
export type FtsPage =
  | { ok: true; releases: NonNullable<OcdsReleasePackage["releases"]>; next: string | null }
  | { ok: false; kind: "rate_limited"; retryAfterSeconds: number }
  | { ok: false; kind: "error"; status: number; message: string };

export type FetchFtsPage = (url: string) => Promise<FtsPage>;

/** "2026-11-13T10:20:30" — the API's timestamp format (UTC, no zone suffix). */
export function ftsTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19);
}

export function releasePackagesUrl(base: string, from: Date, to: Date): string {
  const url = new URL("/api/1.0/ocdsReleasePackages", base);
  url.searchParams.set("updatedFrom", ftsTimestamp(from));
  url.searchParams.set("updatedTo", ftsTimestamp(to));
  url.searchParams.set("limit", "100");
  return url.toString();
}

/** Only follow cursors that stay on the API we were configured for. */
export function isSameOrigin(url: string, base: string): boolean {
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

const DEFAULT_RETRY_AFTER = 120;
const MAX_RETRY_AFTER = 900;

export function parseRetryAfter(header: string | null): number {
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(Math.ceil(seconds), MAX_RETRY_AFTER);
  const date = header ? Date.parse(header) : Number.NaN;
  if (!Number.isNaN(date)) return Math.min(Math.max(1, Math.ceil((date - Date.now()) / 1000)), MAX_RETRY_AFTER);
  return DEFAULT_RETRY_AFTER;
}

/** Default page fetcher. Never throws: network failures come back as `{ ok: false, kind: "error" }`. */
export const fetchFtsPage: FetchFtsPage = async (url) => {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": process.env.FTS_USER_AGENT?.trim() || "procurement-data-client/1.0" },
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
    if (response.status === 429 || response.status === 503) {
      return { ok: false, kind: "rate_limited", retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")) };
    }
    if (!response.ok) return { ok: false, kind: "error", status: response.status, message: `HTTP ${response.status}` };
    const body = (await response.json()) as OcdsReleasePackage;
    const next = typeof body.links?.next === "string" && body.links.next ? body.links.next : null;
    return { ok: true, releases: Array.isArray(body.releases) ? body.releases : [], next };
  } catch (error) {
    return { ok: false, kind: "error", status: 0, message: error instanceof Error ? error.message.slice(0, 300) : "network error" };
  }
};
