import "server-only";
import { z } from "zod";

/**
 * Server-side environment, validated once at module load.
 *
 * - Never import this file from a Client Component (`server-only` enforces it).
 *   Client code reads the few public values from `src/env.public.ts`.
 * - Every optional integration (email, billing, OAuth, analytics, blob storage, AI)
 *   degrades gracefully when its variables are absent; see `features` below.
 * - "Gracefully" never means "less secure": a deployment that cannot deliver e-mail does
 *   not skip verification, it disables sign-up; sandbox billing does not sell real plans.
 *   The two explicit escape hatches (ALLOW_UNVERIFIED_SIGNUP, ALLOW_SANDBOX_BILLING) are
 *   reported by src/lib/config-warnings.ts at start-up and on /admin.
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
  /**
   * "1" lets a deployment WITHOUT e-mail delivery accept sign-ups with no verification at
   * all. Pre-launch testing only: anyone can register any address. Ignored once e-mail works.
   */
  ALLOW_UNVERIFIED_SIGNUP: optional(z.enum(["0", "1"])),

  // --- Billing (Paddle Billing) ---
  PADDLE_ENV: z.preprocess(emptyToUndefined, z.enum(["sandbox", "production"]).default("sandbox")),
  /**
   * "1" allows Paddle SANDBOX on a real production deployment (test cards grant real plans).
   * Pre-launch testing only; the billing UI then shows a "Test mode" notice.
   */
  ALLOW_SANDBOX_BILLING: optional(z.enum(["0", "1"])),
  /** Signs checkout custom data. Optional: derived from BETTER_AUTH_SECRET when unset. */
  BILLING_SIGNING_SECRET: optional(z.string().min(32, "must be at least 32 characters")),
  PADDLE_API_KEY: optional(z.string()),
  PADDLE_WEBHOOK_SECRET: optional(z.string()),
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: optional(z.string()),
  PADDLE_PRICE_STARTER_MONTHLY: optional(z.string()),
  PADDLE_PRICE_STARTER_ANNUAL: optional(z.string()),
  PADDLE_PRICE_PRO_MONTHLY: optional(z.string()),
  PADDLE_PRICE_PRO_ANNUAL: optional(z.string()),
  PADDLE_PRICE_BUSINESS_MONTHLY: optional(z.string()),
  PADDLE_PRICE_BUSINESS_ANNUAL: optional(z.string()),
  /**
   * Prices WITHOUT a trial for workspaces that already had a subscription
   * (src/lib/billing/trial.ts). Optional: the normal price is used when unset.
   */
  PADDLE_PRICE_PRO_MONTHLY_NOTRIAL: optional(z.string()),
  PADDLE_PRICE_PRO_ANNUAL_NOTRIAL: optional(z.string()),
  /** One-off Bid Pass (src/lib/billing/one-off.ts). Optional: without it the pass cannot be bought. */
  PADDLE_PRICE_BID_PASS: optional(z.string()),
  /** Days a past_due subscription keeps its paid entitlements. */
  BILLING_PAST_DUE_GRACE_DAYS: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(60).default(7)),
  /**
   * Fail-safe: an active/trialing subscription whose paid period ended more than this many
   * days ago (no renewal or cancellation reached us) stops granting its plan.
   */
  BILLING_PERIOD_END_GRACE_DAYS: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(60).default(3)),
  /** Max accepted age (seconds) of a webhook signature timestamp. */
  PADDLE_WEBHOOK_TOLERANCE_SECONDS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(5).max(3600).default(300),
  ),

  // --- Background jobs ---
  CRON_SECRET: optional(z.string().min(16, "must be at least 16 characters")),
  /**
   * "1" stops every scheduled e-mail (weekly digest, daily alerts, deadline and renewal
   * reminders): nothing is fanned out and queued sends are dropped. Transactional e-mail
   * (verification, password reset, invitations) is not affected.
   */
  NOTIFICATIONS_PAUSED: optional(z.enum(["0", "1"])),

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
  /** Daily pool shared by ALL free-plan workspaces, in USD. Default: 25% of AI_DAILY_BUDGET_USD. */
  AI_FREE_DAILY_BUDGET_USD: optional(z.coerce.number().min(0)),

  // --- Dev tooling ---
  /** "1" exposes /dev/outbox on a production BUILD (used by e2e). Ignored when VERCEL_ENV=production. */
  DEV_TOOLS: optional(z.enum(["0", "1"])),
  /** On a production build with DEV_TOOLS=1, /dev/outbox requires an admin session or `?key=<this>`. */
  DEV_TOOLS_SECRET: optional(z.string().min(16, "must be at least 16 characters")),
  /**
   * "1" trusts X-Forwarded-For / X-Real-IP when NOT running on Vercel (self-hosting behind a
   * proxy that overwrites them). On Vercel the platform's own headers are always used.
   */
  TRUST_PROXY_HEADERS: optional(z.enum(["0", "1"])),
  /** Set by Vercel ("1") on every deployment. */
  VERCEL: optional(z.string()),
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
/** `next dev` or the test runner on a developer's machine (not a production build). */
const isLocalDevelopment = env.NODE_ENV !== "production";
/**
 * E-mail can be delivered through Resend. A real production deployment needs the key AND
 * its own sender: Resend's shared test sender only delivers to the account owner.
 */
const emailConfigured = Boolean(env.RESEND_API_KEY) && (Boolean(env.EMAIL_FROM) || !isRealProduction);
/** Dev-only tools (/dev/outbox). Can never be on for a Vercel production deployment. */
const devTools = !isRealProduction && (isLocalDevelopment || env.DEV_TOOLS === "1");
/** How a transactional e-mail reaches its reader: a provider, the dev outbox, or not at all. */
const mailDelivery: "resend" | "outbox" | "none" = emailConfigured ? "resend" : devTools ? "outbox" : "none";
/** The explicit escape hatch; it only means something where e-mail cannot be delivered. */
const unverifiedSignupAllowed = mailDelivery === "none" && env.ALLOW_UNVERIFIED_SIGNUP === "1";

const paddleSandbox = env.PADDLE_ENV !== "production";
/** Sandbox payments must not grant plans on the real production deployment unless explicitly allowed. */
const billingAllowed = !(isRealProduction && paddleSandbox) || env.ALLOW_SANDBOX_BILLING === "1";

/**
 * Which optional integrations are live. Everything in the app branches on these
 * flags instead of poking at individual variables.
 */
export const features = {
  isRealProduction,
  isLocalDevelopment,
  emailConfigured,
  devTools,
  /** True on a production BUILD with DEV_TOOLS=1: dev pages then need an admin session or DEV_TOOLS_SECRET. */
  devToolsProtected: devTools && !isLocalDevelopment,
  mailDelivery,
  /**
   * The security posture never follows the mail configuration: verification is always
   * enforced. Where e-mail cannot be delivered, sign-up and password reset are DISABLED
   * instead (see below) — unless ALLOW_UNVERIFIED_SIGNUP=1 explicitly opts out.
   */
  requireEmailVerification: !unverifiedSignupAllowed,
  /** E-mail sign-up is possible: the verification link can be delivered, or the escape hatch is on. */
  signUpEnabled: mailDelivery !== "none" || unverifiedSignupAllowed,
  /** Password reset needs a deliverable link. */
  passwordResetEnabled: mailDelivery !== "none",
  /** ALLOW_UNVERIFIED_SIGNUP=1 is in effect: accounts are created without proving the mailbox. */
  unverifiedSignupAllowed,
  googleOAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  /** Server can talk to the Paddle API (customer portal, paddle:setup). */
  paddleApi: Boolean(env.PADDLE_API_KEY) && billingAllowed,
  /** Webhooks can be verified (and may grant plans). */
  paddleWebhooks: Boolean(env.PADDLE_WEBHOOK_SECRET) && billingAllowed,
  /** Overlay checkout can be opened in the browser. */
  paddleCheckout: Boolean(env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) && billingAllowed,
  /** Billing runs against the Paddle sandbox: no real money moves. The UI must say so. */
  billingTestMode: paddleSandbox && billingAllowed && Boolean(env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || env.PADDLE_WEBHOOK_SECRET),
  /** Sandbox credentials are configured on real production WITHOUT the opt-in: billing stays off. */
  billingBlockedSandbox: !billingAllowed && Boolean(env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || env.PADDLE_WEBHOOK_SECRET || env.PADDLE_API_KEY),
  /** Running on Vercel: the platform sets (and overwrites) the client-IP headers. */
  onVercel: Boolean(env.VERCEL) || Boolean(env.VERCEL_ENV),
  /** NOTIFICATIONS_PAUSED=1: no scheduled e-mail leaves (src/features/notifications). */
  notificationsPaused: env.NOTIFICATIONS_PAUSED === "1",
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
