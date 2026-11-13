import "server-only";
import type { ModelMessage } from "ai";
import { z } from "zod";
import { generateAiText } from "@/lib/ai";
import { log } from "@/lib/logger";
import { ModelJsonError, parseModelJson, salvageTruncatedJson, sanitizeModelValue } from "./json";
import { isModelUnavailable, isZdrUnavailable, resolveModel, ZdrUnavailableError, type ModelStep } from "./models";

export type AiUsage = { calls: number; inputTokens: number; outputTokens: number; costUsd: number };

export const ZERO_USAGE: AiUsage = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

export function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  return {
    calls: a.calls + b.calls,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUsd: Math.round((a.costUsd + b.costUsd) * 1e6) / 1e6,
  };
}

export type AiCallBase = {
  /** Workspace that pays. In request handlers take it from requireOrg(); in jobs from the bid row. */
  organizationId: string;
  userId?: string | null;
  /** Stable feature name for cost attribution, e.g. "bids.requirements". */
  feature: string;
  /** Pipeline step: decides the model (see ./models.ts). */
  step: ModelStep;
  system: string;
  messages: ModelMessage[] | string;
  maxOutputTokens: number;
  /** Hard stop for one model call. */
  timeoutMs?: number;
};

export type AiTextResult = { text: string; model: string; usage: AiUsage };

async function runOn(options: AiCallBase, which: "primary" | "fallback"): Promise<AiTextResult> {
  const resolved = resolveModel(options.step, which);
  if (!resolved) throw new Error(`No ${which} model configured for step "${options.step}"`);
  const result = await generateAiText({
    organizationId: options.organizationId,
    userId: options.userId ?? null,
    feature: options.feature,
    model: resolved.model,
    instructions: options.system,
    prompt: options.messages,
    maxOutputTokens: options.maxOutputTokens,
    abortSignal: AbortSignal.timeout(options.timeoutMs ?? 180_000),
  });
  return {
    text: result.text,
    model: resolved.id,
    usage: { calls: 1, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd },
  };
}

/**
 * One model call returning text. Budget checks and usage recording happen in generateAiText.
 * If the step's primary model is not available to the account, or cannot take the request
 * with zero data retention, the configured secondary model is tried once; any other
 * failure propagates (jobs retry with backoff).
 */
export async function callText(options: AiCallBase, which: "primary" | "fallback" = "primary"): Promise<AiTextResult> {
  const guarded = async (target: "primary" | "fallback") => {
    try {
      return await runOn(options, target);
    } catch (error) {
      // Never retried without zero data retention: the typed error says why nothing was sent.
      if (target === "fallback" && isZdrUnavailable(error)) throw new ZdrUnavailableError(options.step, error);
      throw error;
    }
  };
  if (which === "fallback") return guarded("fallback");
  try {
    return await runOn(options, "primary");
  } catch (error) {
    const zdr = isZdrUnavailable(error);
    if (!zdr && !isModelUnavailable(error)) throw error;
    if (!resolveModel(options.step, "fallback")) throw zdr ? new ZdrUnavailableError(options.step, error) : error;
    log.warn(zdr ? "bids.ai: primary model cannot guarantee zero data retention, using the secondary model" : "bids.ai: primary model unavailable, using the secondary model", { step: options.step, feature: options.feature });
    return guarded("fallback");
  }
}

export type AiJsonResult<T> = {
  value: T;
  model: string;
  usage: AiUsage;
  /** True when the output was cut off and only its complete items were kept. */
  truncated: boolean;
};

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 12)
    .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

function asMessages(messages: ModelMessage[] | string): ModelMessage[] {
  return typeof messages === "string" ? [{ role: "user", content: messages }] : messages;
}

type Attempt<T> = { ok: true; value: T; truncated: boolean } | { ok: false; problem: string };

/**
 * One model call that must return JSON matching `schema`.
 *
 * The output is parsed, sanitised and validated here — the model's word is never taken for
 * it. Recovery, in order:
 *   1. a cut-off output (ran out of tokens) keeps its complete items, `truncated` is set;
 *   2. invalid JSON or a schema mismatch gets ONE repair turn with the exact errors;
 *   3. if that still fails, the step's secondary model is asked once (some providers cannot
 *      hold long JSON together on large inputs — REPORT.md §4.6 #9).
 * After that a ModelJsonError is thrown.
 */
export async function callJson<T>(options: AiCallBase & { schema: z.ZodType<T> }): Promise<AiJsonResult<T>> {
  const attempt = (text: string): Attempt<T> => {
    let parsed: unknown;
    let truncated = false;
    try {
      parsed = parseModelJson(text);
    } catch (error) {
      const salvaged = salvageTruncatedJson(text);
      if (salvaged === null) return { ok: false, problem: error instanceof ModelJsonError ? error.message : "The response is not valid JSON." };
      parsed = salvaged;
      truncated = true;
    }
    const validated = options.schema.safeParse(sanitizeModelValue(parsed));
    if (!validated.success) return { ok: false, problem: `The JSON does not match the required shape:\n${describeIssues(validated.error)}` };
    return { ok: true, value: validated.data, truncated };
  };

  const first = await callText(options);
  let usage = first.usage;
  const firstTry = attempt(first.text);
  if (firstTry.ok) return { value: firstTry.value, model: first.model, usage, truncated: firstTry.truncated };

  let problem = firstTry.problem;
  let lastText = first.text;
  try {
    const repair = await callText({
      ...options,
      feature: `${options.feature}.repair`,
      messages: [
        ...asMessages(options.messages),
        { role: "assistant", content: first.text.slice(0, 60_000) || "(empty)" },
        { role: "user", content: `${problem}\n\nReturn the complete corrected JSON object only: no code fence, no commentary. Keep every item; fix only what is invalid.` },
      ],
    });
    usage = addUsage(usage, repair.usage);
    lastText = repair.text;
    const secondTry = attempt(repair.text);
    if (secondTry.ok) return { value: secondTry.value, model: repair.model, usage, truncated: secondTry.truncated };
    problem = secondTry.problem;
  } catch (error) {
    if (!(error instanceof Error) || /budget/i.test(error.name)) throw error;
    problem = `${problem} (the repair call failed: ${error.message})`;
  }

  const fallback = resolveModel(options.step, "fallback");
  if (fallback && fallback.id !== first.model) {
    log.warn("bids.ai: unusable JSON from the primary model, asking the secondary model", { step: options.step, feature: options.feature });
    const second = await callText({ ...options, feature: `${options.feature}.fallback` }, "fallback");
    usage = addUsage(usage, second.usage);
    lastText = second.text;
    const fallbackTry = attempt(second.text);
    if (fallbackTry.ok) return { value: fallbackTry.value, model: second.model, usage, truncated: fallbackTry.truncated };
    problem = fallbackTry.problem;
  }
  throw new ModelJsonError(`The model did not return usable JSON. ${problem}`, lastText.slice(0, 2000));
}
