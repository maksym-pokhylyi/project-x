import type { NextConfig } from "next";

/**
 * Security headers for every response.
 *
 * CSP notes
 *  - Static policy (no nonces) so marketing pages stay statically rendered and cacheable.
 *    Next.js needs 'unsafe-inline' for its bootstrap scripts in that mode; script ORIGINS
 *    are still restricted to this site, Paddle and (optionally) PostHog. To move to a
 *    nonce-based policy, see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
 *  - Paddle.js: script + styles from cdn.paddle.com, checkout iframe from buy.paddle.com
 *    (sandbox-buy.paddle.com in sandbox), ProfitWell/Retain script from public.profitwell.com.
 *  - PostHog hosts are only allowed when NEXT_PUBLIC_POSTHOG_KEY is set at build time.
 * Headers are computed at build time: changing these env vars requires a redeploy.
 */
const isDev = process.env.NODE_ENV === "development";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const servedOverHttps = appUrl.startsWith("https://") || Boolean(process.env.VERCEL);

const posthogEnabled = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
const posthogHosts = (() => {
  if (!posthogEnabled) return [];
  const hosts = new Set(["https://*.posthog.com"]);
  const custom = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (custom) {
    try {
      hosts.add(new URL(custom).origin);
    } catch {
      // ignored: src/env.ts reports the invalid URL with a readable message
    }
  }
  return [...hosts];
})();

const csp = [
  ["default-src", "'self'"],
  ["script-src", "'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), "https://cdn.paddle.com", "https://public.profitwell.com", ...posthogHosts],
  ["style-src", "'self'", "'unsafe-inline'", "https://cdn.paddle.com", "https://sandbox-cdn.paddle.com"],
  ["img-src", "'self'", "data:", "blob:", "https://*.paddle.com"],
  ["font-src", "'self'", "data:"],
  ["connect-src", "'self'", "https://*.paddle.com", "https://*.profitwell.com", ...posthogHosts],
  ["frame-src", "https://buy.paddle.com", "https://sandbox-buy.paddle.com"],
  ["worker-src", "'self'", "blob:"],
  ["frame-ancestors", "'none'"],
  ["form-action", "'self'"],
  ["base-uri", "'self'"],
  ["object-src", "'none'"],
  ...(servedOverHttps ? [["upgrade-insecure-requests"]] : []),
]
  .map((directive) => directive.join(" "))
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Enables forbidden() + forbidden.tsx so /admin and role-gated pages answer with a real 403.
    authInterrupts: true,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // The free deliverable was renamed from "bid brief" to "cited bid check".
      { source: "/free-bid-brief", destination: "/free-bid-check", permanent: true },
    ];
  },
};

export default nextConfig;
