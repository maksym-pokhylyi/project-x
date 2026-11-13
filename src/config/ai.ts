/**
 * AI model catalogue for src/lib/ai.ts.
 *
 * Model ids are Vercel AI Gateway ids ("provider/model"). Prices are list prices in
 * USD per 1M tokens and are used ONLY to estimate spend for the budget guards and the
 * admin dashboard — reconcile against the AI Gateway invoice, and update this table
 * when you add a model or prices change. Unknown models are costed at `FALLBACK_PRICE`
 * (deliberately expensive) so a forgotten entry can never make spend look free.
 */
export const AI_MODELS = {
  /** Fast and cheap: classification, extraction, short generation. */
  fast: "anthropic/claude-haiku-5.5",
  /** Balanced default for anything users will read. */
  smart: "anthropic/claude-sonnet-5.5",
} as const;

export type AiModelAlias = keyof typeof AI_MODELS;

export type ModelPrice = { inputPerMTok: number; outputPerMTok: number };

/** Verified against Anthropic's published list prices on 2026-11-03. */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  "anthropic/claude-haiku-5.5": { inputPerMTok: 0.1, outputPerMTok: 0.5 },
  "anthropic/claude-sonnet-5.5": { inputPerMTok: 2, outputPerMTok: 10 },
};

export const FALLBACK_PRICE: ModelPrice = { inputPerMTok: 10, outputPerMTok: 50 };

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = MODEL_PRICES[model] ?? FALLBACK_PRICE;
  const cost = (inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Budget policy (enforced in src/lib/ai.ts by reserving before every call)
// ---------------------------------------------------------------------------

/** Per call. Anything larger must be split by the feature; nothing is sent to the model. */
export const AI_MAX_INPUT_TOKENS = 200_000;
export const AI_DEFAULT_MAX_OUTPUT_TOKENS = 1024;
/** Upper bound for `maxOutputTokens`; larger requests are clamped. */
export const AI_MAX_OUTPUT_TOKENS = 16_000;

/**
 * Pessimistic token estimate for a prompt, used to RESERVE budget before the call (the
 * real token counts replace it afterwards). Tokenisers rarely produce more than one token
 * per two bytes of UTF-8; ordinary English is closer to one per four.
 */
export function estimateInputTokens(utf8Bytes: number): number {
  return Math.ceil(utf8Bytes / 2) + 64;
}

/** The most a call can cost: estimated input at the input price + every allowed output token. */
export function worstCaseCostUsd(model: string, estimatedInputTokens: number, maxOutputTokens: number): number {
  return estimateCostUsd(model, estimatedInputTokens, maxOutputTokens);
}

export const AI_BUDGET_POLICY = {
  /**
   * Share of its MONTHLY budget (plan limit `aiMonthlyBudgetUsd`) a workspace may spend in
   * one UTC day. Stops one workspace from burning a month of allowance — or the shared
   * daily pool — in an afternoon.
   */
  dailyShareOfMonthly: { free: 0.2, paid: 0.5 },
  /** No single workspace may take more than this share of AI_DAILY_BUDGET_USD in a day. */
  maxShareOfGlobalDaily: 0.5,
  /**
   * Free-plan workspaces TOGETHER may use at most this share of AI_DAILY_BUDGET_USD per day
   * (override the amount with AI_FREE_DAILY_BUDGET_USD). Creating many free workspaces can
   * therefore never exhaust the pool that paying customers draw from.
   */
  freePoolShareOfGlobalDaily: 0.25,
  /** A reservation whose call never settled (crash, timeout) is finalised at its worst-case cost after this long. */
  staleReservationMinutes: 15,
} as const;

/** Calls per workspace per minute through generateAiText (abuse and runaway-loop protection). */
export const AI_RATE_LIMIT = { limit: 120, windowSeconds: 60 } as const;
