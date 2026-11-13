import "server-only";
import { APIError } from "better-auth/api";
import { AppError, ConflictError, ForbiddenError, NotFoundError, RateLimitError, SeatLimitError, UnauthorizedError, ValidationError } from "@/lib/errors";

const SEAT_LIMIT_CODES = new Set(["ORGANIZATION_MEMBERSHIP_LIMIT_REACHED", "INVITATION_LIMIT_REACHED"]);

/**
 * Translates a Better Auth APIError (thrown by `auth.api.*`) into our typed errors so
 * Server Actions return consistent, user-presentable results. Unknown errors pass through
 * unchanged and are treated as unexpected by runAction().
 */
export function fromAuthError(error: unknown, context: { seatLimit?: number | null } = {}): unknown {
  if (!(error instanceof APIError)) return error;
  const body = (error.body ?? {}) as { code?: string; message?: string };
  const message = body.message ?? error.message;
  if (body.code && SEAT_LIMIT_CODES.has(body.code)) return new SeatLimitError(context.seatLimit ?? 0);
  // Raised by our own hooks in src/lib/auth.ts (same rules whichever way an endpoint is reached).
  if (body.code === "VALIDATION") return new ValidationError(message);
  if (body.code === "RATE_LIMITED") return new RateLimitError(Number((body as { retryAfterSeconds?: unknown }).retryAfterSeconds) || 60);
  switch (error.statusCode) {
    case 401:
      return new UnauthorizedError();
    case 403:
      return new ForbiddenError(message);
    case 404:
      return new NotFoundError(message);
    case 400:
    case 409:
    case 422:
      return new ConflictError(message);
    default:
      return error.statusCode >= 400 && error.statusCode < 500 ? new AppError("CONFLICT", message, error.statusCode) : error;
  }
}
