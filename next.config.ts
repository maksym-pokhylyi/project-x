import type { NextConfig } from "next";
import { analyticsOriginsFromEnv, buildContentSecurityPolicy } from "./src/lib/csp";

/**
 * Security headers for every response.
 *
 * CSP — see src/lib/csp.ts for the policy itself.
 *  - This file sets the STATIC policy (no nonce) so marketing and legal pages stay
 *    statically rendered and cacheable; it needs 'unsafe-inline' for Next.js' bootstrap
 *    scripts.
 *  - Dynamic pages (/app, /admin and the auth pages) get a per-request NONCE policy from
 *    src/proxy.ts, which replaces this header for those responses: no 'unsafe-inline' for
 *    scripts there.
 *  - PostHog hosts are only allowed when NEXT_PUBLIC_POSTHOG_KEY is set at build time.
 * Headers are computed at build time: changing these env vars requires a redeploy.
 */
const isDev = process.env.NODE_ENV === "development";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const servedOverHttps = appUrl.startsWith("https://") || Boolean(process.env.VERCEL);

const csp = buildContentSecurityPolicy({
  isDevelopment: isDev,
  upgradeInsecureRequests: servedOverHttps,
  analyticsOrigins: analyticsOriginsFromEnv(process.env.NEXT_PUBLIC_POSTHOG_KEY, process.env.NEXT_PUBLIC_POSTHOG_HOST),
});

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
      // The Radar lives at /app; breadcrumbs and old links to the section root must not 404.
      { source: "/app/radar", destination: "/app", permanent: false },
    ];
  },
};

export default nextConfig;
