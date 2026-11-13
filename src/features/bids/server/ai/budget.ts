import "server-only";
import { estimateInputTokens, worstCaseCostUsd } from "@/config/ai";
import { MAX_PACK_TOKENS } from "@/features/bids/constants";
import { modelIdsFor, type ModelStep } from "./models";

/**
 * What one cited check RESERVES — the worst case the wrapper holds for each model call
 * before it is sent (src/lib/ai.ts) — so plan budgets can be sized to it and tested.
 *
 * The whole-pack readings are listed exactly as the pipeline budgets them (step-analyse.ts,
 * step-recheck.ts): estimated input = the pack text plus the task, output = the pass's cap.
 * The per-document passes and the company check depend on the pack, so they are counted at
 * a generous fixed number of calls. Real cost is always at or below the reservation —
 * measured at roughly half or less of it.
 */
const CHARS_PER_PACK_TOKEN = 3.6; // estimateTokens() in ../../constants.ts
const TASK_BYTES = 12_000; // system prompt + task text
const OUTPUT_CAP = 32_000;
const DOCUMENT_PASS_TOKENS = 40_000; // MAX_DOCUMENT_TOKENS in step-analyse.ts
const DOCUMENT_PASSES = 6;
const COMPANY_BATCHES = 4; // 200 requirements

export type PlannedCall = { feature: string; model: string; reserveUsd: number };

const pass = (feature: string, step: ModelStep, inputBytes: number, maxOutputTokens: number): PlannedCall => {
  const model = modelIdsFor(step).primary;
  return { feature, model, reserveUsd: worstCaseCostUsd(model, estimateInputTokens(inputBytes), maxOutputTokens) };
};

/** The reservations of one check on a pack of `packTokens`, in the order the pipeline makes them. */
export function plannedCheckReservations(packTokens: number = MAX_PACK_TOKENS): PlannedCall[] {
  const packBytes = Math.ceil(packTokens * CHARS_PER_PACK_TOKEN) + TASK_BYTES;
  const reading = (base: number) => Math.min(OUTPUT_CAP, base + Math.round(packTokens / 6));
  const documentBytes = Math.ceil(Math.min(packTokens, DOCUMENT_PASS_TOKENS) * CHARS_PER_PACK_TOKEN) + TASK_BYTES;
  return [
    pass("bids.overview", "overview", packBytes, reading(12_000)),
    pass("bids.keyfacts", "extract2", packBytes, reading(5_000)),
    pass("bids.requirements.primary", "extract", packBytes, reading(16_000)),
    pass("bids.requirements.second", "extract2", packBytes, reading(16_000)),
    pass("bids.questions.primary", "extract", packBytes, reading(12_000)),
    pass("bids.questions.second", "extract2", packBytes, reading(12_000)),
    ...Array.from({ length: DOCUMENT_PASSES }, () => pass("bids.document", "document", documentBytes, Math.min(24_000, 8_000 + Math.round(Math.min(packTokens, DOCUMENT_PASS_TOKENS) / 2)))),
    // The second pass also carries the merged draft: allow a tenth more input.
    pass("bids.recheck", "verify", Math.ceil(packBytes * 1.1), Math.min(OUTPUT_CAP, 12_000 + Math.round(packTokens / 8))),
    ...Array.from({ length: COMPANY_BATCHES }, () => pass("bids.company_check", "company", 40_000, 10_000)),
  ];
}

/** The most a check can hold at once (every call reserved, none settled yet), in USD. */
export function largestCheckReservationUsd(packTokens: number = MAX_PACK_TOKENS): number {
  return Math.round(plannedCheckReservations(packTokens).reduce((sum, call) => sum + call.reserveUsd, 0) * 1e6) / 1e6;
}
