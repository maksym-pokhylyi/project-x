/**
 * The ONE way an error becomes text that may be logged, stored or forwarded.
 *
 *   const { name, message, stack, code } = describeError(error);
 *
 * Library errors carry far more than a description of what went wrong:
 *  - drizzle-orm puts the statement AND every bound value in the message
 *    ("Failed query: … params: <session token>, <password hash>, <tender text>…"),
 *    and the Postgres driver adds the offending row in `detail`;
 *  - the AI SDK embeds model output, prompts and response bodies in its messages.
 * Writing `error.message` to a log line, `error_log`, `jobs.last_error`,
 * `webhook_events.error` or Sentry therefore copies customer content and credentials there.
 *
 * What survives here: the error name, SQL text with literals removed, SQLSTATE /
 * constraint / table / column, HTTP status codes, and stack FRAMES (never the stack's
 * first line, which repeats the message). Free-text messages of other errors are kept but
 * scrubbed (`scrubText`): no NUL bytes, URL queries, e-mail addresses, tokens or long
 * opaque strings, and a hard length limit.
 *
 * No imports on purpose: the logger uses it and must stay usable from scripts.
 */
export type ErrorDescription = {
  name: string;
  /** Safe to log, store and forward. */
  message: string;
  /** Stack frames only ("    at fn (file:line:col)"), or null. */
  stack: string | null;
  /** SQLSTATE, Node error code or HTTP status when known. */
  code: string | null;
};

const MAX_MESSAGE = 1000;
const MAX_SQL = 600;
const MAX_STACK = 6000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Names for the SQLSTATE codes an operator is most likely to meet. */
const SQLSTATE_NAMES: Record<string, string> = {
  "08000": "connection_exception",
  "08003": "connection_does_not_exist",
  "08006": "connection_failure",
  "22001": "string_data_right_truncation",
  "22021": "character_not_in_repertoire",
  "22P02": "invalid_text_representation",
  "22P05": "untranslatable_character",
  "23502": "not_null_violation",
  "23503": "foreign_key_violation",
  "23505": "unique_violation",
  "23514": "check_violation",
  "25P02": "in_failed_sql_transaction",
  "40001": "serialization_failure",
  "40P01": "deadlock_detected",
  "42601": "syntax_error",
  "42703": "undefined_column",
  "42P01": "undefined_table",
  "53300": "too_many_connections",
  "57014": "query_canceled",
  "57P01": "admin_shutdown",
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function scrubUrl(url: string): string {
  const [withoutFragment = ""] = url.split("#");
  const queryIndex = withoutFragment.indexOf("?");
  const base = queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
  // One-time tokens also travel as path segments (/reset-password/<token>).
  const cleaned = base.replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, "/[redacted]");
  return queryIndex === -1 ? cleaned : `${cleaned}?[redacted]`;
}

/**
 * Removes what must never be persisted from free text: control characters (a NUL byte
 * makes Postgres reject the whole row), URL query strings and token-like path segments,
 * e-mail addresses, bearer tokens, JWTs and long opaque strings.
 */
export function scrubText(text: string, max: number = MAX_MESSAGE): string {
  const cleaned = text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\bhttps?:\/\/[^\s"'<>)]+/gi, scrubUrl)
    .replace(/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, "[jwt]")
    .replace(/\b(Bearer|Basic)\s+[^\s"']+/gi, "$1 [redacted]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/[A-Za-z0-9+/]{40,}={0,2}/g, "[redacted]")
    .replace(/[A-Za-z0-9_-]{32,}/g, (match) => (UUID.test(match) ? match : "[redacted]"));
  return truncate(cleaned, max);
}

/** SQL text without literals: placeholders stay, quoted strings and long numbers go. */
function scrubSql(query: string): string {
  const collapsed = query
    .replace(/'(?:[^']|'')*'/g, "'?'")
    .replace(/\s+/g, " ")
    .trim();
  return truncate(collapsed.replace(/[\u0000-\u001f\u007f]/g, " "), MAX_SQL);
}

function frames(stack: unknown): string | null {
  if (typeof stack !== "string") return null;
  const lines = stack.split("\n").filter((line) => /^\s+at\s/.test(line));
  if (lines.length === 0) return null;
  return truncate(lines.join("\n").replace(/\u0000/g, ""), MAX_STACK);
}

type Loose = Record<string | symbol, unknown>;

const text = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);
const identifier = (value: unknown): string | null => {
  const candidate = text(value);
  return candidate && /^[A-Za-z0-9_.$-]{1,120}$/.test(candidate) ? candidate : null;
};

function isPostgresError(error: Loose): boolean {
  return error.name === "PostgresError" || (typeof error.code === "string" && /^[0-9A-Z]{5}$/.test(error.code) && "severity" in error);
}

/** "SQLSTATE 23505 unique_violation, constraint "users_email_unique", table "users"" */
function describePostgres(error: Loose): { summary: string; code: string | null } {
  const code = typeof error.code === "string" && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : null;
  const parts: string[] = [];
  if (code) parts.push(`SQLSTATE ${code}${SQLSTATE_NAMES[code] ? ` ${SQLSTATE_NAMES[code]}` : ""}`);
  const constraint = identifier(error.constraint_name ?? error.constraint);
  const table = identifier(error.table_name ?? error.table);
  const column = identifier(error.column_name ?? error.column);
  if (constraint) parts.push(`constraint "${constraint}"`);
  if (table) parts.push(`table "${table}"`);
  if (column) parts.push(`column "${column}"`);
  // `message`, `detail`, `where` and `parameters` are dropped: they quote row values.
  return { summary: parts.join(", ") || "database error", code };
}

function hasMarker(error: Loose, marker: string): boolean {
  return error[Symbol.for(marker)] === true;
}

function httpStatus(error: Loose): number | null {
  const status = error.statusCode ?? error.status;
  return typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function describeCause(cause: unknown): { summary: string; code: string | null } | null {
  if (!cause || typeof cause !== "object") return null;
  const loose = cause as Loose;
  if (isPostgresError(loose)) return describePostgres(loose);
  const code = identifier(loose.code);
  const name = identifier(loose.name) ?? "Error";
  const message = text(loose.message);
  // Driver/connection errors ("write CONNECTION_CLOSED host:5432", "connect ECONNREFUSED …").
  return { summary: `${code ?? name}${message ? `: ${scrubText(message, 200)}` : ""}`, code };
}

export function describeError(value: unknown): ErrorDescription {
  if (typeof value === "string") return { name: "NonError", message: scrubText(value), stack: null, code: null };
  if (!value || typeof value !== "object") {
    return { name: "NonError", message: `Non-error value thrown (${value === null ? "null" : typeof value})`, stack: null, code: null };
  }
  const error = value as Loose;
  const stack = frames(error.stack);
  const name = identifier(error.name) ?? "Error";

  // drizzle-orm DrizzleQueryError: { query, params, cause } — keep the statement, drop the values.
  if (typeof error.query === "string" && "params" in error) {
    const cause = describeCause(error.cause);
    return {
      name: "DrizzleQueryError",
      message: truncate(`Failed query [${cause?.summary ?? "unknown cause"}]: ${scrubSql(error.query)}`, MAX_MESSAGE),
      stack,
      code: cause?.code ?? null,
    };
  }

  if (isPostgresError(error)) {
    const described = describePostgres(error);
    const query = text(error.query);
    return {
      name: "PostgresError",
      message: truncate(`${described.summary}${query ? `: ${scrubSql(query)}` : ""}`, MAX_MESSAGE),
      stack,
      code: described.code,
    };
  }

  // Vercel AI SDK / AI Gateway errors: messages embed prompts, model output and response bodies.
  if (hasMarker(error, "vercel.ai.error") || hasMarker(error, "vercel.ai.gateway.error")) {
    const status = httpStatus(error);
    const retryable = typeof error.isRetryable === "boolean" ? `, retryable=${error.isRetryable}` : "";
    return {
      name,
      message: `${name}${status ? ` (HTTP ${status}${retryable})` : ""}`,
      stack,
      code: status ? String(status) : null,
    };
  }

  // zod: issue messages can quote the rejected input.
  if (name === "ZodError" && Array.isArray(error.issues)) {
    const paths = (error.issues as Array<{ path?: unknown[]; code?: unknown }>)
      .slice(0, 10)
      .map((issue) => `${(issue.path ?? []).map(String).join(".") || "(root)"}:${String(issue.code ?? "invalid")}`);
    return { name, message: scrubText(`Validation failed (${paths.join(", ")})`), stack, code: null };
  }

  const message = text(error.message) ?? "(no message)";
  const cause = error.cause !== undefined && error.cause !== value ? describeCause(error.cause) : null;
  const status = httpStatus(error);
  return {
    name,
    message: scrubText(cause ? `${message} [cause: ${cause.summary}]` : message),
    stack,
    code: identifier(error.code) ?? cause?.code ?? (status ? String(status) : null),
  };
}

/** One line: the message, prefixed with the error name when that adds information. */
export function summarizeError(described: ErrorDescription): string {
  const { name, message } = described;
  return name === "Error" || name === "NonError" || message.startsWith(name) ? message : `${name}: ${message}`;
}

/** Shorthand for a "reason" log field or a stored last-error column. */
export function errorReason(value: unknown): string {
  return summarizeError(describeError(value));
}
