import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { GET as cronJobs } from "@/app/api/cron/jobs/route";
import { GET as health } from "@/app/api/health/route";
import { hasOpenMarkers } from "@/components/marketing/legal-document";
import { PLANS, PLAN_KEYS, QUOTA_METRIC_KEYS, annualSavingsPercent, formatPrice, planRank } from "@/config/plans";
import { identityText, operatorAddress, pendingOperatorDetails, site, ukRepresentativeLine } from "@/config/site";
import { db } from "@/db";
import { errorLog, jobs } from "@/db/schema";
import { AppError, QuotaExceededError, ValidationError, serializeError } from "@/lib/errors";
import { newId, slugify } from "@/lib/ids";
import { safeRedirect } from "@/lib/redirects";
import { reportError } from "@/lib/report-error";
import { buildSentryEnvelope } from "@/lib/sentry";
import { isValidStorageKey, orgFileKey, organizationIdFromKey, storage, verifyLocalSignedUrl } from "@/lib/storage";
import { emailSchema, inviteSchema, parseInput, signUpSchema, workspaceSchema } from "@/lib/validation";
import { getAdminMetrics, monthlyRevenueCents } from "@/server/admin";
import { route, runAction } from "@/server/http";
import { hasRole } from "@/server/workspaces";
import { actAs, createTestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";

describe("plan catalogue", () => {
  it("defines every limit and feature for every plan", () => {
    for (const key of PLAN_KEYS) {
      const plan = PLANS[key];
      expect(plan.key).toBe(key);
      expect(plan.limits.seats === null || plan.limits.seats > 0).toBe(true);
      expect(plan.limits.aiMonthlyBudgetUsd).toBeGreaterThanOrEqual(0);
      for (const metric of QUOTA_METRIC_KEYS) expect(plan.limits).toHaveProperty(metric);
      expect(Object.keys(plan.features).sort()).toEqual(Object.keys(PLANS.free.features).sort());
      if (key === "free") expect(plan.prices).toBeNull();
      else expect(plan.prices!.year).toBeLessThan(plan.prices!.month * 12);
    }
    expect(planRank("business")).toBeGreaterThan(planRank("starter"));
    expect(formatPrice(2900)).toBe("£29");
    expect(formatPrice(2950)).toBe("£29.50");
    expect(formatPrice(149000)).toBe("£1,490");
    expect(annualSavingsPercent(PLANS.starter)).toBe(17);
    expect(annualSavingsPercent(PLANS.free)).toBe(0);
  });
});

describe("helpers", () => {
  it("safeRedirect only allows same-site paths", () => {
    expect(safeRedirect("/app/settings/billing?plan=pro")).toBe("/app/settings/billing?plan=pro");
    expect(safeRedirect(undefined)).toBe("/app");
    expect(safeRedirect("https://evil.example")).toBe("/app");
    expect(safeRedirect("//evil.example")).toBe("/app");
    expect(safeRedirect("/\\evil.example")).toBe("/app");
    expect(safeRedirect("javascript:alert(1)")).toBe("/app");
    expect(safeRedirect("/ok\r\nSet-Cookie: x=1")).toBe("/app");
    expect(safeRedirect("", "/sign-in")).toBe("/sign-in");
  });

  it("slugify and newId produce safe identifiers", () => {
    expect(slugify("Ada's Workspace!")).toBe("ada-s-workspace");
    expect(slugify("  Ünïcödé  Corp  ")).toBe("unicode-corp");
    expect(slugify("!!!")).toBe("workspace");
    expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(40);
    expect(newId()).toMatch(/^[0-9A-Za-z]{32}$/);
    expect(newId()).not.toBe(newId());
  });

  it("role hierarchy", () => {
    expect(hasRole("owner", "admin")).toBe(true);
    expect(hasRole("admin", "admin")).toBe(true);
    expect(hasRole("member", "admin")).toBe(false);
    expect(hasRole("admin", "owner")).toBe(false);
  });

  it("validation schemas normalise and reject bad input", () => {
    expect(emailSchema.parse("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(signUpSchema.safeParse({ name: "", email: "x", password: "short" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.co", role: "owner" }).success).toBe(false);
    expect(workspaceSchema.parse({ name: "  Acme Ltd  " })).toEqual({ name: "Acme Ltd" });
    try {
      parseInput(signUpSchema, { name: "", email: "x", password: "short" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(Object.keys((error as ValidationError).details!.fieldErrors as object).sort()).toEqual(["email", "name", "password"]);
    }
  });

  it("typed errors serialise without leaking internals", () => {
    expect(serializeError(new QuotaExceededError("units", 50, 50))).toMatchObject({ code: "QUOTA_EXCEEDED", details: { metric: "units", limit: 50, used: 50 } });
    expect(serializeError(new Error("password=hunter2 at 10.0.0.1"))).toEqual({
      code: "INTERNAL",
      message: "Something went wrong on our side. Please try again.",
    });
  });

  it("names the operator, and says which of their details are still pending", () => {
    // The seller identity is real (supplied by the owner): nothing in it may be a marker.
    expect(hasOpenMarkers(site.operator, operatorAddress, identityText)).toBe(false);
    expect(identityText).toContain("operated by Maksym Pokhylyi, an independent sole trader registered in Ukraine (Kremenchuk)");
    // Guard for launch: this starts failing once the UK representative or the ICO reference
    // is filled in — then check the pages that print them and update the list.
    expect(pendingOperatorDetails()).toEqual(["ukRepresentative", "icoRegistrationNumber"]);
    expect(ukRepresentativeLine).toBe(`UK representative: being appointed — contact ${site.supportEmail}`);
    // A document that still has a marker for the lawyer is reported as a draft.
    expect(hasOpenMarkers("Governed by the laws of [[GOVERNING_LAW_JURISDICTION]].")).toBe(true);
    expect(hasOpenMarkers("Refunds within 14 days.", ["a", "b"])).toBe(false);
  });
});

describe("storage", () => {
  it("validates keys and tenant namespaces", () => {
    expect(isValidStorageKey("org/abc/logo/x.png")).toBe(true);
    for (const bad of ["", "/abs", "a/../b", "a//b", "a/b/", "../x", "a b", "a\\b", "a/./b", "x".repeat(600)]) {
      expect(isValidStorageKey(bad), bad).toBe(false);
    }
    expect(orgFileKey("org1", "logo", "a.png")).toBe("org/org1/logo/a.png");
    expect(() => orgFileKey("org1", "..", "a.png")).toThrow();
    expect(organizationIdFromKey("org/org1/logo/a.png")).toBe("org1");
    expect(organizationIdFromKey("org/org1")).toBeNull();
    expect(organizationIdFromKey("public/a.png")).toBeNull();
  });

  it("round-trips a file on the local backend and signs URLs", async () => {
    const key = orgFileKey("org_storage_test", "docs", "hello.txt");
    await storage.put(key, new TextEncoder().encode("hello"), { contentType: "text/plain" });
    const file = await storage.get(key);
    expect(file?.contentType).toBe("text/plain");
    expect(file?.size).toBe(5);
    expect(await new Response(file!.body).text()).toBe("hello");

    const url = new URL(await storage.signedUrl(key, { expiresInSeconds: 60 }));
    expect(url.pathname).toBe(`/api/files/${key}`);
    const expires = url.searchParams.get("expires");
    const signature = url.searchParams.get("signature");
    expect(verifyLocalSignedUrl(key, expires, signature)).toBe(true);
    expect(verifyLocalSignedUrl(`${key}x`, expires, signature)).toBe(false);
    expect(verifyLocalSignedUrl(key, String(Number(expires) + 1), signature)).toBe(false);
    expect(verifyLocalSignedUrl(key, expires, signature, new Date(Date.now() + 120_000))).toBe(false);
    expect(verifyLocalSignedUrl(key, null, null)).toBe(false);

    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });
});

describe("error reporting and wrappers", () => {
  beforeEach(resetDatabase);

  it("reportError writes error_log with request context and never throws", async () => {
    await reportError(new Error("boom"), { requestId: "req_1", route: "/api/x", method: "POST", organizationId: "org_1", userId: "user_1" });
    await reportError("a string was thrown");
    const rows = await db.select().from(errorLog);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.message === "boom")).toMatchObject({ requestId: "req_1", route: "/api/x", method: "POST", organizationId: "org_1", userId: "user_1" });
    expect(rows.find((row) => row.message === "boom")?.stack).toContain("Error: boom");
  });

  it("route() maps expected errors to their status and records unexpected ones", async () => {
    const expected = await route(async () => {
      throw new AppError("CONFLICT", "Already exists", 409);
    })(new Request("http://localhost:3000/api/x", { headers: { "x-request-id": "req_42" } }), undefined);
    expect(expected.status).toBe(409);
    expect(expected.headers.get("x-request-id")).toBe("req_42");
    expect(await expected.json()).toEqual({ error: { code: "CONFLICT", message: "Already exists" }, requestId: "req_42" });
    expect(await db.select().from(errorLog)).toHaveLength(0);

    const unexpected = await route(async () => {
      throw new Error("db password is hunter2");
    })(new Request("http://localhost:3000/api/y", { method: "POST" }), undefined);
    expect(unexpected.status).toBe(500);
    const body = (await unexpected.json()) as { error: { code: string; message: string }; requestId: string };
    expect(body.error.code).toBe("INTERNAL");
    expect(body.error.message).not.toContain("hunter2");
    const [logged] = await db.select().from(errorLog);
    expect(logged).toMatchObject({ route: "/api/y", method: "POST", requestId: body.requestId, message: "db password is hunter2" });
  });

  it("runAction returns typed results", async () => {
    expect(await runAction("t", async () => 42)).toEqual({ ok: true, data: 42 });
    expect(await runAction("t", async () => Promise.reject(new ValidationError()))).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await runAction("t", async () => Promise.reject(new Error("secret detail")))).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." },
    });
    expect((await db.select().from(errorLog)).map((row) => row.route)).toEqual(["action:t"]);
  });

  it("builds a Sentry envelope for the DSN's project", () => {
    const envelope = buildSentryEnvelope(
      "https://abc123@o1.ingest.sentry.io/4500",
      new Error("kaput"),
      { requestId: "req_9", route: "/api/z", organizationId: "org_9", userId: "user_9" },
      new Date("2026-11-13T12:00:00Z"),
    );
    expect(envelope.endpoint).toBe("https://o1.ingest.sentry.io/api/4500/envelope/");
    expect(envelope.headers["x-sentry-auth"]).toContain("sentry_key=abc123");
    const [header, item, event] = envelope.body.split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(header).toMatchObject({ dsn: "https://abc123@o1.ingest.sentry.io/4500" });
    expect(item).toEqual({ type: "event" });
    expect(event).toMatchObject({
      level: "error",
      transaction: "/api/z",
      user: { id: "user_9" },
      tags: { request_id: "req_9", organization_id: "org_9" },
      exception: { values: [{ type: "Error", value: "kaput" }] },
    });
  });
});

describe("operational routes", () => {
  beforeEach(resetDatabase);

  it("GET /api/health checks the database", async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", database: "ok" });
  });

  it("GET /api/cron/jobs requires the cron secret and runs the worker", async () => {
    const call = (authorization?: string) =>
      cronJobs(new Request("http://localhost:3000/api/cron/jobs", { headers: authorization ? { authorization } : {} }), undefined);
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong-secret")).status).toBe(401);
    expect((await call("test-cron-secret-0123456789")).status).toBe(401);
    expect(await db.select().from(jobs)).toHaveLength(0);

    const ok = await call("Bearer test-cron-secret-0123456789");
    expect(ok.status).toBe(200);
    // The two daily jobs, plus whichever scheduled e-mail fan-outs are due at this time of day (tests/notifications).
    const summary = (await ok.json()) as { ok: boolean; claimed: number; succeeded: number };
    expect(summary).toMatchObject({ ok: true, succeeded: summary.claimed });
    expect(summary.claimed).toBeGreaterThanOrEqual(2);
    // The daily maintenance and billing-reconciliation jobs are scheduled once per day, however often cron fires.
    await call("Bearer test-cron-secret-0123456789");
    const daily = (await db.select().from(jobs)).map((job) => job.type).filter((type) => !type.startsWith("notifications."));
    expect(daily.sort()).toEqual(["billing.reconcile", "maintenance.cleanup"]);
  });
});

describe("founder metrics", () => {
  beforeEach(resetDatabase);

  it("estimates MRR from catalogue prices", () => {
    // Catalogue prices in pence: Bid Desk ("pro") £149 a month / £1,490 a year, Radar Pro ("starter") £29 a month.
    expect(monthlyRevenueCents({ status: "active", planKey: "pro", billingInterval: "month", quantity: 1 })).toBe(14900);
    expect(monthlyRevenueCents({ status: "active", planKey: "pro", billingInterval: "year", quantity: 1 })).toBe(Math.round(149000 / 12));
    expect(monthlyRevenueCents({ status: "past_due", planKey: "starter", billingInterval: "month", quantity: 2 })).toBe(5800);
    for (const status of ["trialing", "canceled", "paused"]) {
      expect(monthlyRevenueCents({ status, planKey: "pro", billingInterval: "month", quantity: 1 })).toBe(0);
    }
    expect(monthlyRevenueCents({ status: "active", planKey: "unknown", billingInterval: "month", quantity: 1 })).toBe(0);
  });

  it("is only available to verified founders", async () => {
    const user = await createTestUser();
    actAs(user);
    await expect(getAdminMetrics()).rejects.toMatchObject({ code: "FORBIDDEN" });
    actAs(null);
    await expect(getAdminMetrics()).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const founder = await createTestUser({ email: "founder@example.com" });
    actAs(founder);
    const metrics = await getAdminMetrics();
    expect(metrics.signups.total).toBe(2);
    expect(metrics.organizations.total).toBe(2);
    expect(metrics.mrrCents).toBe(0);
    expect(metrics.trials.conversionRate).toBeNull();
  });
});
