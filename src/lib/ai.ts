import "server-only";
import { gateway, generateText, type LanguageModel, type ModelMessage } from "ai";
import { and, eq, gte, sql } from "drizzle-orm";
import { AI_MODELS, estimateCostUsd, type AiModelAlias } from "@/config/ai";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { env } from "@/env";
import { track } from "@/lib/analytics";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { AppError } from "@/lib/errors";

/**
 * The ONLY way the app talks to language models.
 *
 *   const { text } = await generateAiText({
 *     organizationId: ctx.organization.id,   // from requireOrg(), never from input
 *     userId: ctx.user.id,
 *     feature: "summarise-document",
 *     model: "fast",
 *     prompt: "…",
 *   });
 *
 * Wraps the Vercel AI SDK with the AI Gateway provider (model ids like
 * "anthropic/claude-haiku-5.5"). On Vercel the gateway authenticates with the deployment's
 * OIDC token automatically; locally set AI_GATEWAY_API_KEY (or VERCEL_OIDC_TOKEN via
 * `vercel env pull`).
 *
 * Every call:
 *  1. is checked against two budgets BEFORE spending money, and fails closed:
 *       - the workspace's monthly budget from its plan (limits.aiMonthlyBudgetUsd)
 *       - the global daily budget AI_DAILY_BUDGET_USD (protects the founder's card)
 *  2. is recorded in `ai_usage` (tokens, estimated cost, latency) — failures too.
 *
 * The budget check is check-then-act: concurrent calls can overshoot by at most the cost
 * of the calls in flight. Keep `maxOutputTokens` bounded for anything user-triggered.
 */

export type AiBudgetScope = "organization" | "global";

/** Thrown when a budget is exhausted. `code` and `details` are safe to show in the UI. */
export class AiBudgetExceededError extends AppError {
  readonly scope: AiBudgetScope;

  constructor(scope: AiBudgetScope, limitUsd: number, spentUsd: number, resetsAt: Date) {
    super(
      scope === "organization" ? "AI_ORG_BUDGET_EXCEEDED" : "AI_GLOBAL_BUDGET_EXCEEDED",
      scope === "organization"
        ? "This workspace has used its AI allowance for the month. Upgrade your plan or wait until it resets."
        : "AI features are temporarily unavailable. Please try again later.",
      scope === "organization" ? 402 : 503,
      // Global spend figures are internal; only expose numbers for the workspace's own budget.
      scope === "organization" ? { scope, limitUsd, spentUsd, resetsAt: resetsAt.toISOString() } : { scope, resetsAt: resetsAt.toISOString() },
    );
    this.scope = scope;
  }
}

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Estimated AI spend in USD since `since`, for one workspace or (without it) everyone. */
export async function getAiSpendUsd(since: Date, organizationId?: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${aiUsage.costUsd}), 0)` })
    .from(aiUsage)
    .where(organizationId ? and(eq(aiUsage.organizationId, organizationId), gte(aiUsage.createdAt, since)) : gte(aiUsage.createdAt, since));
  return Number(row?.total ?? 0);
}

/** Throws AiBudgetExceededError when either guard is exhausted. */
export async function assertAiBudget(organizationId: string, now: Date = new Date()): Promise<void> {
  const dayStart = startOfUtcDay(now);
  const globalSpent = await getAiSpendUsd(dayStart);
  if (globalSpent >= env.AI_DAILY_BUDGET_USD) {
    throw new AiBudgetExceededError("global", env.AI_DAILY_BUDGET_USD, globalSpent, new Date(dayStart.getTime() + 24 * 60 * 60 * 1000));
  }

  const monthStart = startOfUtcMonth(now);
  const [entitlements, organizationSpent] = await Promise.all([
    getOrgEntitlements(organizationId),
    getAiSpendUsd(monthStart, organizationId),
  ]);
  const limit = entitlements.limits.aiMonthlyBudgetUsd;
  if (organizationSpent >= limit) {
    const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
    throw new AiBudgetExceededError("organization", limit, organizationSpent, nextMonth);
  }
}

export type GenerateAiTextOptions = {
  /** Workspace that pays for the call. Take it from requireOrg(). */
  organizationId: string;
  userId?: string | null;
  /** Stable name of the product feature making the call (for cost attribution). */
  feature: string;
  /** Alias from src/config/ai.ts, a gateway model id, or a model instance (tests). */
  model?: AiModelAlias | (string & {}) | Exclude<LanguageModel, string>;
  instructions?: string;
  prompt: string | ModelMessage[];
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
};

export type GenerateAiTextResult = {
  text: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  latencyMs: number;
};

function resolveModel(model: GenerateAiTextOptions["model"]): { instance: LanguageModel; id: string } {
  if (model === undefined) return { instance: gateway(AI_MODELS.fast), id: AI_MODELS.fast };
  if (typeof model === "string") {
    const id = model in AI_MODELS ? AI_MODELS[model as AiModelAlias] : model;
    return { instance: gateway(id), id };
  }
  return { instance: model, id: `${model.provider}/${model.modelId}` };
}

/**
 * Confidentiality is a product promise: EVERY call asks the AI Gateway for zero data
 * retention and forbids training on the prompt. Set here, in the one wrapper all model
 * calls go through, so no call site can forget it. A provider that cannot honour it makes
 * the gateway refuse the request (403) instead of sending the data.
 */
export const AI_PRIVACY_OPTIONS = { gateway: { zeroDataRetention: true, disallowPromptTraining: true } } as const;

/** Cost in USD as reported by the gateway for this response, when it reports one. */
export function gatewayReportedCostUsd(providerMetadata: unknown): number | null {
  const raw = (providerMetadata as { gateway?: { cost?: unknown } } | undefined)?.gateway?.cost;
  const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 1_000_000) / 1_000_000 : null;
}

export async function generateAiText(options: GenerateAiTextOptions): Promise<GenerateAiTextResult> {
  const { organizationId, feature } = options;
  const userId = options.userId ?? null;
  const { instance, id: modelId } = resolveModel(options.model);

  try {
    await assertAiBudget(organizationId);
  } catch (error) {
    if (error instanceof AiBudgetExceededError) {
      await track("ai.budget_exceeded", { organizationId, userId }, { scope: error.scope, feature });
    }
    throw error;
  }

  const started = Date.now();
  try {
    const result = await generateText({
      model: instance,
      instructions: options.instructions,
      prompt: options.prompt,
      maxOutputTokens: options.maxOutputTokens ?? 1024,
      abortSignal: options.abortSignal,
      providerOptions: AI_PRIVACY_OPTIONS,
    });
    const latencyMs = Date.now() - started;
    const inputTokens = result.usage.inputTokens ?? 0;
    const outputTokens = result.usage.outputTokens ?? 0;
    // The gateway's own figure when it reports one; the static price table is only an estimate.
    const costUsd = gatewayReportedCostUsd(result.providerMetadata) ?? estimateCostUsd(modelId, inputTokens, outputTokens);
    await db.insert(aiUsage).values({ organizationId, userId, feature, model: modelId, inputTokens, outputTokens, costUsd, latencyMs, status: "ok" });
    await track("ai.request_completed", { organizationId, userId }, { feature, model: modelId });
    return { text: result.text, model: modelId, usage: { inputTokens, outputTokens, costUsd }, latencyMs };
  } catch (error) {
    // Record the failed attempt (no tokens billed that we know of) so outages are visible.
    await db
      .insert(aiUsage)
      .values({ organizationId, userId, feature, model: modelId, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: Date.now() - started, status: "error" })
      .catch(() => undefined);
    throw error;
  }
}
