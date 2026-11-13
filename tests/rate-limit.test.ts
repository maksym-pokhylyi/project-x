import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { db } from "@/db";
import { RateLimitError } from "@/lib/errors";
import { KNOWN_DEVICE_COOKIE, MAIL_PER_ADDRESS, SIGN_IN_FAILURES_PER_EMAIL, knownDeviceValue } from "@/lib/auth-guard";
import { emailKey } from "@/lib/crypto";
import { clientIp, enforceRateLimit, peekRateLimit, purgeExpiredRateLimits, rateLimit } from "@/lib/rate-limit";
import { createTestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function signInRequest(ip: string, email = "nobody@example.com", password = "wrong-password", cookie?: string) {
  return new Request("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": ip, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ email, password }),
  });
}

function authRequest(path: string, ip: string, body: unknown) {
  return new Request(`http://localhost:3000/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const PASSWORD = "correct-horse-battery"; // what createTestUser() sets

describe("rateLimit (Postgres fixed window)", () => {
  beforeEach(resetDatabase);

  it("allows up to the limit, then blocks with a retry hint", async () => {
    const rule = { limit: 3, windowSeconds: 60 };
    const results = [];
    for (let i = 0; i < 5; i += 1) results.push(await rateLimit("test:key", rule));
    expect(results.map((result) => result.ok)).toEqual([true, true, true, false, false]);
    expect(results.map((result) => result.remaining)).toEqual([2, 1, 0, 0, 0]);
    const blocked = results[4]!;
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(blocked.resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("counts keys independently", async () => {
    const rule = { limit: 1, windowSeconds: 60 };
    expect((await rateLimit("user:a", rule)).ok).toBe(true);
    expect((await rateLimit("user:a", rule)).ok).toBe(false);
    expect((await rateLimit("user:b", rule)).ok).toBe(true);
  });

  it("is exact under concurrency", async () => {
    const rule = { limit: 5, windowSeconds: 60 };
    const results = await Promise.all(Array.from({ length: 25 }, () => rateLimit("burst", rule)));
    expect(results.filter((result) => result.ok)).toHaveLength(5);
  });

  it("resets when the window rolls over", async () => {
    const rule = { limit: 1, windowSeconds: 1 };
    // Start right after a window boundary so both calls land in the same window.
    await sleep(1000 - (Date.now() % 1000) + 20);
    expect((await rateLimit("rollover", rule)).ok).toBe(true);
    expect((await rateLimit("rollover", rule)).ok).toBe(false);
    await sleep(1050);
    expect((await rateLimit("rollover", rule)).ok).toBe(true);
  });

  it("enforceRateLimit throws a typed 429 error", async () => {
    const rule = { limit: 1, windowSeconds: 60 };
    await enforceRateLimit("typed", rule);
    const error = await enforceRateLimit("typed", rule).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toMatchObject({ status: 429, code: "RATE_LIMITED" });
  });

  it("purges only expired windows", async () => {
    await rateLimit("fresh", { limit: 5, windowSeconds: 60 });
    await db.execute(sql`insert into rate_limits (key, window_start, count, expires_at) values ('old', now() - interval '2 hours', 3, now() - interval '1 hour')`);
    expect(await purgeExpiredRateLimits()).toBe(1);
    const remaining = await db.execute<{ key: string }>(sql`select key from rate_limits`);
    expect(remaining.map((row) => row.key)).toEqual(["fresh"]);
  });

  it("peekRateLimit reads a window without consuming it", async () => {
    const rule = { limit: 2, windowSeconds: 60 };
    expect(await peekRateLimit("peek", rule)).toMatchObject({ ok: true, remaining: 2 });
    await rateLimit("peek", rule);
    expect(await peekRateLimit("peek", rule)).toMatchObject({ ok: true, remaining: 1 });
    await rateLimit("peek", rule);
    expect(await peekRateLimit("peek", rule)).toMatchObject({ ok: false, remaining: 0 });
    expect(await peekRateLimit("peek", rule)).toMatchObject({ ok: false, remaining: 0 }); // still not consumed
  });
});

describe("client IP comes only from headers the client cannot set (F-24)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load(overrides: Record<string, string>) {
    vi.unstubAllEnvs();
    vi.resetModules();
    for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
    return import("@/lib/rate-limit");
  }

  it("behind a declared proxy (TRUST_PROXY_HEADERS=1, as in this test run)", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("trusts nothing by default outside Vercel: a spoofed X-Forwarded-For does not create a new bucket", async () => {
    const { clientIp: untrusted, trustedIpHeaders } = await load({ TRUST_PROXY_HEADERS: "" });
    expect(trustedIpHeaders).toEqual([]);
    expect(untrusted(new Headers({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "203.0.113.8", "x-vercel-forwarded-for": "203.0.113.9" }))).toBe("unknown");
  });

  it("on Vercel uses the platform's headers", async () => {
    const { clientIp: onVercel } = await load({ TRUST_PROXY_HEADERS: "", VERCEL: "1", VERCEL_ENV: "preview" });
    expect(onVercel(new Headers({ "x-vercel-forwarded-for": "198.51.100.1", "x-forwarded-for": "198.51.100.1" }))).toBe("198.51.100.1");
    expect(onVercel(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
  });

  it("without a trusted header, rotating X-Forwarded-For no longer bypasses the per-IP sign-in limit", async () => {
    await resetDatabase();
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.stubEnv("TRUST_PROXY_HEADERS", "");
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) statuses.push((await POST(signInRequest(`198.51.100.${i + 1}`, `rotating${i}@example.com`))).status);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});

describe("auth endpoints are rate limited", () => {
  beforeEach(resetDatabase);

  it("blocks repeated sign-in attempts from one IP with 429", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const response = await authPost(signInRequest("198.51.100.20", `victim${i}@example.com`));
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 10).every((status) => status !== 429)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);

    // A different IP is unaffected.
    expect((await authPost(signInRequest("198.51.100.21"))).status).not.toBe(429);
  });

  describe("sign-in is limited per e-mail + IP pair, so nobody can lock someone else out (F-08)", () => {
    it("an attacker failing against a victim's address only locks out themselves", async () => {
      const victim = await createTestUser({ email: "victim@example.com" });
      // Ten hostile attempts used to be enough to block the address for everyone.
      for (let i = 0; i < 10; i += 1) expect((await authPost(signInRequest("203.0.113.66", victim.email))).status).toBe(401);
      await db.execute(sql`delete from rate_limits where key like 'auth:sign-in:ip:%'`); // look past the separate per-IP limit
      expect((await authPost(signInRequest("203.0.113.66", victim.email))).status).toBe(429); // the attacker's own pair

      // The same from several more addresses: still far below anything that affects the victim.
      for (const ip of ["203.0.113.67", "203.0.113.68", "203.0.113.69"]) {
        for (let i = 0; i < 9; i += 1) await authPost(signInRequest(ip, victim.email));
      }
      const response = await authPost(signInRequest("198.51.100.200", victim.email, PASSWORD));
      expect(response.status).toBe(200);
    });

    it("a distributed attack hits the per-e-mail failure ceiling, but never the owner's known device", async () => {
      const victim = await createTestUser({ email: "victim@example.com" });
      const failuresKey = `auth:sign-in:failures:${emailKey(victim.email)}`;

      // The owner signs in on their laptop: the browser is remembered.
      const first = await authPost(signInRequest("198.51.100.200", victim.email, PASSWORD));
      expect(first.status).toBe(200);
      const knownDevice = first.headers.getSetCookie().find((value) => value.startsWith(`${KNOWN_DEVICE_COOKIE}=`));
      expect(knownDevice).toMatch(new RegExp(`^${KNOWN_DEVICE_COOKIE}=v1\\.[0-9a-f]{32}\\.[A-Za-z0-9_-]{43}; Max-Age=15552000; Path=/; HttpOnly; SameSite=Lax$`));
      const cookie = knownDevice!.split(";")[0]!;
      // A successful sign-in is not a failure.
      expect((await peekRateLimit(failuresKey, SIGN_IN_FAILURES_PER_EMAIL)).remaining).toBe(SIGN_IN_FAILURES_PER_EMAIL.limit);

      // Real failed attempts are counted…
      expect((await authPost(signInRequest("203.0.113.1", victim.email))).status).toBe(401);
      expect((await peekRateLimit(failuresKey, SIGN_IN_FAILURES_PER_EMAIL)).remaining).toBe(SIGN_IN_FAILURES_PER_EMAIL.limit - 1);
      // …and a botnet supplies the rest.
      for (let i = 1; i < SIGN_IN_FAILURES_PER_EMAIL.limit; i += 1) await rateLimit(failuresKey, SIGN_IN_FAILURES_PER_EMAIL);

      // Further guesses from fresh addresses are refused, even with the right password…
      const stranger = await authPost(signInRequest("203.0.113.250", victim.email, PASSWORD));
      expect(stranger.status).toBe(429);
      expect(((await stranger.json()) as { code: string }).code).toBe("RATE_LIMITED");
      // …a forged or foreign known-device cookie does not help…
      const forged = `${KNOWN_DEVICE_COOKIE}=v1.${emailKey(victim.email)}.${"A".repeat(43)}`;
      expect((await authPost(signInRequest("203.0.113.251", victim.email, PASSWORD, forged))).status).toBe(429);
      const foreign = `${KNOWN_DEVICE_COOKIE}=${knownDeviceValue(emailKey("someone-else@example.com"))}`;
      expect((await authPost(signInRequest("203.0.113.252", victim.email, PASSWORD, foreign))).status).toBe(429);
      // …but the owner's own browser gets in.
      expect((await authPost(signInRequest("198.51.100.201", victim.email, PASSWORD, cookie))).status).toBe(200);
    });
  });

  it("limits e-mail-sending endpoints per target address, whatever the source", async () => {
    const victim = await createTestUser({ email: "inbox@example.com" });
    const statuses: number[] = [];
    for (let i = 0; i < MAIL_PER_ADDRESS.limit + 2; i += 1) {
      const path = i % 2 === 0 ? "/request-password-reset" : "/send-verification-email";
      statuses.push((await authPost(authRequest(path, `203.0.113.${i + 1}`, { email: victim.email, redirectTo: "/reset-password" }))).status);
    }
    expect(statuses.slice(0, MAIL_PER_ADDRESS.limit).every((status) => status === 200)).toBe(true);
    expect(statuses.slice(MAIL_PER_ADDRESS.limit)).toEqual([429, 429]);
    // Another address is unaffected, and the answer never depends on whether the address exists.
    expect((await authPost(authRequest("/request-password-reset", "203.0.113.90", { email: "other@example.com", redirectTo: "/reset-password" }))).status).toBe(200);
  });

  it("returns standard rate-limit headers", async () => {
    let response = await authPost(signInRequest("198.51.100.30"));
    for (let i = 0; i < 10; i += 1) response = await authPost(signInRequest("198.51.100.30", `x${i}@example.com`));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(response.headers.get("x-ratelimit-limit")).toBe("10");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
  });
});

describe("response time does not reveal whether an address is registered (F-27)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("password-reset requests take the same minimum time for known and unknown addresses", async () => {
    await resetDatabase();
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_TOOLS", "1");
    const { guardedAuthPost } = await import("@/lib/auth-guard");
    const timed = async (workMs: number, ip: string) => {
      const started = Date.now();
      const response = await guardedAuthPost(authRequest("/request-password-reset", ip, { email: `${ip}@example.com` }), async () => {
        await sleep(workMs);
        return Response.json({ status: true });
      });
      expect(response.status).toBe(200);
      return Date.now() - started;
    };
    const unknownAddress = await timed(0, "203.0.113.1"); // nothing to do
    const knownAddress = await timed(150, "203.0.113.2"); // renders and stores an e-mail
    expect(unknownAddress).toBeGreaterThanOrEqual(590);
    expect(knownAddress).toBeGreaterThanOrEqual(590);
    expect(Math.abs(knownAddress - unknownAddress)).toBeLessThan(120);
  });
});
