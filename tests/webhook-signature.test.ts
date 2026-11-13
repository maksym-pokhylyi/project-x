import { describe, expect, it } from "vitest";
import {
  computePaddleSignature,
  parsePaddleSignature,
  signPaddlePayload,
  verifyPaddleSignature,
} from "@/lib/billing/webhook-signature";

const secret = "pdl_ntfset_01gkpjp8bkm3tm53kdgkx6sms7_6h3qd3uFSi9YCD3OLYAShQI90XTI5vEI";
const body = JSON.stringify({ event_id: "evt_1", event_type: "subscription.created", data: { id: "sub_1" } });
const now = new Date("2026-11-13T12:00:00Z");
const verify = (overrides: Partial<Parameters<typeof verifyPaddleSignature>[0]> = {}) =>
  verifyPaddleSignature({ rawBody: body, header: signPaddlePayload(body, secret, now), secret, toleranceSeconds: 300, now, ...overrides });

describe("Paddle webhook signature", () => {
  it("matches an independently computed HMAC-SHA256 of `ts:body`", () => {
    // Known answer from `printf '1671552777:hello' | openssl dgst -sha256 -hmac secret`,
    // so the algorithm cannot silently drift from Paddle's documented scheme.
    expect(computePaddleSignature("hello", "secret", 1671552777)).toBe(
      "3f3a62ec599e093ab8d6b5a90a895ae5621cb6c785b9dfa1d322d51e5c83272a",
    );
    expect(signPaddlePayload(body, secret, now)).toMatch(/^ts=1794571200;h1=[0-9a-f]{64}$/);
  });

  it("accepts a valid signature", () => {
    expect(verify()).toEqual({ valid: true, timestamp: 1794571200 });
  });

  it("rejects a signature made with a different secret", () => {
    expect(verify({ header: signPaddlePayload(body, "another-secret", now) })).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("rejects a tampered body, even by one byte or added whitespace", () => {
    expect(verify({ rawBody: body.replace("evt_1", "evt_2") })).toEqual({ valid: false, reason: "signature_mismatch" });
    expect(verify({ rawBody: `${body} ` })).toEqual({ valid: false, reason: "signature_mismatch" });
    expect(verify({ rawBody: JSON.stringify(JSON.parse(body), null, 2) })).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("rejects a tampered timestamp (signature no longer covers it)", () => {
    const header = signPaddlePayload(body, secret, now).replace("ts=1794571200", "ts=1794571201");
    expect(verify({ header })).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("rejects missing and malformed headers", () => {
    expect(verify({ header: null })).toEqual({ valid: false, reason: "missing_header" });
    expect(verify({ header: "" })).toEqual({ valid: false, reason: "missing_header" });
    expect(verify({ header: "garbage" })).toEqual({ valid: false, reason: "malformed_header" });
    expect(verify({ header: "ts=abc;h1=zz" })).toEqual({ valid: false, reason: "malformed_header" });
    expect(verify({ header: "ts=1794571200" })).toEqual({ valid: false, reason: "malformed_header" });
    expect(verify({ header: `h1=${"a".repeat(64)}` })).toEqual({ valid: false, reason: "malformed_header" });
  });

  it("rejects timestamps outside the tolerance window in both directions", () => {
    const old = signPaddlePayload(body, secret, new Date(now.getTime() - 301_000));
    const future = signPaddlePayload(body, secret, new Date(now.getTime() + 301_000));
    expect(verify({ header: old })).toEqual({ valid: false, reason: "timestamp_out_of_tolerance" });
    expect(verify({ header: future })).toEqual({ valid: false, reason: "timestamp_out_of_tolerance" });
    const edge = signPaddlePayload(body, secret, new Date(now.getTime() - 300_000));
    expect(verify({ header: edge }).valid).toBe(true);
  });

  it("accepts any matching h1 when several are sent (secret rotation)", () => {
    const good = signPaddlePayload(body, secret, now).split("h1=")[1];
    const header = `ts=1794571200;h1=${"0".repeat(64)};h1=${good}`;
    expect(verify({ header }).valid).toBe(true);
  });

  it("parses headers tolerantly but strictly validates values", () => {
    expect(parsePaddleSignature(`ts=1;h1=${"A".repeat(64)}`)).toEqual({ timestamp: 1, signatures: ["a".repeat(64)] });
    expect(parsePaddleSignature("ts=1;h1=short")).toBeNull();
  });
});
