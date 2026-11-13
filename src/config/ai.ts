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
