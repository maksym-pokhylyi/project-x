import "server-only";
import { waitUntil } from "@vercel/functions";
import { db } from "@/db";
import { errorLog } from "@/db/schema";
import { describeError, errorReason, summarizeError } from "./describe-error";
import { log } from "./logger";
import { sendToSentry } from "./sentry";

export type ErrorContext = {
  /** Correlates log lines, the error_log row and what the user sees. */
  requestId?: string | null;
  /** Route path or logical source ("job:email.send", "webhook:paddle"). */
  route?: string | null;
  method?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  digest?: string | null;
  /** Small, non-sensitive extra data. Never put request bodies or secrets here. */
  extra?: Record<string, unknown>;
};

/** jsonb rejects NUL escapes; `extra` is small, so a JSON round-trip is cheap. */
function jsonSafe(extra: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!extra) return {};
  try {
    return JSON.parse(JSON.stringify(extra).replaceAll("\\u0000", "")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Records an UNEXPECTED server error: structured log line + `error_log` row + Sentry
 * (when configured). Never throws — failing to record an error must not mask it.
 *
 * Everything written here goes through describeError(): SQL text and SQLSTATE but never
 * bound values, AI SDK error names but never model output, no tokens, no NUL bytes.
 */
export async function reportError(value: unknown, context: ErrorContext = {}): Promise<void> {
  const described = describeError(value);
  log.error(described.message, {
    requestId: context.requestId,
    route: context.route,
    organizationId: context.organizationId,
    userId: context.userId,
    errorName: described.name,
    code: described.code ?? undefined,
    stack: described.stack ?? undefined,
  });
  try {
    await db.insert(errorLog).values({
      requestId: context.requestId ?? null,
      route: context.route ?? null,
      method: context.method ?? null,
      organizationId: context.organizationId ?? null,
      userId: context.userId ?? null,
      message: summarizeError(described),
      // First line rebuilt from the sanitised message; the original one repeats the raw message.
      stack: described.stack ? `${described.name}: ${described.message}\n${described.stack}` : null,
      digest: context.digest ?? null,
      context: jsonSafe(context.extra),
    });
  } catch (insertError) {
    log.error("failed to write error_log", { reason: errorReason(insertError) });
  }
  // Forwarding must not delay the response (or a webhook acknowledgement).
  waitUntil(sendToSentry(described, context));
}
