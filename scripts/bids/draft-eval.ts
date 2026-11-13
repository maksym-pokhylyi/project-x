/**
 * Compares drafting and marking models on the spike's two FICTIONAL bidders (evidence
 * library + questions with word budgets), using the production prompts and limit
 * enforcement:
 *
 *   NODE_USE_ENV_PROXY=1 pnpm tsx --import ./scripts/register-server-only.mjs scripts/bids/draft-eval.ts <model,model> [judgeModel]
 *
 * For every model: each question is drafted once; a FIXED judge model then lists the claims
 * the evidence does not support (the production claims check), so all drafts are judged by
 * the same reader. Each model also marks one answer with a planted fabricated capability,
 * to see whether it credits or challenges it. Outputs are kept in .data/draft-eval and
 * never paid for twice. Costs real money.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "../load-env.mjs";

loadEnv();
process.env.AI_DAILY_BUDGET_USD = process.env.BIDS_EVAL_BUDGET_USD ?? "25";
const gatewayEnv = process.env.BIDS_GATEWAY_ENV_FILE ?? "/home/user/vtest/.env.local";
if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN && existsSync(gatewayEnv)) {
  for (const line of readFileSync(gatewayEnv, "utf8").split("\n")) {
    const match = /^(VERCEL_OIDC_TOKEN|AI_GATEWAY_API_KEY)=(.*)$/.exec(line.trim());
    if (match) process.env[match[1]!] = match[2]!.replace(/^"|"$/g, "");
  }
}

const [modelsArg, judgeArg] = process.argv.slice(2);
const spikeDir = process.env.BIDS_SPIKE_DIR ?? "/home/user/spikes/bid-pack";
const OUT = path.resolve(".data/draft-eval");
const QUESTIONS: Record<string, string[]> = { "canopy-kerb": ["TFC-Q3", "TFC-Q5"], "steppe-english": ["FCDO-PROFILE", "FCDO-GDPR"] };
/** A capability neither bidder's library contains, planted in the answer each model marks. */
const PLANTED = "We hold ISO 27001 certification and have delivered more than forty comparable contracts for central government.";
const DEFAULT_JUDGE = "anthropic/claude-sonnet-5.5";
const slugOf = (model: string) => model.replace(/[^a-z0-9.-]+/gi, "_");
const short = (model: string) => model.split("/").pop()!;

type Fixture = { scoring_scale?: Array<Record<string, unknown>> | string; questions: Array<{ id: string; title: string; weight_percent: string | number | null; limit_stated: string | null; word_budget: string | number; text: string; guidance?: string | null }>; pack: string };

function cached<T>(file: string, run: () => Promise<T>): Promise<T> {
  if (existsSync(file)) return Promise.resolve(JSON.parse(readFileSync(file, "utf8")) as T);
  return run().then((value) => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value));
    return value;
  });
}

async function main() {
  const models = (modelsArg ?? "").split(",").filter(Boolean);
  const judge = judgeArg ?? DEFAULT_JUDGE;
  if (models.length === 0) throw new Error("usage: draft-eval.ts <model,model> [judgeModel]");
  const { db, pg } = await import("../../src/db");
  const { organizations } = await import("../../src/db/schema");
  const { DEFAULT_SCALE, probeClaims, probeDraft, probeEvaluate } = await import("../../src/features/bids/server/drafting");
  const organizationId = `eval_${Date.now().toString(36)}`;
  await db.insert(organizations).values({ id: organizationId, name: "Model evaluation", slug: organizationId, createdAt: new Date() });
  // A paid workspace would have a larger monthly AI budget; several small workspaces stand in for it.
  let workspace = 0;
  const scope = async () => {
    workspace += 1;
    const id = `${organizationId}_${workspace}`;
    await db.insert(organizations).values({ id, name: "Model evaluation", slug: id, createdAt: new Date() });
    return { organization: { id }, user: { id: null } } as never;
  };
  const only = (step: string, model: string) => {
    process.env[`AI_MODEL_${step}`] = model;
    process.env[`AI_MODEL_${step}_FALLBACK`] = model;
  };

  type DraftRow = { model: string; bidder: string; question: string; limit: number; first: number; final: number; trimmed: boolean; gaps: number; unknownMarkers: number; figures: number; unsupported: number; seconds: number; cost: number; error?: string };
  const rows: DraftRow[] = [];
  const marks: Array<{ model: string; bidder: string; score: string; verdict: string; seconds: number; cost: number }> = [];
  const planted: Array<{ model: string; bidder: string; iso: boolean; forty: boolean; flagged: number; seconds: number; cost: number; error?: string }> = [];

  for (const [bidder, ids] of Object.entries(QUESTIONS)) {
    const fixture = JSON.parse(readFileSync(path.join(spikeDir, "evidence", bidder, "questions.json"), "utf8")) as Fixture;
    const library = readFileSync(path.join(spikeDir, "evidence", bidder, "library.md"), "utf8");
    const sources = library
      .split(/^## /m)
      .slice(1)
      .flatMap((section) => {
        const match = /^(E\d+)\.\s*([^\n]*)\n([\s\S]*)$/.exec(section);
        return match ? [{ marker: match[1]!, title: match[2]!.trim(), text: match[3]!.trim() }] : [];
      });
    const tender = `Tender: ${fixture.pack}`;
    for (const id of ids) {
      const item = fixture.questions.find((question) => question.id === id)!;
      const question = { ref: item.id, title: item.title, text: item.text, guidance: item.guidance ?? null, weighting: Number(item.weight_percent) || null, limitText: item.limit_stated, wordLimit: Number(item.word_budget) };
      for (const model of models) {
        only("DRAFT", model);
        const file = path.join(OUT, bidder, id, `${slugOf(model)}.json`);
        try {
          const draft = await cached(file, async () => {
            const started = Date.now();
            const result = await probeDraft(await scope(), { sources, tender, question, scale: DEFAULT_SCALE });
            return { ...result, ms: Date.now() - started };
          });
          only("CLAIMS", judge);
          const claims = await cached(path.join(OUT, bidder, id, `${slugOf(model)}.claims${judge === DEFAULT_JUDGE ? "" : `.${slugOf(judge)}`}.json`), async () => probeClaims(await scope(), { sources, question, draft: draft.text }));
          rows.push({
            model,
            bidder,
            question: id,
            limit: question.wordLimit,
            first: draft.firstWordCount,
            final: draft.wordCount,
            trimmed: draft.trimmed,
            gaps: draft.gaps.length,
            unknownMarkers: draft.unknownMarkers.length,
            figures: draft.ungroundedFigures.length,
            unsupported: claims.unsupported.length,
            seconds: draft.ms / 1000,
            cost: draft.usage.costUsd,
          });
        } catch (error) {
          rows.push({ model, bidder, question: id, limit: question.wordLimit, first: 0, final: 0, trimmed: false, gaps: 0, unknownMarkers: 0, figures: 0, unsupported: 0, seconds: 0, cost: 0, error: error instanceof Error ? error.message.slice(0, 120) : "failed" });
        }
      }
    }
    // Marking: every model marks the same answer (the first model's first draft) with a planted fabrication.
    const firstId = ids[0]!;
    const item = fixture.questions.find((question) => question.id === firstId)!;
    const question = { ref: item.id, title: item.title, text: item.text, guidance: null, weighting: Number(item.weight_percent) || null, limitText: item.limit_stated, wordLimit: Number(item.word_budget) };
    const baseFile = path.join(OUT, bidder, firstId, `${slugOf(models[0]!)}.json`);
    if (!existsSync(baseFile)) continue;
    const answer = `${(JSON.parse(readFileSync(baseFile, "utf8")) as { text: string }).text}\n\n${PLANTED}`;
    for (const model of models) {
      only("EVALUATE", model);
      try {
        const marked = await cached(path.join(OUT, bidder, firstId, `${slugOf(model)}.mark.json`), async () => {
          const started = Date.now();
          const result = await probeEvaluate(await scope(), { sources, tender, question, scale: DEFAULT_SCALE, answer });
          return { ...result, ms: Date.now() - started };
        });
        const mentions = (text: string) => /iso\s*27001|forty|40 comparable/i.test(text);
        const credited = marked.value.strengths.some(mentions);
        const challenged = mentions(marked.value.rationale) || marked.value.improvements.some((entry) => mentions(`${entry.suggestion} ${entry.rationale}`)) || marked.value.missing_parts.some(mentions);
        marks.push({ model, bidder, score: marked.value.score, verdict: credited && !challenged ? "CREDITED the fabrication" : challenged ? "challenged it" : "did not mention it", seconds: marked.ms / 1000, cost: marked.usage.costUsd });
      } catch (error) {
        marks.push({ model, bidder, score: "-", verdict: `failed: ${error instanceof Error ? error.message.slice(0, 80) : ""}`, seconds: 0, cost: 0 });
      }
      // The claims check on the same answer: does each model, as the checker, catch both planted claims?
      only("CLAIMS", model);
      try {
        const checked = await cached(path.join(OUT, bidder, firstId, `${slugOf(model)}.planted.json`), async () => {
          const started = Date.now();
          const result = await probeClaims(await scope(), { sources, question, draft: answer });
          return { ...result, ms: Date.now() - started };
        });
        const flagged = checked.unsupported.map((entry) => `${entry.claim} ${entry.reason ?? ""}`);
        planted.push({
          model,
          bidder,
          iso: flagged.some((text) => /iso\s*27001/i.test(text)),
          forty: flagged.some((text) => /forty|\b40\b/i.test(text)),
          flagged: checked.unsupported.length,
          seconds: checked.ms / 1000,
          cost: checked.usage.costUsd,
        });
      } catch (error) {
        planted.push({ model, bidder, iso: false, forty: false, flagged: 0, seconds: 0, cost: 0, error: error instanceof Error ? error.message.slice(0, 80) : "failed" });
      }
    }
  }

  console.log(`\nDRAFTS (judge: ${short(judge)})`);
  for (const row of rows) {
    console.log(
      `${short(row.model).padEnd(18)} ${row.bidder.padEnd(15)} ${row.question.padEnd(13)} limit ${String(row.limit).padStart(4)} first ${String(row.first).padStart(4)} final ${String(row.final).padStart(4)}${row.trimmed ? " CUT" : "    "} gaps ${row.gaps} badmarkers ${row.unknownMarkers} figures ${row.figures} unsupported ${row.unsupported} ${row.seconds.toFixed(0).padStart(3)}s $${row.cost.toFixed(4)}${row.error ? ` ERROR ${row.error}` : ""}`,
    );
  }
  console.log("\nTOTAL per drafting model");
  for (const model of models) {
    const mine = rows.filter((row) => row.model === model && !row.error);
    const sum = (pick: (row: DraftRow) => number) => mine.reduce((total, row) => total + pick(row), 0);
    console.log(
      `${short(model).padEnd(18)} drafts ${mine.length} within limit at first attempt ${mine.filter((row) => row.first <= row.limit).length}/${mine.length} cut ${mine.filter((row) => row.trimmed).length} unsupported ${sum((row) => row.unsupported)} ungrounded figures ${sum((row) => row.figures)} bad markers ${sum((row) => row.unknownMarkers)} gaps ${sum((row) => row.gaps)} avg ${(sum((row) => row.seconds) / Math.max(1, mine.length)).toFixed(0)}s $${(sum((row) => row.cost) / Math.max(1, mine.length)).toFixed(4)} per draft`,
    );
  }
  console.log("\nMARKING an answer with a planted fabricated capability");
  for (const mark of marks) console.log(`${short(mark.model).padEnd(18)} ${mark.bidder.padEnd(15)} score ${mark.score.padEnd(3)} ${mark.verdict.padEnd(28)} ${mark.seconds.toFixed(0).padStart(3)}s $${mark.cost.toFixed(4)}`);
  console.log("\nCLAIMS CHECK of the same answer (two planted claims: ISO 27001, forty comparable contracts)");
  for (const row of planted) {
    console.log(
      `${short(row.model).padEnd(18)} ${row.bidder.padEnd(15)} ISO 27001 ${row.iso ? "caught" : "MISSED"}  forty contracts ${row.forty ? "caught" : "MISSED"}  flagged in all ${String(row.flagged).padStart(2)} ${row.seconds.toFixed(0).padStart(3)}s $${row.cost.toFixed(4)}${row.error ? ` ERROR ${row.error}` : ""}`,
    );
  }
  await pg.end({ timeout: 5 });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
