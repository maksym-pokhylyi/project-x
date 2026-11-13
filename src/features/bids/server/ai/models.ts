import "server-only";
import { defaultSettingsMiddleware, gateway, wrapLanguageModel, type LanguageModel } from "ai";
import { MODEL_PRICES } from "@/config/ai";
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
 *   AI_MODEL_OVERVIEW  AI_MODEL_EXTRACT   AI_MODEL_EXTRACT2  AI_MODEL_DOCUMENT  AI_MODEL_VERIFY
 *   AI_MODEL_COMPANY   AI_MODEL_TRANSCRIBE  AI_MODEL_DRAFT   AI_MODEL_CLAIMS    AI_MODEL_EVALUATE
 *   AI_MODEL_FACTS     AI_MODEL_<STEP>_FALLBACK (per step)  or  AI_MODEL_FALLBACK (all steps)
 *
 * The defaults are MEASURED (2026-11-13; scripts/bids/model-eval.ts and draft-eval.ts, three
 * real packs with hand-checked ground truth of 138 facts, two fictional bidders; every call
 * with zero data retention):
 *
 *  - Brief (one reader, nothing to union with): claude-sonnet-5.5 was the only model with
 *    every brief fact right (88/88) and every citation found in the source. gpt-5-mini
 *    missed one, gemini-2.5-flash missed two and got one wrong, claude-haiku-5.5 missed 21.
 *  - Requirements and questions (two readers, unioned in code): gpt-5-mini + gemini-2.5-flash
 *    found 19/19 pass/fail requirements and 25/25 questions; alone they found 18 and 17
 *    requirements. Sonnet as a list reader costs eight times as much and missed four
 *    questions; Haiku missed two.
 *    Together: 138/138 facts, none wrong, 98% of citations verified, 61 s and $0.19 per pack.
 *  - Drafts: claude-haiku-5.5 made the fewest claims its evidence does not support (6 in four
 *    drafts; Sonnet 13, gpt-5-mini 28, gemini 39 — the same order under a second judge), kept
 *    to the word limit most often and is the cheapest.
 *  - Claims check: claude-sonnet-5.5 flagged the most real problems, including an invented
 *    asset the other three let through. Every model caught the two planted fabrications.
 *  - Marking: every model challenged the planted fabrication and scores agreed within one
 *    band, so it stays on a model from a different vendor than the one that wrote the draft.
 *
 * Never the nano / flash-lite class for extraction, drafting or marking.
 */
export const MODEL_STEPS = {
  /** Scanned pages -> text (native PDF input). */
  transcribe: { primary: "google/gemini-2.5-flash", fallback: "openai/gpt-5-mini" },
  /** The brief: summary, key dates, evaluation model, documents to return. One reader. */
  overview: { primary: "anthropic/claude-sonnet-5.5", fallback: "openai/gpt-5-mini" },
  /** First whole-pack reading of requirements and questions. */
  extract: { primary: "openai/gpt-5-mini", fallback: "google/gemini-2.5-flash" },
  /** Second, independent reading on a DIFFERENT model (unioned in code); also re-reads the key facts. */
  extract2: { primary: "google/gemini-2.5-flash", fallback: "openai/gpt-5-mini" },
  /** Per-document reading of questionnaires, response templates and clarification files. */
  document: { primary: "openai/gpt-5-mini", fallback: "google/gemini-2.5-flash" },
  /** "What did we miss" pass over the pack with the merged draft in hand. */
  verify: { primary: "openai/gpt-5-mini", fallback: "google/gemini-2.5-flash" },
  /** Requirement-by-requirement comparison with company facts. */
  company: { primary: "google/gemini-2.5-flash", fallback: "openai/gpt-5-mini" },
  /** Company facts draft from a website; library document summaries. */
  facts: { primary: "google/gemini-2.5-flash-lite", fallback: "openai/gpt-5-mini" },
  /** First drafts and revisions of answers. */
  draft: { primary: "anthropic/claude-haiku-5.5", fallback: "openai/gpt-5-mini" },
  /** Checking a draft's claims against the evidence it was given. */
  claims: { primary: "anthropic/claude-sonnet-5.5", fallback: "openai/gpt-5-mini" },
  /** Evaluator-style marking. */
  evaluate: { primary: "openai/gpt-5-mini", fallback: "google/gemini-2.5-flash" },
} as const satisfies Record<string, { primary: string; fallback: string }>;

export type ModelStep = keyof typeof MODEL_STEPS;

/**
 * Steps that read a whole pack or return a long structured list: they use the wrapper's
 * document-scale ceilings (src/config/ai.ts). Drafting, checking and marking do not.
 */
const DOCUMENT_SCALE_STEPS: ReadonlySet<ModelStep> = new Set<ModelStep>(["transcribe", "overview", "extract", "extract2", "document", "verify", "company"]);

export function scaleFor(step: ModelStep): "standard" | "document" {
  return DOCUMENT_SCALE_STEPS.has(step) ? "document" : "standard";
}

export type ResolvedModel = {
  /** What to hand to generateAiText: a gateway id, or a wrapped/mocked model instance. */
  model: string | Exclude<LanguageModel, string>;
  /** Gateway id ("provider/model") used for cost attribution and recorded on the bid. */
  id: string;
};

const OFFLINE_MODEL_ID = "offline/pattern-matcher";

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
  // Claude 5.5 models think adaptively by default and thinking counts against the output
  // limit: at the default effort a long extraction can spend its whole allowance thinking
  // and return no text. Extraction and drafting from supplied evidence need little
  // deliberation, so effort is set low (configurable).
  if (id.startsWith("anthropic/")) return { providerOptions: { anthropic: { effort: env("AI_ANTHROPIC_EFFORT") ?? "low" } } };
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
    // It costs nothing; without a list price the wrapper would reserve it at the (high) rate of an unknown model.
    MODEL_PRICES[OFFLINE_MODEL_ID] ??= { inputPerMTok: 0, outputPerMTok: 0 };
    return which === "primary" ? { model: offlineModel, id: OFFLINE_MODEL_ID } : null;
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

/** The gateway refused the request because zero data retention could not be guaranteed. */
export class ZdrUnavailableError extends Error {
  constructor(step: string, cause?: unknown) {
    super(`No model could take this request with zero data retention (step "${step}"). Nothing was sent without it.`, { cause });
    this.name = "ZdrUnavailableError";
  }
}

/**
 * True when the gateway refused a request because zero data retention was asked for and the
 * account or the model's providers cannot honour it ("ZDR requires a paid account", "no ZDR
 * provider"). The right response is another model — never the same request without ZDR.
 */
export function isZdrUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; type?: unknown; responseBody?: unknown; cause?: unknown };
  const text = [candidate.message, candidate.type, candidate.responseBody].filter((part): part is string => typeof part === "string").join(" ");
  if (/\bzdr\b|zero[\s_-]*data[\s_-]*retention|disallow[\s_-]*prompt[\s_-]*training|data retention polic/i.test(text)) return true;
  return candidate.cause ? isZdrUnavailable(candidate.cause) : false;
}
