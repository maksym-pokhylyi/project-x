import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_MAX_INPUT_TOKENS, AI_RATE_LIMIT, estimateInputTokens, worstCaseCostUsd } from "@/config/ai";
import { PLANS } from "@/config/plans";
import { db } from "@/db";
import { aiUsage, organizations, subscriptions } from "@/db/schema";
import {
  AiBudgetExceededError,
  AiInputTooLargeError,
  aiBudgetLimits,
  generateAiText,
  getAiSpendUsd,
  providerRejectedRequest,
  reserveAiBudget,
  settleStaleAiReservations,
  startOfUtcDay,
} from "@/lib/ai";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { RateLimitError } from "@/lib/errors";
import { resetDatabase } from "./helpers/db";

/**
 * F-03 — AI budgets are hard limits: concurrency-safe (reserve before spending), failed
 * calls are not free, and free workspaces cannot drain the pool paying customers use.
 * Test environment: AI_DAILY_BUDGET_USD = 1.
 */
const FREE = "org_budget_free";
const PAID = "org_budget_paid";
const NOW = new Date(Date.UTC(2026, 10, 15, 12, 0, 0)); // mid-month, midday UTC

function model(options: { input?: number; output?: number; delayMs?: number; fail?: () => unknown } = {}) {
  const doGenerate = vi.fn(async () => {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    if (options.fail) throw options.fail();
    return {
      content: [{ type: "text" as const, text: "ok" }],
      finishReason: { unified: "stop" as const, raw: undefined },
      usage: {
        inputTokens: { total: options.input ?? 1000, noCache: options.input ?? 1000, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: options.output ?? 500, text: options.output ?? 500, reasoning: undefined },
      },
      warnings: [],
    };
  });
  return { instance: new MockLanguageModelV4({ provider: "mock", modelId: "test-model", doGenerate }), doGenerate };
}

async function createOrg(id: string, planKey?: string) {
  await db.insert(organizations).values({ id, name: id, slug: id, createdAt: new Date() });
  if (planKey) await db.insert(subscriptions).values({ organizationId: id, status: "active", planKey, paddleSubscriptionId: `sub_${id}` });
}

const spend = (organizationId: string, costUsd: number, createdAt: Date, planKey: string | null = null) =>
  db.insert(aiUsage).values({ organizationId, feature: "seed", model: "mock/test-model", costUsd, createdAt, planKey });

const reserve = (organizationId: string, reserveUsd: number, now = NOW) =>
  reserveAiBudget({ organizationId, feature: "t", model: "mock/test-model", reserveUsd, now });

const rowsOf = (organizationId: string) => db.select().from(aiUsage).where(eq(aiUsage.organizationId, organizationId));

describe("AI budgets (F-03)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createOrg(FREE);
    await createOrg(PAID, "pro");
  });

  it("derives four ceilings from the plan and the environment", async () => {
    expect(aiBudgetLimits(await getOrgEntitlements(FREE))).toEqual({
      organizationMonthlyUsd: PLANS.free.limits.aiMonthlyBudgetUsd, // 0.50
      organizationDailyUsd: 0.1, // 20% of the monthly allowance
      globalDailyUsd: 1,
      freePoolDailyUsd: 0.25, // 25% of the global day
    });
    expect(aiBudgetLimits(await getOrgEntitlements(PAID))).toEqual({
      organizationMonthlyUsd: 25,
      organizationDailyUsd: 0.5, // 50% of monthly would be 12.50; capped at half the global day
      globalDailyUsd: 1,
      freePoolDailyUsd: null,
    });
  });

  describe("concurrency", () => {
    it("40 parallel calls cannot overspend: only what fits is admitted, the rest never reach the provider", async () => {
      const { instance, doGenerate } = model({ delayMs: 60 });
      const perCallWorstCase = worstCaseCostUsd("mock/test-model", estimateInputTokens(2), 1024);
      const admitted = Math.floor(0.5 / perCallWorstCase); // PAID's daily ceiling
      expect(admitted).toBeGreaterThan(1);
      expect(admitted).toBeLessThan(40);

      let peakHeld = 0;
      const watch = setInterval(() => void getAiSpendUsd(startOfUtcDay(new Date()), PAID).then((held) => (peakHeld = Math.max(peakHeld, held))), 10);
      const results = await Promise.allSettled(
        Array.from({ length: 40 }, () => generateAiText({ organizationId: PAID, feature: "burst", model: instance, prompt: "hi" })),
      );
      clearInterval(watch);

      const succeeded = results.filter((result) => result.status === "fulfilled").length;
      const refused = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      // At least what fits at once; a few more may be admitted after early calls settle to their
      // (lower) real cost — but never all 40, and never beyond the ceiling.
      expect(succeeded).toBeGreaterThanOrEqual(admitted);
      expect(succeeded).toBeLessThanOrEqual(Math.floor(0.5 / 0.035));
      expect(doGenerate).toHaveBeenCalledTimes(succeeded);
      expect(refused).toHaveLength(40 - succeeded);
      expect(refused.length).toBeGreaterThan(20);
      expect(refused.every((result) => result.reason instanceof AiBudgetExceededError)).toBe(true);

      // Held (reserved + settled) spend never exceeded the ceiling, and what remains is the real cost.
      expect(peakHeld).toBeGreaterThan(0);
      expect(peakHeld).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(await getAiSpendUsd(startOfUtcDay(new Date()), PAID)).toBeCloseTo(succeeded * 0.035, 6);
      const rows = await rowsOf(PAID);
      expect(rows).toHaveLength(succeeded);
      expect(rows.every((row) => row.status === "ok" && row.planKey === "pro" && row.reservedUsd === perCallWorstCase)).toBe(true);
    });

    it("parallel reservations across workspaces respect the global daily budget", async () => {
      for (let index = 0; index < 6; index += 1) await createOrg(`org_budget_many_${index}`, "business");
      const results = await Promise.allSettled(
        Array.from({ length: 30 }, (_, index) => reserve(`org_budget_many_${index % 6}`, 0.1)),
      );
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(10); // 10 × 0.10 = the 1 USD global day
      const refused = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      expect(refused.every((result) => (result.reason as AiBudgetExceededError).code === "AI_GLOBAL_BUDGET_EXCEEDED")).toBe(true);
      expect(await getAiSpendUsd(startOfUtcDay(NOW))).toBeCloseTo(1, 6);
    });
  });

  describe("failed calls", () => {
    it("a call that fails after the provider may have worked keeps its worst-case charge", async () => {
      const { instance, doGenerate } = model({ fail: () => Object.assign(new Error("This operation was aborted"), { name: "AbortError" }) });
      for (let attempt = 0; attempt < 25; attempt += 1) {
        await generateAiText({ organizationId: PAID, feature: "abort", model: instance, prompt: "hi" }).catch(() => undefined);
      }
      const rows = await rowsOf(PAID);
      const charged = rows.reduce((sum, row) => sum + row.costUsd, 0);
      expect(rows.every((row) => row.status === "error")).toBe(true);
      expect(charged).toBeGreaterThan(0.4);
      expect(charged).toBeLessThanOrEqual(0.5);
      // Aborting just before completion no longer buys unlimited attempts.
      expect(doGenerate.mock.calls.length).toBeLessThan(25);
      expect(doGenerate.mock.calls.length).toBe(rows.length);
    });

    it("a request the provider rejected outright is released (an outage does not eat the budget)", async () => {
      const rejected = () => new APICallError({ message: "rate limited", url: "https://gateway.example", requestBodyValues: {}, statusCode: 429, isRetryable: false });
      const { instance } = model({ fail: rejected });
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(generateAiText({ organizationId: PAID, feature: "outage", model: instance, prompt: "hi" })).rejects.toBeTruthy();
      }
      const rows = await rowsOf(PAID);
      expect(rows).toHaveLength(5);
      expect(rows.every((row) => row.status === "error" && row.costUsd === 0 && (row.reservedUsd ?? 0) > 0)).toBe(true);
    });

    it("classifies provider errors", () => {
      const api = (statusCode?: number) => new APICallError({ message: "x", url: "https://gateway.example", requestBodyValues: {}, statusCode });
      expect(providerRejectedRequest(api(401))).toBe(true);
      expect(providerRejectedRequest(api(500))).toBe(true);
      expect(providerRejectedRequest(api())).toBe(true); // could not connect
      expect(providerRejectedRequest(api(504))).toBe(false);
      expect(providerRejectedRequest(Object.assign(new Error("gateway"), { [Symbol.for("vercel.ai.gateway.error")]: true, statusCode: 402 }))).toBe(true);
      expect(providerRejectedRequest(Object.assign(new Error("slow"), { [Symbol.for("vercel.ai.gateway.error")]: true, name: "GatewayTimeoutError", statusCode: 408 }))).toBe(false);
      expect(providerRejectedRequest(new Error("anything else"))).toBe(false);
      expect(providerRejectedRequest(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(false);
    });

    it("a reservation whose call never settled is finalised at its worst-case cost", async () => {
      const stale = new Date(Date.now() - 16 * 60_000);
      const { id } = await reserve(PAID, 0.2, stale);
      await reserve(PAID, 0.1, new Date());
      expect(await settleStaleAiReservations()).toBe(1);
      const [row] = await db.select().from(aiUsage).where(eq(aiUsage.id, id));
      expect(row).toMatchObject({ status: "error", costUsd: 0.2 });
      expect((await rowsOf(PAID)).filter((entry) => entry.status === "reserved")).toHaveLength(1);
    });
  });

  describe("ceilings", () => {
    it("workspace monthly budget: refuses a call that would cross it, even though today is quiet", async () => {
      await spend(FREE, 0.46, new Date(Date.UTC(2026, 10, 3)));
      const error = await reserve(FREE, 0.05).catch((caught: unknown) => caught);
      expect(error).toMatchObject({ code: "AI_ORG_BUDGET_EXCEEDED", status: 402, details: { period: "month", limitUsd: 0.5, spentUsd: 0.46 } });
      await expect(reserve(FREE, 0.04)).resolves.toMatchObject({ reservedUsd: 0.04, planKey: "free" });
    });

    it("workspace daily ceiling, derived from the plan", async () => {
      await reserve(FREE, 0.06);
      const error = await reserve(FREE, 0.05).catch((caught: unknown) => caught);
      expect(error).toMatchObject({ code: "AI_ORG_BUDGET_EXCEEDED", details: { period: "day", limitUsd: 0.1 } });
      // The next UTC day starts fresh (still inside the monthly budget).
      await expect(reserve(FREE, 0.05, new Date(NOW.getTime() + 24 * 60 * 60 * 1000))).resolves.toBeTruthy();
    });

    it("free workspaces share one pool and cannot exhaust the global budget for paying customers", async () => {
      // An abuser creates many free workspaces and maxes each one out.
      let admitted = 0;
      for (let index = 0; index < 20; index += 1) {
        await createOrg(`org_budget_farm_${index}`);
        for (const amount of [0.05, 0.05]) {
          if (await reserve(`org_budget_farm_${index}`, amount).then(() => true, () => false)) admitted += 1;
        }
      }
      expect(admitted).toBe(5); // 5 × 0.05 = the 0.25 USD free pool, however many workspaces exist
      const blocked = await reserve(FREE, 0.01).catch((caught: unknown) => caught);
      expect(blocked).toMatchObject({ code: "AI_GLOBAL_BUDGET_EXCEEDED", status: 503 });
      expect((blocked as AiBudgetExceededError).details).not.toHaveProperty("spentUsd");

      // Paying customers still have the rest of the day's budget.
      await expect(reserve(PAID, 0.5)).resolves.toBeTruthy();
      expect(await getAiSpendUsd(startOfUtcDay(NOW))).toBeCloseTo(0.75, 6);
    });

    it("a workspace that upgrades stops drawing from the free pool", async () => {
      await spend(PAID, 0.25, NOW, "free"); // earlier today, on the free plan: the free pool is now full
      await expect(reserve(FREE, 0.01)).rejects.toMatchObject({ code: "AI_GLOBAL_BUDGET_EXCEEDED" });
      await expect(reserve(PAID, 0.2)).resolves.toMatchObject({ planKey: "pro" });
    });
  });

  describe("per call", () => {
    it("refuses an oversized prompt before reserving or calling anything", async () => {
      const { instance, doGenerate } = model();
      const prompt = "x".repeat(AI_MAX_INPUT_TOKENS * 2 + 100);
      const error = await generateAiText({ organizationId: PAID, feature: "big", model: instance, prompt }).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(AiInputTooLargeError);
      expect(error).toMatchObject({ code: "AI_INPUT_TOO_LARGE", status: 413 });
      expect(doGenerate).not.toHaveBeenCalled();
      expect(await rowsOf(PAID)).toHaveLength(0);
    });

    it("reserves for the output the caller allows: a large maxOutputTokens needs room in the budget", async () => {
      const { instance, doGenerate } = model();
      // 16,000 output tokens at the fallback price = 0.80 USD worst case > the 0.50 daily ceiling.
      await expect(generateAiText({ organizationId: PAID, feature: "long", model: instance, prompt: "hi", maxOutputTokens: 1_000_000 })).rejects.toBeInstanceOf(AiBudgetExceededError);
      expect(doGenerate).not.toHaveBeenCalled();
    });

    it("rate limits calls per workspace", async () => {
      // The limiter's windows are aligned to the minute: do not straddle a boundary.
      const intoMinute = (Date.now() / 1000) % 60;
      if (intoMinute > 52) await new Promise((resolve) => setTimeout(resolve, (60 - intoMinute) * 1000 + 50));
      const { instance } = model({ fail: () => new APICallError({ message: "no", url: "https://gateway.example", requestBodyValues: {}, statusCode: 400 }) });
      const outcomes = await Promise.allSettled(
        Array.from({ length: AI_RATE_LIMIT.limit + 5 }, () => generateAiText({ organizationId: PAID, feature: "loop", model: instance, prompt: "hi" })),
      );
      const limited = outcomes.filter((outcome) => outcome.status === "rejected" && outcome.reason instanceof RateLimitError);
      expect(limited.length).toBeGreaterThanOrEqual(5);
    });
  });
});
