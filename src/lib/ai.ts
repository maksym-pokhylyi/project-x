import "server-only";
import { APICallError, gateway, generateText, type LanguageModel, type ModelMessage } from "ai";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  AI_BUDGET_POLICY,
  AI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_MAX_INPUT_TOKENS,
  AI_MAX_OUTPUT_TOKENS,
  AI_MODELS,
  AI_RATE_LIMIT,
  estimateCostUsd,
  estimateInputTokens,
  worstCaseCostUsd,
  type AiModelAlias,
} from "@/config/ai";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { env } from "@/env";
import { track } from "@/lib/analytics";
import type { Entitlements } from "@/lib/billing/entitlements";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { AppError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";

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
 * Budgets are HARD limits, enforced by reserving before spending:
 *
 *  1. The worst-case cost of the call (pessimistic input estimate + every allowed output
 *     token) is RESERVED in `ai_usage` inside one short transaction that holds an advisory
 *     lock, so concurrent calls see each other's reservations. The reservation is refused
 *     unless `spent + reserved + this call` fits ALL of:
 *       - the workspace's monthly budget from its plan (limits.aiMonthlyBudgetUsd)
 *       - the workspace's daily ceiling, derived from that plan (AI_BUDGET_POLICY)
 *       - the global daily budget AI_DAILY_BUDGET_USD (protects the founder's card)
 *       - for free-plan workspaces: the shared free pool (AI_FREE_DAILY_BUDGET_USD)
 *  2. The model is called.
 *  3. The reservation is settled to the real cost. A call that fails AFTER the provider
 *     may have generated tokens (abort, timeout, unreadable response, unknown error) keeps
 *     its worst-case cost; only a request the provider rejected outright is released.
 *
 * So N parallel calls can never spend more than the limits, failures are not free, and
 * free workspaces cannot drain the pool paying customers use.
 */

export type AiBudgetScope = "organization" | "global";

/** Thrown when a budget is exhausted. `code` and `details` are safe to show in the UI. */
export class AiBudgetExceededError extends AppError {
  readonly scope: AiBudgetScope;

  constructor(scope: AiBudgetScope, limitUsd: number, spentUsd: number, resetsAt: Date, period: "month" | "day" = scope === "organization" ? "month" : "day") {
    super(
      scope === "organization" ? "AI_ORG_BUDGET_EXCEEDED" : "AI_GLOBAL_BUDGET_EXCEEDED",
      scope === "organization"
        ? period === "day"
          ? "This workspace has used its AI allowance for today. It resets at midnight UTC."
          : "This workspace has used its AI allowance for the month. Upgrade your plan or wait until it resets."
        : "AI features are temporarily unavailable. Please try again later.",
      scope === "organization" ? 402 : 503,
      // Global spend figures are internal; only expose numbers for the workspace's own budget.
      scope === "organization"
        ? { scope, period, limitUsd, spentUsd, resetsAt: resetsAt.toISOString() }
        : { scope, resetsAt: resetsAt.toISOString() },
    );
    this.scope = scope;
  }
}

/** Thrown before anything is sent when a prompt exceeds AI_MAX_INPUT_TOKENS (estimated). */
export class AiInputTooLargeError extends AppError {
  constructor(estimatedTokens: number, limit: number) {
    super("AI_INPUT_TOO_LARGE", "This request is too large to process in one step. Split it into smaller parts.", 413, { estimatedTokens, limit });
  }
}

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

const roundUsd = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

/** Estimated AI spend in USD since `since` (including open reservations), for one workspace or everyone. */
export async function getAiSpendUsd(since: Date, organizationId?: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${aiUsage.costUsd}), 0)` })
    .from(aiUsage)
    .where(organizationId ? and(eq(aiUsage.organizationId, organizationId), gte(aiUsage.createdAt, since)) : gte(aiUsage.createdAt, since));
  return Number(row?.total ?? 0);
}

export type AiBudgetLimits = {
  organizationMonthlyUsd: number;
  organizationDailyUsd: number;
  globalDailyUsd: number;
  /** Shared daily pool of all free-plan workspaces; null for paying workspaces. */
  freePoolDailyUsd: number | null;
};

/** The four ceilings that apply to a workspace, derived from its plan and the environment. */
export function aiBudgetLimits(entitlements: Pick<Entitlements, "isPaid" | "limits">): AiBudgetLimits {
  const globalDailyUsd = env.AI_DAILY_BUDGET_USD;
  const organizationMonthlyUsd = entitlements.limits.aiMonthlyBudgetUsd;
  const share = entitlements.isPaid ? AI_BUDGET_POLICY.dailyShareOfMonthly.paid : AI_BUDGET_POLICY.dailyShareOfMonthly.free;
  return {
    organizationMonthlyUsd,
    organizationDailyUsd: roundUsd(Math.min(organizationMonthlyUsd * share, globalDailyUsd * AI_BUDGET_POLICY.maxShareOfGlobalDaily)),
    globalDailyUsd,
    freePoolDailyUsd: entitlements.isPaid
      ? null
      : roundUsd(Math.min(env.AI_FREE_DAILY_BUDGET_USD ?? globalDailyUsd * AI_BUDGET_POLICY.freePoolShareOfGlobalDaily, globalDailyUsd)),
  };
}

type Executor = Pick<typeof db, "execute">;

async function loadSpend(executor: Executor, organizationId: string, now: Date) {
  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);
  const [globalRows, organizationRows] = [
    await executor.execute<{ global_day: string; free_day: string }>(sql`
      select coalesce(sum(cost_usd), 0) as global_day,
             coalesce(sum(cost_usd) filter (where plan_key = 'free'), 0) as free_day
      from ai_usage where created_at >= ${dayStart.toISOString()}::timestamptz
    `),
    await executor.execute<{ org_month: string; org_day: string }>(sql`
      select coalesce(sum(cost_usd), 0) as org_month,
             coalesce(sum(cost_usd) filter (where created_at >= ${dayStart.toISOString()}::timestamptz), 0) as org_day
      from ai_usage where organization_id = ${organizationId} and created_at >= ${monthStart.toISOString()}::timestamptz
    `),
  ];
  return {
    dayStart,
    monthStart,
    globalDay: Number(globalRows[0]?.global_day ?? 0),
    freeDay: Number(globalRows[0]?.free_day ?? 0),
    organizationMonth: Number(organizationRows[0]?.org_month ?? 0),
    organizationDay: Number(organizationRows[0]?.org_day ?? 0),
  };
}

/** Throws when adding `amountUsd` would cross a ceiling. With 0 it reports ceilings already reached. */
function assertFits(limits: AiBudgetLimits, spend: Awaited<ReturnType<typeof loadSpend>>, amountUsd: number): void {
  const exceeds = (spent: number, limit: number) => (amountUsd > 0 ? spent + amountUsd > limit + 1e-9 : spent >= limit);
  const tomorrow = new Date(spend.dayStart.getTime() + 24 * 60 * 60 * 1000);
  const nextMonth = new Date(Date.UTC(spend.monthStart.getUTCFullYear(), spend.monthStart.getUTCMonth() + 1, 1));
  // The workspace's own limits first: they produce the message the customer can act on.
  if (exceeds(spend.organizationMonth, limits.organizationMonthlyUsd)) {
    throw new AiBudgetExceededError("organization", limits.organizationMonthlyUsd, spend.organizationMonth, nextMonth, "month");
  }
  if (exceeds(spend.organizationDay, limits.organizationDailyUsd)) {
    throw new AiBudgetExceededError("organization", limits.organizationDailyUsd, spend.organizationDay, tomorrow, "day");
  }
  if (exceeds(spend.globalDay, limits.globalDailyUsd)) {
    throw new AiBudgetExceededError("global", limits.globalDailyUsd, spend.globalDay, tomorrow);
  }
  if (limits.freePoolDailyUsd !== null && exceeds(spend.freeDay, limits.freePoolDailyUsd)) {
    throw new AiBudgetExceededError("global", limits.freePoolDailyUsd, spend.freeDay, tomorrow);
  }
}

/**
 * Read-only check: throws AiBudgetExceededError when a ceiling is ALREADY reached. Useful to
 * disable a button or fail early; it reserves nothing, so it is advisory — the guarantee
 * comes from the reservation inside generateAiText().
 */
export async function assertAiBudget(organizationId: string, now: Date = new Date()): Promise<void> {
  const entitlements = await getOrgEntitlements(organizationId);
  assertFits(aiBudgetLimits(entitlements), await loadSpend(db, organizationId, now), 0);
}

export type AiReservation = { id: string; reservedUsd: number; planKey: string };

/**
 * Atomically reserves `reserveUsd` against every ceiling, or throws AiBudgetExceededError
 * without reserving anything.
 *
 * One transaction: a transaction-scoped advisory lock (works through PgBouncer) serialises
 * all reservations, the sums include other calls' open reservations, and the reservation
 * row is inserted before the lock is released. The lock is held for a few milliseconds —
 * never across the model call.
 */
export async function reserveAiBudget(input: {
  organizationId: string;
  userId?: string | null;
  feature: string;
  model: string;
  reserveUsd: number;
  now?: Date;
}): Promise<AiReservation> {
  const now = input.now ?? new Date();
  const reserveUsd = roundUsd(Math.max(input.reserveUsd, 0.000001));
  return db.transaction(async (tx) => {
    const entitlements = await getOrgEntitlements(input.organizationId, tx);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('ai-budget'))`);
    assertFits(aiBudgetLimits(entitlements), await loadSpend(tx, input.organizationId, now), reserveUsd);
    const [row] = await tx
      .insert(aiUsage)
      .values({
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        feature: input.feature,
        model: input.model,
        costUsd: reserveUsd,
        reservedUsd: reserveUsd,
        planKey: entitlements.planKey,
        status: "reserved",
        createdAt: now,
      })
      .returning({ id: aiUsage.id });
    return { id: row!.id, reservedUsd: reserveUsd, planKey: entitlements.planKey };
  });
}

/** Replaces a reservation with what the call really cost (or with its failure charge). */
export async function settleAiReservation(
  reservationId: string,
  outcome: { status: "ok" | "error"; inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number },
): Promise<void> {
  await db
    .update(aiUsage)
    .set({ status: outcome.status, inputTokens: outcome.inputTokens, outputTokens: outcome.outputTokens, costUsd: roundUsd(outcome.costUsd), latencyMs: outcome.latencyMs })
    .where(and(eq(aiUsage.id, reservationId), eq(aiUsage.status, "reserved")));
}

/**
 * Finalises reservations whose call never settled (the instance died or timed out): they
 * keep their worst-case cost and become `error` rows. Called by the maintenance job.
 */
export async function settleStaleAiReservations(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - AI_BUDGET_POLICY.staleReservationMinutes * 60_000);
  const rows = await db.execute(sql`
    update ai_usage set status = 'error'
    where status = 'reserved' and created_at < ${cutoff.toISOString()}::timestamptz
    returning 1
  `);
  return rows.length;
}

/**
 * Did the provider reject the request before doing any work? Only then is a failed call
 * free. Everything else — abort, timeout, an unreadable or invalid response, an unknown
 * error — may have consumed tokens, so the reservation is kept as the charge.
 */
export function providerRejectedRequest(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const loose = error as Record<string | symbol, unknown>;
  const isApiCall = APICallError.isInstance(error);
  const isGateway = loose[Symbol.for("vercel.ai.gateway.error")] === true;
  if (!isApiCall && !isGateway) return false;
  const status = typeof loose.statusCode === "number" ? loose.statusCode : null;
  if (status === 408 || status === 504 || status === 524) return false; // timed out: work may have been done
  if (typeof loose.name === "string" && /timeout/i.test(loose.name)) return false;
  return true;
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
  /** Default 1,024; clamped to AI_MAX_OUTPUT_TOKENS. Part of the reserved worst-case cost. */
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

/** Pessimistic size of everything sent to the model, in tokens. */
export function estimatePromptTokens(options: Pick<GenerateAiTextOptions, "instructions" | "prompt">): number {
  const prompt = typeof options.prompt === "string" ? options.prompt : JSON.stringify(options.prompt);
  return estimateInputTokens(Buffer.byteLength(prompt, "utf8") + Buffer.byteLength(options.instructions ?? "", "utf8"));
}

export async function generateAiText(options: GenerateAiTextOptions): Promise<GenerateAiTextResult> {
  const { organizationId, feature } = options;
  const userId = options.userId ?? null;
  const { instance, id: modelId } = resolveModel(options.model);

  const estimatedInputTokens = estimatePromptTokens(options);
  if (estimatedInputTokens > AI_MAX_INPUT_TOKENS) throw new AiInputTooLargeError(estimatedInputTokens, AI_MAX_INPUT_TOKENS);
  const maxOutputTokens = Math.min(Math.max(1, Math.floor(options.maxOutputTokens ?? AI_DEFAULT_MAX_OUTPUT_TOKENS)), AI_MAX_OUTPUT_TOKENS);

  await enforceRateLimit(`ai:${organizationId}`, AI_RATE_LIMIT);

  let reservation: AiReservation;
  try {
    reservation = await reserveAiBudget({
      organizationId,
      userId,
      feature,
      model: modelId,
      reserveUsd: worstCaseCostUsd(modelId, estimatedInputTokens, maxOutputTokens),
    });
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
      maxOutputTokens,
      abortSignal: options.abortSignal,
    });
    const latencyMs = Date.now() - started;
    const inputTokens = result.usage.inputTokens ?? 0;
    const outputTokens = result.usage.outputTokens ?? 0;
    const costUsd = estimateCostUsd(modelId, inputTokens, outputTokens);
    await settleAiReservation(reservation.id, { status: "ok", inputTokens, outputTokens, costUsd, latencyMs });
    await track("ai.request_completed", { organizationId, userId }, { feature, model: modelId });
    return { text: result.text, model: modelId, usage: { inputTokens, outputTokens, costUsd }, latencyMs };
  } catch (error) {
    // Failures are recorded too, and they are only free when the provider did no work.
    const costUsd = providerRejectedRequest(error) ? 0 : reservation.reservedUsd;
    await settleAiReservation(reservation.id, { status: "error", inputTokens: 0, outputTokens: 0, costUsd, latencyMs: Date.now() - started }).catch(() => undefined);
    throw error;
  }
}
