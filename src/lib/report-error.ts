import "server-only";
import { db } from "@/db";
import { errorLog } from "@/db/schema";
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

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : "Non-error value thrown");
}

/**
 * Records an UNEXPECTED server error: structured log line + `error_log` row + Sentry
 * (when configured). Never throws — failing to record an error must not mask it.
 */
export async function reportError(value: unknown, context: ErrorContext = {}): Promise<void> {
  const error = toError(value);
  log.error(error.message, {
    requestId: context.requestId,
    route: context.route,
    organizationId: context.organizationId,
    userId: context.userId,
    stack: error.stack,
  });
  try {
    await db.insert(errorLog).values({
      requestId: context.requestId ?? null,
      route: context.route ?? null,
      method: context.method ?? null,
      organizationId: context.organizationId ?? null,
      userId: context.userId ?? null,
      message: error.message.slice(0, 2000),
      stack: error.stack?.slice(0, 8000) ?? null,
      digest: context.digest ?? null,
      context: context.extra ?? {},
    });
  } catch (insertError) {
    log.error("failed to write error_log", {
      reason: insertError instanceof Error ? insertError.message : "unknown",
    });
  }
  await sendToSentry(error, context);
}
