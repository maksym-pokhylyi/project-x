import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paddle Billing webhook signature verification, implemented from
 * https://developer.paddle.com/webhooks/about/signature-verification ("Verify manually").
 *
 *   Paddle-Signature: ts=1671552777;h1=<hex hmac-sha256 of `${ts}:${rawBody}`>
 *
 * Why not `paddle.webhooks.unmarshal()` from the SDK: it hard-codes a 5 second timestamp
 * tolerance and needs an API-key-bound client. We verify with the documented algorithm,
 * a configurable tolerance (PADDLE_WEBHOOK_TOLERANCE_SECONDS, default 300 s) and support
 * for multiple `h1` values (Paddle sends several during secret rotation). Replays inside
 * the tolerance window are harmless because events are de-duplicated on `event_id`.
 *
 * PURE module: no env, no I/O. The raw body must be the exact bytes Paddle sent.
 */
export type SignatureFailure =
  | "missing_header"
  | "malformed_header"
  | "timestamp_out_of_tolerance"
  | "signature_mismatch";

export type SignatureResult = { valid: true; timestamp: number } | { valid: false; reason: SignatureFailure };

export function parsePaddleSignature(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "ts" && /^\d{1,15}$/.test(value)) timestamp = Number(value);
    else if (key === "h1" && /^[0-9a-f]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }
  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

export function computePaddleSignature(rawBody: string, secret: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}:${rawBody}`, "utf8").digest("hex");
}

export function verifyPaddleSignature(input: {
  rawBody: string;
  header: string | null | undefined;
  secret: string;
  toleranceSeconds: number;
  /** Injectable clock for tests. */
  now?: Date;
}): SignatureResult {
  if (!input.header) return { valid: false, reason: "missing_header" };
  const parsed = parsePaddleSignature(input.header);
  if (!parsed) return { valid: false, reason: "malformed_header" };

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > input.toleranceSeconds) {
    return { valid: false, reason: "timestamp_out_of_tolerance" };
  }

  const expected = Buffer.from(computePaddleSignature(input.rawBody, input.secret, parsed.timestamp), "hex");
  const matches = parsed.signatures.some((candidate) => {
    const given = Buffer.from(candidate, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  return matches ? { valid: true, timestamp: parsed.timestamp } : { valid: false, reason: "signature_mismatch" };
}

/** Builds a valid header. Used by tests and scripts/simulate-webhook.ts — never by the app. */
export function signPaddlePayload(rawBody: string, secret: string, now: Date = new Date()): string {
  const timestamp = Math.floor(now.getTime() / 1000);
  return `ts=${timestamp};h1=${computePaddleSignature(rawBody, secret, timestamp)}`;
}
