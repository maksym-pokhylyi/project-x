/**
 * Getting a JSON object out of model text. Pure functions (unit-tested).
 *
 * Models occasionally wrap JSON in a code fence, add a sentence before it, or run out of
 * output tokens in the middle of a long array. `parseModelJson` handles the first two;
 * `salvageTruncatedJson` recovers the complete items of a cut-off array so a long
 * extraction is not lost entirely (the caller records that the output was truncated).
 */

export class ModelJsonError extends Error {
  constructor(
    message: string,
    readonly raw: string,
  ) {
    super(message);
    this.name = "ModelJsonError";
  }
}

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

/**
 * Repairs a corruption measured in the spike (REPORT.md §4.6 #7): some models return
 * non-ASCII characters as NUL + hex digits ("£" arrives as NUL + "A3", a curly quote as
 * NUL + "2019"), as runs of NULs, or as other control characters. Left alone it shows
 * users "A314,000" for "£14,000" and breaks quote matching.
 *
 * Only two unambiguous forms are decoded: a four-digit code point from the General
 * Punctuation block (20xx: quotes, dashes, bullets) and a two-digit Latin-1 character
 * (A0–FF: £, ©, é …). Anything else loses its control character and keeps its text.
 */
export function sanitizeModelString(value: string): string {
  if (!CONTROL_CHARS.test(value)) return value;
  return value
    .replace(/\u0000(20[0-9A-F]{2})/g, (_whole, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\u0000([A-F][0-9A-F])/g, (_whole, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\u0002s/g, "'s")
    .replace(new RegExp(CONTROL_CHARS.source, "g"), "");
}

/** Applies `sanitizeModelString` to every string inside parsed model output. */
export function sanitizeModelValue<T>(value: T): T {
  if (typeof value === "string") return sanitizeModelString(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeModelValue(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sanitizeModelValue(item)])) as T;
  }
  return value;
}

function stripFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```\s*$/.exec(trimmed);
  return fence ? fence[1]!.trim() : trimmed;
}

/** Index of the brace that closes the object opened at `start`, or -1 when it never closes. */
function matchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Closes a JSON document that was cut off mid-way: drops the incomplete trailing element
 * and appends the missing brackets. Returns null when nothing useful can be recovered.
 */
export function salvageTruncatedJson(text: string): unknown | null {
  const source = stripFence(text);
  const start = source.indexOf("{");
  if (start < 0) return null;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  /** Position just after the last complete value inside an array, with the stack at that point. */
  let lastGood: { end: number; stack: string[] } | null = null;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") stack.push(char);
    else if (char === "}" || char === "]") {
      stack.pop();
      // A complete element of an array just ended.
      if (stack[stack.length - 1] === "[") lastGood = { end: i + 1, stack: [...stack] };
      if (stack.length === 0) return null; // not truncated at all: let the normal parser report the real error
    }
  }
  if (!lastGood) return null;
  const closers = [...lastGood.stack]
    .reverse()
    .map((open) => (open === "{" ? "}" : "]"))
    .join("");
  try {
    return JSON.parse(source.slice(start, lastGood.end) + closers);
  } catch {
    return null;
  }
}

/** Parses the first JSON object in model output. Throws ModelJsonError. */
export function parseModelJson(text: string): unknown {
  const source = stripFence(text);
  if (!source) throw new ModelJsonError("The model returned an empty response.", text);
  try {
    return JSON.parse(source);
  } catch {
    // fall through: look for an embedded object
  }
  const start = source.indexOf("{");
  if (start < 0) throw new ModelJsonError("The model response contains no JSON object.", text);
  const end = matchingBrace(source, start);
  if (end > start) {
    try {
      return JSON.parse(source.slice(start, end + 1));
    } catch {
      throw new ModelJsonError("The model response is not valid JSON.", text);
    }
  }
  throw new ModelJsonError("The model response is incomplete JSON (cut off).", text);
}
