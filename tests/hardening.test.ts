import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { POST as uploadLogo } from "@/app/api/workspace/logo/route";
import { db } from "@/db";
import { events, members, organizations, users } from "@/db/schema";
import { sanitizeAnalyticsEvent, sanitizeAnalyticsUrl } from "@/lib/analytics-url";
import { analyticsOriginsFromEnv, buildContentSecurityPolicy, createNonce } from "@/lib/csp";
import { isTrustedRequestOrigin, json, route } from "@/server/http";
import { createPersonalWorkspace } from "@/server/workspaces";
import { actAs, createTestUser, type TestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";

const ORIGIN = "http://localhost:3000";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe("analytics never receives URLs that are credentials (F-18)", () => {
  it("drops query strings and opaque ids on the authentication routes", () => {
    expect(sanitizeAnalyticsUrl("https://bidfolio.co.uk/reset-password?token=Ab3dEf6hIj9lMn2pQr5tUv8x")).toBe("https://bidfolio.co.uk/reset-password");
    expect(sanitizeAnalyticsUrl("https://bidfolio.co.uk/verify-email/confirm?token=eyJhbGciOi.J9.x&redirect=%2Fapp")).toBe("https://bidfolio.co.uk/verify-email/confirm");
    expect(sanitizeAnalyticsUrl("https://bidfolio.co.uk/verify-email?email=jo%40example.com&redirect=%2Fapp")).toBe("https://bidfolio.co.uk/verify-email");
    expect(sanitizeAnalyticsUrl("https://bidfolio.co.uk/accept-invitation/Zk3vQ9sT7uWxY2aB4cD6eF8gH0jK1mN5")).toBe("https://bidfolio.co.uk/accept-invitation/[id]");
    expect(sanitizeAnalyticsUrl("https://bidfolio.co.uk/api/auth/reset-password/Ab3dEf6hIj9lMn2pQr5tUv8x?callbackURL=%2Freset-password")).toBe(
      "https://bidfolio.co.uk/api/auth/reset-password/[token]",
    );
    expect(sanitizeAnalyticsUrl("https://bidfolio.co.uk/api/auth/verify-email?token=abc&callbackURL=%2Fapp")).toBe("https://bidfolio.co.uk/api/auth/verify-email");
    expect(sanitizeAnalyticsUrl("https://bidfolio.co.uk/sign-up?email=jo%40example.com&plan=pro#x")).toBe("https://bidfolio.co.uk/sign-up");
    expect(sanitizeAnalyticsUrl("/dev/outbox?key=dev-tools-secret")).toBe("/dev/outbox");
  });

  it("keeps ordinary pages, minus sensitive parameters", () => {
    expect(sanitizeAnalyticsUrl("https://bidfolio.co.uk/pricing?interval=year")).toBe("https://bidfolio.co.uk/pricing?interval=year");
    expect(sanitizeAnalyticsUrl("/app/settings/billing?plan=pro&interval=month")).toBe("/app/settings/billing?plan=pro&interval=month");
    expect(sanitizeAnalyticsUrl("https://bidfolio.co.uk/app/files?signature=abc&expires=123&tab=all")).toBe("https://bidfolio.co.uk/app/files?tab=all");
    expect(sanitizeAnalyticsUrl("https://referrer.example/some/page?q=1")).toBe("https://referrer.example/some/page?q=1");
    expect(sanitizeAnalyticsUrl("")).toBe("");
  });

  it("sanitises every URL property of an event (what posthog.before_send receives)", () => {
    const event = sanitizeAnalyticsEvent({
      event: "$pageview",
      properties: {
        $current_url: "https://bidfolio.co.uk/reset-password?token=SECRET",
        $referrer: "https://bidfolio.co.uk/accept-invitation/INVITATIONID",
        $pathname: "/accept-invitation/INVITATIONID",
        $initial_referrer: "$direct",
        other: "untouched?token=x",
        $set_once: { $initial_current_url: "https://bidfolio.co.uk/verify-email/confirm?token=SECRET" },
      },
      $set: { $current_url: "https://bidfolio.co.uk/sign-in?redirect=%2Fapp" },
    });
    expect(JSON.stringify(event)).not.toContain("SECRET");
    expect(JSON.stringify(event)).not.toContain("INVITATIONID");
    expect(event.properties).toMatchObject({
      $current_url: "https://bidfolio.co.uk/reset-password",
      $referrer: "https://bidfolio.co.uk/accept-invitation/[id]",
      $pathname: "/accept-invitation/[id]",
      $initial_referrer: "$direct",
      other: "untouched?token=x",
    });
    expect(event.$set).toEqual({ $current_url: "https://bidfolio.co.uk/sign-in" });
    expect(sanitizeAnalyticsEvent(null)).toBeNull();
  });
});

describe("state-changing route handlers refuse cross-site requests (F-22)", () => {
  const request = (method: string, headers: Record<string, string> = {}) => new Request(`${ORIGIN}/api/x`, { method, headers });

  it("checks Origin against the trusted origins, then Sec-Fetch-Site", () => {
    expect(isTrustedRequestOrigin(request("POST", { origin: ORIGIN }))).toBe(true);
    expect(isTrustedRequestOrigin(request("POST", { origin: "https://evil.example" }))).toBe(false);
    expect(isTrustedRequestOrigin(request("POST", { origin: "http://localhost:3000.evil.example" }))).toBe(false);
    expect(isTrustedRequestOrigin(request("POST", { origin: "null" }))).toBe(false);
    expect(isTrustedRequestOrigin(request("DELETE", { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isTrustedRequestOrigin(request("PUT", { "sec-fetch-site": "same-site" }))).toBe(false);
    expect(isTrustedRequestOrigin(request("POST", { "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isTrustedRequestOrigin(request("POST"))).toBe(true); // not a browser: no ambient cookies
    expect(isTrustedRequestOrigin(request("GET", { origin: "https://evil.example" }))).toBe(true); // safe method
  });

  it("route() answers 403 before running the handler; { csrf: false } opts out", async () => {
    let ran = 0;
    const handler = async () => {
      ran += 1;
      return json({ ok: true });
    };
    const refused = await route(handler)(request("POST", { origin: "https://evil.example" }), undefined);
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { error: { code: string } }).error.code).toBe("FORBIDDEN");
    expect(ran).toBe(0);
    expect((await route(handler)(request("POST", { origin: ORIGIN }), undefined)).status).toBe(200);
    expect((await route(handler, { csrf: false })(request("POST", { origin: "https://paddle.example" }), undefined)).status).toBe(200);
    expect(ran).toBe(2);
  });

  describe("POST /api/workspace/logo", () => {
    let owner: TestUser;
    const upload = (headers: Record<string, string>, file: Uint8Array = PNG) => {
      const form = new FormData();
      form.set("file", new File([file as BlobPart], "logo.png", { type: "image/png" }));
      return uploadLogo(new Request(`${ORIGIN}/api/workspace/logo`, { method: "POST", headers, body: form }), undefined);
    };

    beforeEach(async () => {
      await resetDatabase();
      owner = await createTestUser({ email: "owner@example.com" });
      actAs(owner);
    });

    it("no longer accepts a request with the session cookie from another origin", async () => {
      const crossSite = await upload({ origin: "https://evil.example" });
      expect(crossSite.status).toBe(403);
      expect((await db.select().from(organizations))[0]!.logo).toBeNull();
      expect(await db.select().from(events).then((rows) => rows.filter((row) => row.name === "workspace.logo_uploaded"))).toHaveLength(0);

      const sameSite = await upload({ origin: ORIGIN });
      expect(sameSite.status).toBe(200);
      expect((await db.select().from(organizations))[0]!.logo).toMatch(/^\/api\/files\/org\/.+\/logo\/.+\.png$/);
    });

    it("stops reading an oversized body even when Content-Length is missing or wrong", async () => {
      const big = new Uint8Array(3 * 1024 * 1024);
      big.set(PNG);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let offset = 0; offset < big.length; offset += 64 * 1024) controller.enqueue(big.subarray(offset, offset + 64 * 1024));
          controller.close();
        },
      });
      const response = await uploadLogo(
        new Request(`${ORIGIN}/api/workspace/logo`, {
          method: "POST",
          headers: { origin: ORIGIN, "content-type": "multipart/form-data; boundary=x" },
          body: stream,
          duplex: "half",
        } as RequestInit),
        undefined,
      );
      expect(response.status).toBe(400);
      expect(((await response.json()) as { error: { message: string } }).error.message).toContain("1 MB");
    });
  });
});

describe("/dev/outbox on a production build needs an admin session or the secret (F-16)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load(overrides: Record<string, string>) {
    vi.unstubAllEnvs();
    vi.resetModules();
    for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
    return (await import("@/server/dev-tools")).canAccessDevTools;
  }

  it("is open in local development and closed when dev tools are off", async () => {
    actAs(null);
    expect(await (await load({}))()).toBe(true);
    expect(await (await load({ NODE_ENV: "production" }))("anything")).toBe(false);
    expect(await (await load({ NODE_ENV: "production", VERCEL_ENV: "production", DEV_TOOLS: "1", DEV_TOOLS_SECRET: "a-long-enough-secret" }))("a-long-enough-secret")).toBe(false);
  });

  it("with DEV_TOOLS=1 on a production build: anonymous visitors and ordinary users are refused", async () => {
    await resetDatabase();
    const user = await createTestUser({ email: "someone@example.com" });
    const founder = await createTestUser({ email: "founder@example.com" });
    const canAccess = await load({ NODE_ENV: "production", DEV_TOOLS: "1", DEV_TOOLS_SECRET: "a-long-enough-secret" });

    actAs(null);
    expect(await canAccess()).toBe(false);
    expect(await canAccess("")).toBe(false);
    expect(await canAccess("wrong-secret-wrong-secret")).toBe(false);
    expect(await canAccess("a-long-enough-secret")).toBe(true);
    actAs(user);
    expect(await canAccess()).toBe(false);
    actAs(founder);
    expect(await canAccess()).toBe(true);

    // Without a configured secret only the founder gets in.
    const noSecret = await load({ NODE_ENV: "production", DEV_TOOLS: "1" });
    actAs(null);
    expect(await noSecret("a-long-enough-secret")).toBe(false);
    actAs(founder);
    expect(await noSecret()).toBe(true);
  });
});

describe("analytics forwarding does not block the caller (F-26)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("posthog-node");
  });

  it("track() returns as soon as the event is stored, even when PostHog is slow or down", async () => {
    await resetDatabase();
    let captures = 0;
    let release: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => (release = resolve));
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.resetModules();
    vi.doMock("posthog-node", () => ({
      PostHog: class {
        async captureImmediate() {
          captures += 1;
          await slow; // a provider that hangs
          throw new Error("posthog is down");
        }
      },
    }));
    const { track } = await import("@/lib/analytics");

    const started = Date.now();
    await track("workspace.created", {}, { personal: true });
    expect(Date.now() - started).toBeLessThan(1000);
    expect((await db.select().from(events)).map((row) => row.name)).toEqual(["workspace.created"]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(captures).toBe(1); // forwarding did start, in the background
    release();
    await new Promise((resolve) => setTimeout(resolve, 20)); // and its failure is swallowed
  });
});

describe("personal workspace creation is idempotent (F-21)", () => {
  it("parallel first requests create exactly one workspace", async () => {
    await resetDatabase();
    await db.insert(users).values({ id: "user_parallel", name: "Pat Parallel", email: "pat@example.com", emailVerified: true });
    const ids = await Promise.all(Array.from({ length: 8 }, () => createPersonalWorkspace({ id: "user_parallel", name: "Pat Parallel", email: "pat@example.com" })));
    expect(new Set(ids).size).toBe(1);
    expect(await db.select().from(organizations)).toHaveLength(1);
    expect(await db.select().from(members)).toHaveLength(1);
    expect(await db.select().from(events).then((rows) => rows.filter((row) => row.name === "workspace.created"))).toHaveLength(1);
  });
});

describe("Content-Security-Policy (F-17)", () => {
  const directive = (policy: string, name: string) => policy.split("; ").find((entry) => entry.startsWith(`${name} `)) ?? "";

  it("dynamic pages: a nonce with 'strict-dynamic' and no 'unsafe-inline' or 'unsafe-eval' for scripts", () => {
    const policy = buildContentSecurityPolicy({ nonce: "abc123==", isDevelopment: false, upgradeInsecureRequests: true });
    const scripts = directive(policy, "script-src");
    expect(scripts).toBe("script-src 'self' 'nonce-abc123==' 'strict-dynamic' https://cdn.paddle.com https://public.profitwell.com");
    expect(scripts).not.toContain("unsafe");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(directive(policy, "frame-src")).toBe("frame-src https://buy.paddle.com https://sandbox-buy.paddle.com");
    expect(policy.endsWith("upgrade-insecure-requests")).toBe(true);
  });

  it("static pages keep the inline allowance they need; development adds eval for React", () => {
    const statik = buildContentSecurityPolicy({ isDevelopment: false, upgradeInsecureRequests: false });
    expect(directive(statik, "script-src")).toBe("script-src 'self' 'unsafe-inline' https://cdn.paddle.com https://public.profitwell.com");
    expect(statik).not.toContain("upgrade-insecure-requests");
    expect(directive(buildContentSecurityPolicy({ nonce: "n", isDevelopment: true, upgradeInsecureRequests: false }), "script-src")).toContain("'unsafe-eval'");
  });

  it("allows PostHog only when it is configured", () => {
    expect(analyticsOriginsFromEnv(undefined, "https://eu.i.posthog.com")).toEqual([]);
    const origins = analyticsOriginsFromEnv("phc_key", "https://eu.i.posthog.com/ingest");
    expect(origins).toEqual(["https://*.posthog.com", "https://eu.i.posthog.com"]);
    const policy = buildContentSecurityPolicy({ nonce: "n", isDevelopment: false, upgradeInsecureRequests: false, analyticsOrigins: origins });
    expect(directive(policy, "connect-src")).toContain("https://eu.i.posthog.com");
    expect(directive(policy, "script-src")).toContain("https://*.posthog.com");
  });

  it("nonces are unpredictable and unique", () => {
    const nonces = new Set(Array.from({ length: 200 }, createNonce));
    expect(nonces.size).toBe(200);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
