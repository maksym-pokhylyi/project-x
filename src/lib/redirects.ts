/**
 * Returns `target` only if it is a same-site path ("/app/…"), otherwise the fallback.
 * Prevents open redirects through `?redirect=` parameters.
 */
export function safeRedirect(target: string | null | undefined, fallback = "/app"): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(target)) return fallback;
  return target;
}
