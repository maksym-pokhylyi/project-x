/**
 * Public (browser-safe) environment. Only `NEXT_PUBLIC_*` variables may appear
 * here, and each one must be referenced statically so Next.js can inline it.
 * Server-only configuration lives in `src/env.ts`.
 */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY || "",
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
} as const;
