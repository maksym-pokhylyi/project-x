/**
 * Measures extraction models against the spike's hand-written ground truth, model by model
 * and as two-model unions (the union is the pipeline's own deterministic code).
 *
 *   NODE_USE_ENV_PROXY=1 pnpm tsx --import ./scripts/register-server-only.mjs scripts/bids/model-eval.ts extract <pack,pack> <model,model>
 *   pnpm tsx --import ./scripts/register-server-only.mjs scripts/bids/model-eval.ts report <pack,pack> <model,model>
 *
 * `extract` runs the three whole-pack readings (brief, requirements, questions) once per
 * pack and model through the normal wrapper (usage recorded, zero data retention) and keeps
 * the outputs in .data/model-eval; finished readings are never paid for twice. `report`
 * scores every model alone and every pair as a union: recall against ground truth, wrong
 * values, citation match rate, items whose quote is not in the pack, latency and cost.
 * Costs real money in `extract` mode.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "../load-env.mjs";
import { scoreBrief, summarise, type ScoreFact, type ScoreResult } from "./score";

loadEnv();
process.env.AI_DAILY_BUDGET_USD = process.env.BIDS_EVAL_BUDGET_USD ?? "25";
const gatewayEnv = process.env.BIDS_GATEWAY_ENV_FILE ?? "/home/user/vtest/.env.local";
if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN && existsSync(gatewayEnv)) {
  for (const line of readFileSync(gatewayEnv, "utf8").split("\n")) {
    const match = /^(VERCEL_OIDC_TOKEN|AI_GATEWAY_API_KEY)=(.*)$/.exec(line.trim());
    if (match) process.env[match[1]!] = match[2]!.replace(/^"|"$/g, "");
  }
}

const [mode, packsArg, modelsArg] = process.argv.slice(2);
const spikeDir = process.env.BIDS_SPIKE_DIR ?? "/home/user/spikes/bid-pack";
const OUT = path.resolve(".data/model-eval");
const TASKS = ["overview", "requirements", "questions"] as const;
type Task = (typeof TASKS)[number];
type Stored = { value?: Record<string, unknown>; model?: string; usage?: { calls: number; inputTokens: number; outputTokens: number; costUsd: number }; truncated?: boolean; ms: number; error?: string };

const slugOf = (model: string) => model.replace(/[^a-z0-9.-]+/gi, "_");
const fileOf = (pack: string, model: string, task: Task) => path.join(OUT, pack, slugOf(model), `${task}.json`);
const short = (model: string) => model.split("/").pop()!;

async function loadPack(slug: string) {
  const { fileKindFromName } = await import("../../src/features/bids/constants");
  const { extractDocument } = await import("../../src/features/bids/server/extract");
  const { buildPack } = await import("../../src/features/bids/server/pipeline/pack");
  const { buildPackIndex } = await import("../../src/features/bids/server/pipeline/quote-verify");
  const dir = path.join(spikeDir, "packs", slug, "files");
  const sources = [];
  for (const name of (await readdir(dir)).sort()) {
    const kind = fileKindFromName(name);
    if (!kind || kind === "zip") continue;
    try {
      const document = await extractDocument(kind, new Uint8Array(await readFile(path.join(dir, name))));
      sources.push({ id: name, name, units: document.units });
    } catch {
      console.log(`  (skipped unreadable file ${name})`);
    }
  }
  const pack = buildPack(sources);
  return { pack, index: buildPackIndex(pack.files) };
}

async function extract(packs: string[], models: string[]) {
  const { db, pg } = await import("../../src/db");
  const { organizations } = await import("../../src/db/schema");
  const { callJson } = await import("../../src/features/bids/server/ai/call");
  const prompts = await import("../../src/features/bids/server/pipeline/prompts");
  const schema = await import("../../src/features/bids/server/pipeline/schema");
  const { packMessages } = await import("../../src/features/bids/server/pipeline/step-analyse");
  const spec = {
    overview: { task: prompts.OVERVIEW_TASK, schema: schema.overviewOutputSchema, base: 12_000 },
    requirements: { task: prompts.REQUIREMENTS_TASK, schema: schema.requirementsOutputSchema, base: 16_000 },
    questions: { task: prompts.QUESTIONS_TASK, schema: schema.questionsOutputSchema, base: 12_000 },
  };
  for (const slug of packs) {
    const { pack } = await loadPack(slug);
    console.log(`\n${slug}: ${pack.tokens} tokens, ${pack.files.length} files`);
    for (const model of models) {
      const todo = TASKS.filter((task) => !existsSync(fileOf(slug, model, task)));
      if (todo.length === 0) continue;
      // One workspace per pack and model, so the per-workspace budget never decides a result.
      const organizationId = `eval_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(organizations).values({ id: organizationId, name: "Model evaluation", slug: organizationId, createdAt: new Date() });
      process.env.AI_MODEL_EXTRACT = model;
      process.env.AI_MODEL_EXTRACT_FALLBACK = model; // no silent switch to another model
      mkdirSync(path.dirname(fileOf(slug, model, "overview")), { recursive: true });
      await Promise.all(
        todo.map(async (task) => {
          const started = Date.now();
          let stored: Stored;
          try {
            const result = await callJson({
              organizationId,
              feature: `eval.${task}`,
              step: "extract",
              system: prompts.EXTRACT_SYSTEM,
              messages: packMessages(pack.text, spec[task].task),
              schema: spec[task].schema as never,
              maxOutputTokens: Math.min(32_000, spec[task].base + Math.round(pack.tokens / 6)),
              timeoutMs: 290_000,
            });
            stored = { value: result.value as Record<string, unknown>, model: result.model, usage: result.usage, truncated: result.truncated, ms: Date.now() - started };
          } catch (error) {
            stored = { error: error instanceof Error ? error.message.slice(0, 300) : String(error), ms: Date.now() - started };
          }
          writeFileSync(fileOf(slug, model, task), JSON.stringify(stored));
          console.log(`  ${short(model)} ${task}: ${stored.error ? `FAILED ${stored.error}` : `${Math.round(stored.ms / 1000)}s $${stored.usage!.costUsd.toFixed(4)} (${stored.usage!.calls} call${stored.usage!.calls === 1 ? "" : "s"})`}`);
        }),
      );
    }
  }
  await pg.end({ timeout: 5 });
}

type Reading = { model: string; parts: Record<Task, Stored> };

async function report(packs: string[], models: string[]) {
  const { dedupeQuestions, dedupeRequirements } = await import("../../src/features/bids/server/pipeline/merge");
  const { verifyCitation } = await import("../../src/features/bids/server/pipeline/quote-verify");
  const { toRequirement } = await import("../../src/features/bids/server/pipeline/transform");
  type Row = { config: string; pf: [number, number]; q: [number, number]; dl: [number, number]; all: [number, number]; wrong: number; cites: [number, number]; notFound: number; figure: number; seconds: number; cost: number; failed: string[] };
  const totals = new Map<string, Row>();
  const add = (row: Row) => {
    const sum = totals.get(row.config);
    if (!sum) return void totals.set(row.config, structuredClone(row));
    for (const key of ["pf", "q", "dl", "all", "cites"] as const) sum[key] = [sum[key][0] + row[key][0], sum[key][1] + row[key][1]];
    sum.wrong += row.wrong;
    sum.notFound += row.notFound;
    sum.figure += row.figure;
    sum.seconds += row.seconds;
    sum.cost += row.cost;
    sum.failed.push(...row.failed);
  };
  const cell = (pair: [number, number]) => `${pair[0]}/${pair[1]}`.padEnd(7);
  const print = (label: string, row: Row, packCount = 1) =>
    console.log(
      `${label.padEnd(26)} ${row.config.padEnd(row.config.startsWith("brief ") ? 74 : 38)} pf ${cell(row.pf)} q ${cell(row.q)} dl ${cell(row.dl)} all ${cell(row.all)} wrong ${String(row.wrong).padEnd(3)} cites ${cell(row.cites)} (${Math.round((row.cites[0] / Math.max(1, row.cites[1])) * 100)}%) notfound ${String(row.notFound).padEnd(3)} fig ${String(row.figure).padEnd(2)} ${String(Math.round(row.seconds / packCount)).padStart(4)}s $${(row.cost / packCount).toFixed(3)}${row.failed.length ? ` FAILED: ${row.failed.join(",")}` : ""}`,
    );

  for (const slug of packs) {
    const facts = (JSON.parse(readFileSync(path.join(spikeDir, "groundtruth", `${slug}.json`), "utf8")) as { facts: ScoreFact[] }).facts;
    const { index } = await loadPack(slug);
    const readings: Reading[] = models
      .filter((model) => TASKS.every((task) => existsSync(fileOf(slug, model, task))))
      .map((model) => ({ model, parts: Object.fromEntries(TASKS.map((task) => [task, JSON.parse(readFileSync(fileOf(slug, model, task), "utf8")) as Stored])) as Record<Task, Stored> }));

    // `briefFrom` set: the brief (overview) is read by that model alone and the lists by the members.
    const score = (config: string, members: Reading[], briefFrom?: Reading): Row => {
      const lead = briefFrom ?? members[0]!;
      const overview = (lead.parts.overview.value ?? {}) as Record<string, unknown>;
      const requirements = dedupeRequirements(members.flatMap((member) => ((member.parts.requirements.value?.requirements as never[]) ?? []) as Array<{ requirement: string; threshold: string | null; quote: string | null }>));
      const questions = dedupeQuestions(members.flatMap((member) => ((member.parts.questions.value?.questions as never[]) ?? []) as Array<{ id: string; title: string; text: string; quote: string | null }>));
      const evaluation = (overview.evaluation ?? {}) as ScoreResult["evaluation"];
      const result: ScoreResult = {
        summary: (overview.summary ?? {}) as ScoreResult["summary"],
        key_dates: (overview.key_dates ?? []) as never[],
        requirements: requirements as never[],
        questions: questions as never[],
        documents_to_return: (overview.documents_to_return ?? []) as never[],
        red_flags: (overview.red_flags ?? []) as never[],
        unknowns: (overview.unknowns ?? []) as never[],
        evaluation: { ...evaluation, criteria: evaluation.criteria ?? [], scoring_scale: evaluation.scoring_scale ?? [], minimum_thresholds: evaluation.minimum_thresholds ?? [] },
      };
      const table = summarise(scoreBrief(facts, result));
      const pick = (category: string): [number, number] => [table[category]?.correct ?? 0, table[category]?.total ?? 0];
      const all = Object.values(table).reduce<[number, number]>((sum, row) => [sum[0] + row.correct, sum[1] + row.total], [0, 0]);
      const wrong = Object.values(table).reduce((sum, row) => sum + row.wrong, 0);
      // Citations, checked by program exactly as the product does.
      let verified = 0;
      let cited = 0;
      let notFound = 0;
      let figure = 0;
      for (const raw of requirements as never[]) {
        const draft = toRequirement(index, raw);
        if (!draft.citation) continue;
        cited += 1;
        if (draft.citation.verified) verified += 1;
        else if (draft.citation.issue === "figure_not_in_source") figure += 1;
        else notFound += 1;
      }
      for (const raw of [...(questions as never[]), ...result.key_dates, ...Object.values(result.summary)] as Array<{ file?: string | null; loc?: string | null; quote?: string | null }>) {
        if (!raw?.quote) continue;
        cited += 1;
        if (verifyCitation(index, { file: raw.file, loc: raw.loc, quote: raw.quote }).verified) verified += 1;
        else notFound += 1;
      }
      const stored = briefFrom
        ? [{ member: briefFrom, task: "overview" as Task, part: briefFrom.parts.overview }, ...members.flatMap((member) => (["requirements", "questions"] as Task[]).map((task) => ({ member, task, part: member.parts[task] })))]
        : members.flatMap((member) => TASKS.map((task) => ({ member, task, part: member.parts[task] })));
      return {
        config,
        pf: pick("pass_fail"),
        q: pick("question"),
        dl: pick("deadline"),
        all,
        wrong,
        cites: [verified, cited],
        notFound,
        figure,
        // Readings run in parallel: the slowest one is the wall-clock time.
        seconds: Math.max(...stored.map((entry) => entry.part.ms)) / 1000,
        cost: stored.reduce((sum, entry) => sum + (entry.part.usage?.costUsd ?? 0), 0),
        failed: stored.filter((entry) => entry.part.error).map((entry) => `${short(entry.member.model)}:${entry.task}`),
      };
    };

    for (const reading of readings) {
      const row = score(short(reading.model), [reading]);
      print(slug, row);
      add(row);
    }
    for (let i = 0; i < readings.length; i += 1) {
      for (let j = i + 1; j < readings.length; j += 1) {
        const row = score(`${short(readings[i]!.model)} + ${short(readings[j]!.model)}`, [readings[i]!, readings[j]!]);
        print(slug, row);
        add(row);
      }
    }
    // Brief by a third model, lists by a pair.
    for (const brief of readings) {
      for (let i = 0; i < readings.length; i += 1) {
        for (let j = i + 1; j < readings.length; j += 1) {
          if (readings[i] === brief || readings[j] === brief) continue;
          add(score(`brief ${short(brief.model)} | lists ${short(readings[i]!.model)} + ${short(readings[j]!.model)}`, [readings[i]!, readings[j]!], brief));
        }
      }
    }
    console.log("");
  }
  console.log(`TOTAL over ${packs.length} pack(s): recall summed, time and cost averaged per pack`);
  for (const row of totals.values()) print("TOTAL", row, packs.length);
}

async function main() {
  const packs = (packsArg ?? "").split(",").filter(Boolean);
  const models = (modelsArg ?? "").split(",").filter(Boolean);
  if ((mode !== "extract" && mode !== "report") || packs.length === 0 || models.length === 0) throw new Error("usage: model-eval.ts extract|report <pack,pack> <model,model>");
  if (mode === "extract") await extract(packs, models);
  else await report(packs, models);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
