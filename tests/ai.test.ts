import { eq } from "drizzle-orm";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { estimateCostUsd, FALLBACK_PRICE, MODEL_PRICES } from "@/config/ai";
import { PLANS } from "@/config/plans";
import { db } from "@/db";
import { aiUsage, events, organizations, subscriptions } from "@/db/schema";
import { AiBudgetExceededError, assertAiBudget, generateAiText, getAiSpendUsd, startOfUtcDay, startOfUtcMonth } from "@/lib/ai";
import { AppError } from "@/lib/errors";
import { resetDatabase } from "./helpers/db";

const ORG = "org_ai";
const OTHER = "org_ai_other";

function mockModel(usage = { input: 1000, output: 500 }, text = "Hello from the mock") {
  const doGenerate = vi.fn(async () => ({
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: {
      inputTokens: { total: usage.input, noCache: usage.input, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: usage.output, text: usage.output, reasoning: undefined },
    },
    warnings: [],
  }));
  return { model: new MockLanguageModelV4({ provider: "mock", modelId: "test-model", doGenerate }), doGenerate };
}

async function createOrg(id: string, planKey?: string) {
  await db.insert(organizations).values({ id, name: id, slug: id, createdAt: new Date() });
  if (planKey) await db.insert(subscriptions).values({ organizationId: id, status: "active", planKey, paddleSubscriptionId: `sub_${id}` });
}

async function recordSpend(organizationId: string, costUsd: number, createdAt = new Date()) {
  await db.insert(aiUsage).values({ organizationId, feature: "seed", model: "mock/test-model", costUsd, createdAt });
}

describe("AI wrapper", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createOrg(ORG);
    await createOrg(OTHER);
  });

  it("estimates cost from the price table and is pessimistic for unknown models", () => {
    expect(MODEL_PRICES["anthropic/claude-haiku-5.5"]).toEqual({ inputPerMTok: 0.1, outputPerMTok: 0.5 });
    expect(estimateCostUsd("anthropic/claude-haiku-5.5", 1_000_000, 1_000_000)).toBeCloseTo(0.6, 6);
    expect(estimateCostUsd("anthropic/claude-sonnet-5.5", 2000, 1000)).toBeCloseTo(0.014, 6);
    expect(estimateCostUsd("vendor/unknown", 1_000_000, 0)).toBe(FALLBACK_PRICE.inputPerMTok);
    expect(estimateCostUsd("anthropic/claude-haiku-5.5", 0, 0)).toBe(0);
  });

  it("calls the model and records usage, cost and latency", async () => {
    const { model, doGenerate } = mockModel({ input: 1000, output: 500 });
    const result = await generateAiText({ organizationId: ORG, feature: "summary", model, prompt: "Say hello" });
    expect(result.text).toBe("Hello from the mock");
    expect(result.model).toBe("mock/test-model");
    expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 500, costUsd: estimateCostUsd("mock/test-model", 1000, 500) });
    expect(doGenerate).toHaveBeenCalledTimes(1);

    const rows = await db.select().from(aiUsage);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      organizationId: ORG,
      feature: "summary",
      model: "mock/test-model",
      inputTokens: 1000,
      outputTokens: 500,
      status: "ok",
    });
    expect(rows[0]!.costUsd).toBeCloseTo(0.035, 6); // fallback price: (1000*10 + 500*50) / 1e6
    expect(rows[0]!.latencyMs).toBeGreaterThanOrEqual(0);
    expect((await db.select().from(events)).map((row) => row.name)).toContain("ai.request_completed");
  });

  it("fails closed when the workspace's monthly budget is used up, without calling the model", async () => {
    const limit = PLANS.free.limits.aiMonthlyBudgetUsd;
    await recordSpend(ORG, limit);
    const { model, doGenerate } = mockModel();
    const error = await generateAiText({ organizationId: ORG, feature: "summary", model, prompt: "hi" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiBudgetExceededError);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: "AI_ORG_BUDGET_EXCEEDED", scope: "organization", status: 402 });
    expect((error as AiBudgetExceededError).details).toMatchObject({ scope: "organization", limitUsd: limit });
    expect(doGenerate).not.toHaveBeenCalled();
    expect(await db.select().from(aiUsage)).toHaveLength(1); // only the seeded spend
    expect((await db.select().from(events)).map((row) => row.name)).toContain("ai.budget_exceeded");
  });

  it("budgets each workspace separately", async () => {
    await recordSpend(ORG, PLANS.free.limits.aiMonthlyBudgetUsd);
    const { model } = mockModel();
    await expect(generateAiText({ organizationId: OTHER, feature: "summary", model, prompt: "hi" })).resolves.toMatchObject({ text: "Hello from the mock" });
  });

  it("derives the workspace budget from its plan", async () => {
    await createOrg("org_ai_pro", "pro");
    await recordSpend("org_ai_pro", PLANS.free.limits.aiMonthlyBudgetUsd + 0.2);
    await expect(assertAiBudget("org_ai_pro")).resolves.toBeUndefined();
    // Stay under the global daily budget (1 USD in tests) by dating the big spend earlier this month.
    const earlierThisMonth = new Date(Math.max(startOfUtcMonth(new Date()).getTime(), startOfUtcDay(new Date()).getTime() - 1));
    if (earlierThisMonth.getTime() < startOfUtcDay(new Date()).getTime()) {
      await recordSpend("org_ai_pro", PLANS.pro.limits.aiMonthlyBudgetUsd, earlierThisMonth);
      await expect(assertAiBudget("org_ai_pro")).rejects.toMatchObject({ code: "AI_ORG_BUDGET_EXCEEDED" });
    }
  });

  it("resets the workspace budget each UTC month", async () => {
    const lastMonth = new Date(startOfUtcMonth(new Date()).getTime() - 1000);
    await recordSpend(ORG, 999, lastMonth);
    await expect(assertAiBudget(ORG)).resolves.toBeUndefined();
    expect(await getAiSpendUsd(startOfUtcMonth(new Date()), ORG)).toBe(0);
  });

  it("fails closed when the global daily budget (AI_DAILY_BUDGET_USD) is used up", async () => {
    // 1 USD global budget in tests; spend it through ANOTHER workspace.
    await createOrg("org_ai_biz", "business");
    await recordSpend("org_ai_biz", 1);
    const { model, doGenerate } = mockModel();
    const error = await generateAiText({ organizationId: ORG, feature: "summary", model, prompt: "hi" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiBudgetExceededError);
    expect(error).toMatchObject({ code: "AI_GLOBAL_BUDGET_EXCEEDED", scope: "global", status: 503 });
    // Global spend figures are not leaked to customers.
    expect((error as AiBudgetExceededError).details).not.toHaveProperty("spentUsd");
    expect(doGenerate).not.toHaveBeenCalled();
  });

  it("the global budget resets each UTC day", async () => {
    const yesterday = new Date(startOfUtcDay(new Date()).getTime() - 1000);
    await createOrg("org_ai_biz", "business");
    await recordSpend("org_ai_biz", 50, yesterday);
    expect(await getAiSpendUsd(startOfUtcDay(new Date()))).toBe(0);
  });

  it("stops once accumulated calls reach the budget", async () => {
    // Each call costs 0.035 USD at the fallback price; the free budget is 0.5 USD.
    const { model, doGenerate } = mockModel({ input: 1000, output: 500 });
    let completed = 0;
    let blocked: unknown = null;
    for (let i = 0; i < 40 && !blocked; i += 1) {
      try {
        await generateAiText({ organizationId: ORG, feature: "loop", model, prompt: "hi" });
        completed += 1;
      } catch (error) {
        blocked = error;
      }
    }
    expect(blocked).toBeInstanceOf(AiBudgetExceededError);
    expect(completed).toBe(Math.ceil(PLANS.free.limits.aiMonthlyBudgetUsd / 0.035)); // 15 calls: 14 × 0.035 < 0.5 ≤ 15 × 0.035
    expect(doGenerate).toHaveBeenCalledTimes(completed);
  });

  it("records a failed model call and rethrows", async () => {
    const model = new MockLanguageModelV4({
      provider: "mock",
      modelId: "broken",
      doGenerate: async () => {
        throw new Error("upstream 500");
      },
    });
    await expect(generateAiText({ organizationId: ORG, feature: "summary", model, prompt: "hi" })).rejects.toThrow();
    const rows = await db.select().from(aiUsage).where(eq(aiUsage.organizationId, ORG));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "error", costUsd: 0, inputTokens: 0, outputTokens: 0, model: "mock/broken" });
  });
});
