import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { db } from "@/db";
import { RateLimitError } from "@/lib/errors";
import { clientIp, enforceRateLimit, purgeExpiredRateLimits, rateLimit } from "@/lib/rate-limit";
import { resetDatabase } from "./helpers/db";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function signInRequest(ip: string, email = "nobody@example.com") {
  return new Request("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": ip },
    body: JSON.stringify({ email, password: "wrong-password" }),
  });
}

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

  it("derives the client IP from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(clientIp(new Headers())).toBe("unknown");
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

  it("blocks guessing one account from many IPs", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const response = await authPost(signInRequest(`203.0.113.${i + 1}`, "target@example.com"));
      statuses.push(response.status);
    }
    expect(statuses.filter((status) => status === 429)).toHaveLength(2);
    const body = (await (await authPost(signInRequest("203.0.113.99", "target@example.com"))).json()) as { code: string };
    expect(body.code).toBe("RATE_LIMITED");
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
