/**
 * Returns `target` only if it is a same-site path ("/app/…"), otherwise the fallback.
 * Prevents open redirects through `?redirect=` parameters.
 *
 * A prefix check is not enough: browsers remove tab, CR and LF from a URL and treat "\"
 * like "/", so "/\t/evil.example" or "/\evil.example" leave the site, and dot segments
 * collapse ("/.//evil.example" resolves to "//evil.example"). So the target is
 *  1. rejected if it contains any control character or backslash,
 *  2. resolved the way a browser would, against a placeholder origin,
 *  3. accepted only if it stays on that origin,
 *  4. returned in its normalised form (path + query + fragment), which is re-checked.
 */
const PLACEHOLDER_ORIGIN = "http://same-site.invalid";

export function safeRedirect(target: string | null | undefined, fallback = "/app"): string {
  if (typeof target !== "string" || target.length === 0 || target.length > 2048) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(target)) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  let resolved: URL;
  try {
    resolved = new URL(target, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (resolved.origin !== PLACEHOLDER_ORIGIN || resolved.username || resolved.password) return fallback;
  const normalised = `${resolved.pathname}${resolved.search}${resolved.hash}`;
  if (!normalised.startsWith("/") || normalised.startsWith("//")) return fallback;
  return normalised;
}
