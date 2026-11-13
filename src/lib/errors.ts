/**
 * Typed application errors.
 *
 * Anything that extends AppError is an EXPECTED failure: it carries an HTTP status, a stable
 * machine-readable `code` and a message that is safe to show to the user. Everything else is
 * unexpected and goes to reportError() (error_log + optional Sentry) with a generic message.
 */
export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "SEAT_LIMIT_REACHED"
  | "BILLING_NOT_CONFIGURED"
  | "AI_ORG_BUDGET_EXCEEDED"
  | "AI_GLOBAL_BUDGET_EXCEEDED"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Extra, client-safe details (field errors, limits, retry hints). */
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You need to sign in to do that.") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.") {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super("NOT_FOUND", message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Please check the highlighted fields.", fieldErrors: Record<string, string[]> = {}) {
    super("VALIDATION", message, 400, { fieldErrors });
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super("RATE_LIMITED", "Too many requests. Please try again shortly.", 429, { retryAfterSeconds });
  }
}

export class QuotaExceededError extends AppError {
  constructor(metric: string, limit: number, used: number) {
    super("QUOTA_EXCEEDED", `You've reached your plan's limit for ${metric}. Upgrade to continue.`, 402, {
      metric,
      limit,
      used,
    });
  }
}

export class SeatLimitError extends AppError {
  constructor(limit: number) {
    super(
      "SEAT_LIMIT_REACHED",
      `Your plan includes ${limit} seat${limit === 1 ? "" : "s"}. Upgrade to add more members.`,
      402,
      { limit },
    );
  }
}

export class BillingNotConfiguredError extends AppError {
  constructor() {
    super("BILLING_NOT_CONFIGURED", "Billing is not configured for this environment.", 503);
  }
}

/** JSON-safe shape used by route handlers and server actions. */
export type SerializedError = { code: ErrorCode; message: string; details?: Record<string, unknown> };

export function serializeError(error: unknown): SerializedError {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) };
  }
  return { code: "INTERNAL", message: "Something went wrong on our side. Please try again." };
}
