import "server-only";
import { adminEmails, adminUserIds, env, features } from "@/env";
import { log } from "./logger";

/**
 * Configuration problems an operator must know about.
 *
 * Computed from the environment, logged once at start-up (errors loudly) and listed on
 * /admin, so an unsafe or half-configured deployment is never silent. Messages name
 * variables, never values.
 */
export type ConfigWarning = {
  /** "error": customers are exposed or a core function is off. "warning": degraded. */
  level: "error" | "warning";
  code: string;
  message: string;
};

export function getConfigWarnings(): ConfigWarning[] {
  const warnings: ConfigWarning[] = [];
  const production = features.isRealProduction;
  const add = (level: ConfigWarning["level"], code: string, message: string) => warnings.push({ level, code, message });

  if (features.unverifiedSignupAllowed) {
    add(
      "error",
      "UNVERIFIED_SIGNUP_ALLOWED",
      "ALLOW_UNVERIFIED_SIGNUP=1: accounts are created WITHOUT e-mail verification, so anyone can register any address. " +
        "Pre-launch testing only — set RESEND_API_KEY and EMAIL_FROM and remove this variable before real users arrive.",
    );
  } else if (features.mailDelivery === "none") {
    add(
      production ? "error" : "warning",
      "EMAIL_NOT_CONFIGURED",
      `E-mail cannot be delivered (${!env.RESEND_API_KEY ? "RESEND_API_KEY is not set" : "EMAIL_FROM is not set"}): ` +
        "sign-up, password reset and invitations are DISABLED until RESEND_API_KEY and EMAIL_FROM are both set.",
    );
  }
  if (env.ALLOW_UNVERIFIED_SIGNUP === "1" && !features.unverifiedSignupAllowed) {
    add("warning", "UNVERIFIED_SIGNUP_IGNORED", "ALLOW_UNVERIFIED_SIGNUP=1 is set but ignored because e-mail delivery works. Remove the variable.");
  }

  if (features.billingBlockedSandbox) {
    add(
      "error",
      "SANDBOX_BILLING_BLOCKED",
      "PADDLE_ENV is not 'production' on the production deployment: checkout, webhooks and the billing portal are OFF so test cards cannot buy real plans. " +
        "Set PADDLE_ENV=production with live credentials, or ALLOW_SANDBOX_BILLING=1 for a pre-launch test.",
    );
  } else if (production && features.billingTestMode) {
    add(
      "error",
      "SANDBOX_BILLING_ALLOWED",
      "ALLOW_SANDBOX_BILLING=1: the production deployment sells plans through the Paddle SANDBOX — anyone with a test card gets a paid plan for free. Pre-launch testing only.",
    );
  }
  if (features.paddleCheckout && !features.paddleWebhooks) {
    add("error", "PADDLE_WEBHOOK_SECRET_MISSING", "Checkout is enabled but PADDLE_WEBHOOK_SECRET is not set: payments would never grant a plan.");
  }

  if (production && !env.CRON_SECRET) {
    add("error", "CRON_SECRET_MISSING", "CRON_SECRET is not set: background jobs, e-mail retries, data retention and billing reconciliation do not run.");
  }
  if (production && adminEmails.size === 0) {
    add("warning", "ADMIN_EMAILS_MISSING", "ADMIN_EMAILS is not set: nobody can open /admin.");
  }
  if (production && adminEmails.size > 0 && adminUserIds.size === 0) {
    add("warning", "ADMIN_NOT_PINNED", "ADMIN_USER_IDS is not set: /admin relies on the verified ADMIN_EMAILS address alone. Pin the founder's user id.");
  }
  if (production && !features.blobStorage) {
    add("warning", "BLOB_STORAGE_MISSING", "BLOB_READ_WRITE_TOKEN is not set: uploads go to the instance's local disk and are lost.");
  }
  if (features.devToolsProtected) {
    add(
      "warning",
      "DEV_TOOLS_ENABLED",
      `DEV_TOOLS=1 on a production build: /dev/outbox is reachable by admins${env.DEV_TOOLS_SECRET ? " and with DEV_TOOLS_SECRET" : ""}. Remove it outside test environments.`,
    );
  }
  return warnings;
}

let announced = false;

/** Logs every warning once per server instance. Called when the auth module loads. */
export function announceConfigWarnings(): void {
  if (announced || env.NODE_ENV === "test" || process.env.NEXT_PHASE === "phase-production-build") return;
  announced = true;
  for (const warning of getConfigWarnings()) {
    const line = `[config] ${warning.code}: ${warning.message}`;
    if (warning.level === "error") log.error(`!!! ${line}`);
    else log.warn(line);
  }
}
