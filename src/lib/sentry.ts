import "server-only";
import { env } from "@/env";
import { describeError, errorReason, type ErrorDescription } from "./describe-error";
import { log } from "./logger";

/**
 * Deliberately thin Sentry forwarding for SERVER errors.
 *
 * We do not use @sentry/nextjs: it wraps the Next.js build (source-map upload, bundler
 * plugins, instrumentation hooks) and that complexity is not worth it for a one-person
 * operation whose source of truth is the `error_log` table. This sends one error event
 * per call to Sentry's envelope endpoint when SENTRY_DSN is set, and is a no-op otherwise.
 * Browser errors are not captured.
 */
export type SentryContext = {
  requestId?: string | null;
  route?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  extra?: Record<string, unknown>;
};

/** True for a value that already went through describeError(). */
function isDescription(value: unknown): value is ErrorDescription {
  return typeof value === "object" && value !== null && !(value instanceof Error) && "message" in value && "stack" in value && "code" in value;
}

export function buildSentryEnvelope(dsn: string, value: Error | ErrorDescription, context: SentryContext, now = new Date()) {
  // Always sanitised here too, so no caller can forward bind parameters or model output.
  const error = isDescription(value) ? value : describeError(value);
  const url = new URL(dsn);
  const projectId = url.pathname.replace(/^\/+/, "");
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: "node",
    level: "error",
    environment: env.VERCEL_ENV ?? env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    transaction: context.route ?? undefined,
    user: context.userId ? { id: context.userId } : undefined,
    tags: {
      request_id: context.requestId ?? undefined,
      organization_id: context.organizationId ?? undefined,
    },
    extra: { ...context.extra, stack: error.stack ?? undefined, code: error.code ?? undefined },
    exception: { values: [{ type: error.name, value: error.message }] },
  };
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: now.toISOString(), dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
  return {
    endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    headers: {
      "content-type": "application/x-sentry-envelope",
      "x-sentry-auth": `Sentry sentry_version=7, sentry_client=saas-foundation/1.0, sentry_key=${url.username}`,
    },
    body,
  };
}

export async function sendToSentry(error: Error | ErrorDescription, context: SentryContext): Promise<void> {
  if (!env.SENTRY_DSN) return;
  try {
    const envelope = buildSentryEnvelope(env.SENTRY_DSN, error, context);
    await fetch(envelope.endpoint, {
      method: "POST",
      headers: envelope.headers,
      body: envelope.body,
      signal: AbortSignal.timeout(2000),
    });
  } catch (sendError) {
    log.warn("sentry forwarding failed", { reason: errorReason(sendError) });
  }
}
