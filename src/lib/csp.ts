/**
 * Content-Security-Policy, built in ONE place for both ways it is delivered:
 *
 *  - STATIC pages (marketing, legal — prerendered at build time, no request exists while
 *    their HTML is produced): a fixed header from next.config.ts. Next.js' inline bootstrap
 *    scripts cannot carry a nonce there, so `script-src` needs 'unsafe-inline'; script
 *    ORIGINS are still restricted to this site, Paddle and (optionally) PostHog.
 *  - DYNAMIC pages (everything signed-in under /app and /admin, and the auth pages): a
 *    per-request NONCE set by src/proxy.ts. Next.js reads the nonce from the request's CSP
 *    header and puts it on every script it renders; `'strict-dynamic'` then lets those
 *    scripts load what they need (Paddle.js is injected by our own bundle) while an injected
 *    inline `<script>` — which has no nonce — does not run.
 *
 * Paddle.js: script + styles from cdn.paddle.com, checkout iframe from buy.paddle.com
 * (sandbox-buy.paddle.com in sandbox), ProfitWell/Retain script from public.profitwell.com.
 *
 * Pure and import-free: used by next.config.ts (build time) and the proxy (per request).
 */
export type CspOptions = {
  /** Per-request nonce. Omit for the static policy. */
  nonce?: string;
  /** `next dev`: React needs eval for its debugging features. */
  isDevelopment: boolean;
  /** Add `upgrade-insecure-requests` (only when served over https). */
  upgradeInsecureRequests: boolean;
  /** Extra script/connect origins (PostHog, when configured). */
  analyticsOrigins?: string[];
};

const PADDLE_SCRIPTS = ["https://cdn.paddle.com", "https://public.profitwell.com"];

/**
 * Tender packs and library documents go from the browser straight to Vercel Blob (a
 * serverless function cannot receive bodies over about 4.5 MB): `upload()` from
 * @vercel/blob/client sends them to this API, and only to it. The trailing slash makes the
 * source match that path and nothing else on vercel.com.
 */
const BLOB_UPLOAD_API = "https://vercel.com/api/blob/";

export function buildContentSecurityPolicy(options: CspOptions): string {
  const analytics = options.analyticsOrigins ?? [];
  const evalForDev = options.isDevelopment ? ["'unsafe-eval'"] : [];
  const scriptSrc = options.nonce
    ? // CSP3 browsers honour the nonce + 'strict-dynamic' and ignore the host list; the hosts
      // are the fallback for browsers that do not know 'strict-dynamic'.
      ["'self'", `'nonce-${options.nonce}'`, "'strict-dynamic'", ...evalForDev, ...PADDLE_SCRIPTS, ...analytics]
    : ["'self'", "'unsafe-inline'", ...evalForDev, ...PADDLE_SCRIPTS, ...analytics];

  const directives: string[][] = [
    ["default-src", "'self'"],
    ["script-src", ...scriptSrc],
    // Inline style ATTRIBUTES (React `style`, Radix positioning, Paddle) cannot carry a nonce.
    ["style-src", "'self'", "'unsafe-inline'", "https://cdn.paddle.com", "https://sandbox-cdn.paddle.com"],
    ["img-src", "'self'", "data:", "blob:", "https://*.paddle.com"],
    ["font-src", "'self'", "data:"],
    ["connect-src", "'self'", "https://*.paddle.com", "https://*.profitwell.com", BLOB_UPLOAD_API, ...analytics],
    ["frame-src", "https://buy.paddle.com", "https://sandbox-buy.paddle.com"],
    ["worker-src", "'self'", "blob:"],
    ["frame-ancestors", "'none'"],
    ["form-action", "'self'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"],
    ...(options.upgradeInsecureRequests ? [["upgrade-insecure-requests"]] : []),
  ];
  return directives.map((directive) => directive.join(" ")).join("; ");
}

/** PostHog origins for the policy, from the public env values (empty when PostHog is off). */
export function analyticsOriginsFromEnv(posthogKey: string | undefined, posthogHost: string | undefined): string[] {
  if (!posthogKey) return [];
  const origins = new Set(["https://*.posthog.com"]);
  if (posthogHost) {
    try {
      origins.add(new URL(posthogHost).origin);
    } catch {
      // ignored: src/env.ts reports the invalid URL with a readable message
    }
  }
  return [...origins];
}

/** A fresh nonce: 128 random bits, base64. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
