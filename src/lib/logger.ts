/**
 * Structured server logging.
 *
 *   log.info("subscription updated", { organizationId, status })
 *
 * Production: one JSON object per line (what Vercel's log drains and search expect).
 * Development: a compact human-readable line.
 * Keys that look like credentials are redacted. Never pass raw request bodies or tokens.
 *
 * This module deliberately has no imports from the app so it can be used from scripts.
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|signature/i;

function threshold(): number {
  const configured = process.env.LOG_LEVEL as Level | undefined;
  if (configured && configured in LEVELS) return LEVELS[configured];
  return process.env.NODE_ENV === "test" ? LEVELS.error + 1 : LEVELS.info;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value === null || typeof value !== "object") return value;
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  const out: Fields = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitize(inner, depth + 1);
  }
  return out;
}

function write(level: Level, message: string, fields: Fields | undefined, bindings: Fields) {
  if (LEVELS[level] < threshold()) return;
  const data = sanitize({ ...bindings, ...fields }) as Fields;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (process.env.NODE_ENV === "production") {
    sink(JSON.stringify({ level, time: new Date().toISOString(), msg: message, ...data }));
  } else {
    const suffix = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : "";
    sink(`[${level}] ${message}${suffix}`);
  }
}

export type Logger = {
  debug: (message: string, fields?: Fields) => void;
  info: (message: string, fields?: Fields) => void;
  warn: (message: string, fields?: Fields) => void;
  error: (message: string, fields?: Fields) => void;
  /** Returns a logger that adds `bindings` to every line (e.g. requestId). */
  child: (bindings: Fields) => Logger;
};

function create(bindings: Fields): Logger {
  return {
    debug: (message, fields) => write("debug", message, fields, bindings),
    info: (message, fields) => write("info", message, fields, bindings),
    warn: (message, fields) => write("warn", message, fields, bindings),
    error: (message, fields) => write("error", message, fields, bindings),
    child: (extra) => create({ ...bindings, ...extra }),
  };
}

export const log = create({});
