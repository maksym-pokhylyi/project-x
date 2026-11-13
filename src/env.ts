import "server-only";
import { z } from "zod";

/**
 * Server-side environment, validated once at module load.
 *
 * - Never import this file from a Client Component (`server-only` enforces it).
 *   Client code reads the few public values from `src/env.public.ts`.
 * - Every optional integration (email, billing, OAuth, analytics, blob storage, AI)
 *   degrades gracefully when its variables are absent; see `features` below.
 * - Error messages list variable NAMES only, never values.
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Set by Vercel: "production" | "preview" | "development". */
  VERCEL_ENV: optional(z.enum(["production", "preview", "development"])),
  VERCEL_URL: optional(z.string()),
  VERCEL_PROJECT_PRODUCTION_URL: optional(z.string()),

  // --- Core (required) ---
  DATABASE_URL: z.preprocess(
    emptyToUndefined,
    z.string({ error: "DATABASE_URL is required" }).regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL"),
  ),
  BETTER_AUTH_SECRET: z.preprocess(
    emptyToUndefined,
    z.string({ error: "BETTER_AUTH_SECRET is required" }).min(32, "must be at least 32 characters"),
  ),
  NEXT_PUBLIC_APP_URL: optional(z.url()),

  // --- Auth ---
  GOOGLE_CLIENT_ID: optional(z.string()),
  GOOGLE_CLIENT_SECRET: optional(z.string()),
  ADMIN_EMAILS: optional(z.string()),
  /** Optional pin: when set, /admin additionally requires the user id to be listed (comma-separated). */
  ADMIN_USER_IDS: optional(z.string()),
  /** Extra origins allowed to call the auth API (comma-separated), e.g. the *.vercel.app alias before the custom domain is live. */
  AUTH_TRUSTED_ORIGINS: optional(z.string()),

  // --- Email ---
  RESEND_API_KEY: optional(z.string()),
  EMAIL_FROM: optional(z.string()),

  // --- Billing (Paddle Billing) ---
  PADDLE_ENV: z.preprocess(emptyToUndefined, z.enum(["sandbox", "production"]).default("sandbox")),
  PADDLE_API_KEY: optional(z.string()),
  PADDLE_WEBHOOK_SECRET: optional(z.string()),
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: optional(z.string()),
  PADDLE_PRICE_STARTER_MONTHLY: optional(z.string()),
  PADDLE_PRICE_STARTER_ANNUAL: optional(z.string()),
  PADDLE_PRICE_PRO_MONTHLY: optional(z.string()),
  PADDLE_PRICE_PRO_ANNUAL: optional(z.string()),
  PADDLE_PRICE_BUSINESS_MONTHLY: optional(z.string()),
  PADDLE_PRICE_BUSINESS_ANNUAL: optional(z.string()),
  /** Days a past_due subscription keeps its paid entitlements. */
  BILLING_PAST_DUE_GRACE_DAYS: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(60).default(7)),
  /** Max accepted age (seconds) of a webhook signature timestamp. */
  PADDLE_WEBHOOK_TOLERANCE_SECONDS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(5).max(3600).default(300),
  ),

  // --- Background jobs ---
  CRON_SECRET: optional(z.string().min(16, "must be at least 16 characters")),

  // --- Analytics / observability ---
  NEXT_PUBLIC_POSTHOG_KEY: optional(z.string()),
  NEXT_PUBLIC_POSTHOG_HOST: optional(z.url()),
  SENTRY_DSN: optional(z.url()),
  LOG_LEVEL: z.preprocess(emptyToUndefined, z.enum(["debug", "info", "warn", "error"]).default("info")),

  // --- Storage ---
  BLOB_READ_WRITE_TOKEN: optional(z.string()),

  // --- AI ---
  AI_GATEWAY_API_KEY: optional(z.string()),
  /** Hard global ceiling for estimated AI spend per UTC day, in USD. 0 disables AI entirely. */
  AI_DAILY_BUDGET_USD: z.preprocess(emptyToUndefined, z.coerce.number().min(0).default(10)),

  // --- Dev tooling ---
  /** "1" exposes /dev/outbox on a production BUILD (used by e2e). Ignored when VERCEL_ENV=production. */
  DEV_TOOLS: optional(z.enum(["0", "1"])),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function parseEnv(): ServerEnv {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${problems}\n` +
        `Copy .env.example to .env.local and fill in the required values (see README "Environment variables").`,
    );
  }
  return result.data;
}

export const env = parseEnv();

function resolveAppUrl(e: ServerEnv): string {
  if (e.NEXT_PUBLIC_APP_URL) return e.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  if (e.VERCEL_ENV === "production" && e.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${e.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Canonical origin of this deployment, without a trailing slash. */
export const appUrl = resolveAppUrl(env);

/**
 * Origins allowed to call the auth API: the canonical origin, any explicitly configured extras, and this
 * deployment's own Vercel hostnames (so the *.vercel.app alias keeps working next to the custom domain).
 */
export const trustedOrigins: string[] = Array.from(
  new Set(
    [
      appUrl,
      ...(env.AUTH_TRUSTED_ORIGINS ?? "").split(","),
      env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "",
      env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "",
    ]
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter((origin) => /^https?:\/\/[^/]+$/.test(origin)),
  ),
);

const isRealProduction = env.VERCEL_ENV === "production";
const emailConfigured = Boolean(env.RESEND_API_KEY);
/** Dev-only tools (/dev/outbox). Can never be on for a Vercel production deployment. */
const devTools = !isRealProduction && (env.NODE_ENV !== "production" || env.DEV_TOOLS === "1");

/**
 * Which optional integrations are live. Everything in the app branches on these
 * flags instead of poking at individual variables.
 */
export const features = {
  isRealProduction,
  emailConfigured,
  devTools,
  /**
   * Verification is enforced whenever the user can actually receive the link:
   * through Resend, or through the dev outbox. A production deployment without
   * RESEND_API_KEY cannot deliver mail, so it does not block sign-in on it
   * (a warning is logged at startup).
   */
  requireEmailVerification: emailConfigured || devTools,
  googleOAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  /** Server can talk to the Paddle API (customer portal, paddle:setup). */
  paddleApi: Boolean(env.PADDLE_API_KEY),
  /** Webhooks can be verified. */
  paddleWebhooks: Boolean(env.PADDLE_WEBHOOK_SECRET),
  /** Overlay checkout can be opened in the browser. */
  paddleCheckout: Boolean(env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN),
  posthog: Boolean(env.NEXT_PUBLIC_POSTHOG_KEY),
  sentry: Boolean(env.SENTRY_DSN),
  blobStorage: Boolean(env.BLOB_READ_WRITE_TOKEN),
} as const;

/** Lower-cased founder/admin e-mail addresses allowed into /admin. */
export const adminEmails: ReadonlySet<string> = new Set(
  (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

/**
 * Optional second factor for /admin: the exact user ids allowed in. Empty = not pinned
 * (a verified ADMIN_EMAILS address is enough). Set it after the founder's first sign-in.
 */
export const adminUserIds: ReadonlySet<string> = new Set(
  (env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);
