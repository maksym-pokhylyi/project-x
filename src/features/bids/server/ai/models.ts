import "server-only";
import { defaultSettingsMiddleware, gateway, wrapLanguageModel, type LanguageModel } from "ai";
import { offlineModel } from "./offline-model";

/**
 * Model routing for the bid desk and library — the ONE place that decides which model does
 * which job. Every call still goes through `generateAiText` (src/lib/ai.ts), so usage is
 * recorded and the per-workspace and global budgets are enforced.
 *
 * Each pipeline step has a primary and a secondary model (Vercel AI Gateway ids). The
 * secondary is tried once, automatically, when the primary is not available to the
 * account (see `isModelUnavailable`). Override per step with env, no code change:
 *
 *   AI_MODEL_EXTRACT   AI_MODEL_EXTRACT2  AI_MODEL_DOCUMENT  AI_MODEL_VERIFY    AI_MODEL_COMPANY
 *   AI_MODEL_TRANSCRIBE  AI_MODEL_DRAFT   AI_MODEL_CLAIMS    AI_MODEL_EVALUATE  AI_MODEL_FACTS
 *   AI_MODEL_<STEP>_FALLBACK (per step)  or  AI_MODEL_FALLBACK (all steps)
 *
 * Defaults follow the bid-pack spike (REPORT.md §8.1). The Claude models could not be
 * measured (blocked on the gateway's free tier), so the defaults are the two mid-tier
 * models whose UNION gave the best pass/fail recall — gemini-2.5-flash + gpt-5-mini — and
 * never the nano / flash-lite class for extraction, drafting or marking. Once Claude
 * models are enabled, switch by config and re-run the live smoke test, e.g.
 *   AI_MODEL_EXTRACT=anthropic/claude-haiku-5.5  AI_MODEL_EXTRACT2=openai/gpt-5-mini
 *   AI_MODEL_DRAFT=anthropic/claude-sonnet-5.5   AI_MODEL_EVALUATE=anthropic/claude-sonnet-5.5
 */
export const MODEL_STEPS = {
  /** Scanned pages -> text (native PDF input). */
  transcribe: { primary: "google/gemini-2.5-flash", fallback: "openai/gpt-5-mini" },
  /** First whole-pack reading: brief, requirements, questions. */
  extract: { primary: "google/gemini-2.5-flash", fallback: "openai/gpt-5-mini" },
  /** Second, independent whole-pack reading on a DIFFERENT model (results are unioned in code). */
  extract2: { primary: "openai/gpt-5-mini", fallback: "google/gemini-2.5-flash" },
  /** Per-document reading of questionnaires, response templates and clarification files. */
  document: { primary: "openai/gpt-5-mini", fallback: "google/gemini-2.5-flash" },
  /** "What did we miss" pass over the pack with the merged draft in hand. */
  verify: { primary: "openai/gpt-5-mini", fallback: "google/gemini-2.5-flash" },
  /** Requirement-by-requirement comparison with company facts. */
  company: { primary: "google/gemini-2.5-flash", fallback: "openai/gpt-5-mini" },
  /** Company facts draft from a website; library document summaries. */
  facts: { primary: "google/gemini-2.5-flash-lite", fallback: "openai/gpt-5-mini" },
  /** First drafts and revisions of answers. */
  draft: { primary: "openai/gpt-5-mini", fallback: "google/gemini-2.5-flash" },
  /** Checking a draft's claims against the evidence it was given. */
  claims: { primary: "openai/gpt-5-mini", fallback: "google/gemini-2.5-flash" },
  /** Evaluator-style marking. */
  evaluate: { primary: "openai/gpt-5-mini", fallback: "google/gemini-2.5-flash" },
} as const satisfies Record<string, { primary: string; fallback: string }>;

export type ModelStep = keyof typeof MODEL_STEPS;

export type ResolvedModel = {
  /** What to hand to generateAiText: a gateway id, or a wrapped/mocked model instance. */
  model: string | Exclude<LanguageModel, string>;
  /** Gateway id ("provider/model") used for cost attribution and recorded on the bid. */
  id: string;
};

type TestResolver = (step: ModelStep, which: "primary" | "fallback") => Exclude<LanguageModel, string> | null | undefined;
let testResolver: TestResolver | null = null;

/** Tests only: route model calls to a mock. Pass null to restore normal routing. */
export function setBidModelResolverForTests(resolver: TestResolver | null): void {
  testResolver = resolver;
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** The gateway ids configured for a step (after env overrides). */
export function modelIdsFor(step: ModelStep): { primary: string; fallback: string | null } {
  const key = step.toUpperCase();
  const primary = env(`AI_MODEL_${key}`) ?? MODEL_STEPS[step].primary;
  const fallback = env(`AI_MODEL_${key}_FALLBACK`) ?? env("AI_MODEL_FALLBACK") ?? MODEL_STEPS[step].fallback;
  return { primary, fallback: fallback && fallback !== primary ? fallback : null };
}

/**
 * Call-level defaults the foundation wrapper cannot pass through. GPT-5 family models
 * reason at "medium" by default, which is slow and costly for extraction; everything else
 * runs with provider defaults so prompts stay model-neutral.
 */
function settingsFor(id: string): Parameters<typeof defaultSettingsMiddleware>[0]["settings"] | null {
  if (id.startsWith("openai/gpt-5")) return { providerOptions: { openai: { reasoningEffort: env("AI_OPENAI_REASONING_EFFORT") ?? "low" } } };
  // Gemini 2.5 Flash thinks dynamically by default; extraction does not need long reasoning
  // and thinking tokens are billed as output (they tripled the cost of a small pack).
  if (id === "google/gemini-2.5-flash") return { providerOptions: { google: { thinkingConfig: { thinkingBudget: Number(env("AI_GEMINI_THINKING_BUDGET") ?? 1024) } } } };
  return null;
}

function instantiate(id: string): ResolvedModel {
  const settings = settingsFor(id);
  if (!settings) return { model: id, id };
  const slash = id.indexOf("/");
  // Keep "provider/model" as the wrapped model's identity so cost attribution still works.
  const wrapped = wrapLanguageModel({
    model: gateway(id),
    middleware: defaultSettingsMiddleware({ settings }),
    providerId: slash > 0 ? id.slice(0, slash) : "gateway",
    modelId: slash > 0 ? id.slice(slash + 1) : id,
  });
  return { model: wrapped, id };
}

export function resolveModel(step: ModelStep, which: "primary" | "fallback" = "primary"): ResolvedModel | null {
  if (testResolver) {
    const mocked = testResolver(step, which);
    return mocked ? { model: mocked, id: `${mocked.provider}/${mocked.modelId}` } : null;
  }
  // Offline pattern-matching stand-in for e2e tests and network-free demos; never in production.
  if (process.env.BIDS_OFFLINE_AI === "1" && process.env.VERCEL_ENV !== "production") {
    return which === "primary" ? { model: offlineModel, id: "offline/pattern-matcher" } : null;
  }
  const ids = modelIdsFor(step);
  const id = which === "primary" ? ids.primary : ids.fallback;
  return id ? instantiate(id) : null;
}

/**
 * True when an error means "this account cannot use this model" (gateway free tier,
 * unknown or retired model id) — the one case where switching model is the right response.
 * Rate limits, timeouts and server errors are NOT included: those are retried by the job.
 */
export function isModelUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; message?: unknown; statusCode?: unknown; type?: unknown; cause?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const type = typeof candidate.type === "string" ? candidate.type : "";
  if (/ModelNotFound|NoSuchModel|RestrictedModels/i.test(name)) return true;
  if (/no_providers_available|model_not_found/i.test(type)) return true;
  if (/do not have access to this model|no_providers_available|model[^.]{0,40}(not found|does not exist|not available|is not supported)|unknown model/i.test(message)) return true;
  return candidate.cause ? isModelUnavailable(candidate.cause) : false;
}
