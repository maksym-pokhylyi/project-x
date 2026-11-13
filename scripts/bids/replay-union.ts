/**
 * Replays the STORED model outputs of a bid (local storage) through the union, filters and
 * citation verification — no model calls, no spend. Use it to tune de-duplication and
 * noise filters against a real run:
 *
 *   pnpm tsx --import ./scripts/register-server-only.mjs scripts/bids/replay-union.ts <bidId> [--list]
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "../load-env.mjs";

loadEnv();

async function main() {
  const bidId = process.argv[2];
  if (!bidId) throw new Error("usage: replay-union.ts <bidId> [--list]");
  const list = process.argv.includes("--list");
  const { db, pg } = await import("../../src/db");
  const { bidFiles, bids } = await import("../../src/db/schema");
  const { eq, asc } = await import("drizzle-orm");
  const { readText } = await import("../../src/features/bids/server/store");
  const { buildPackIndex } = await import("../../src/features/bids/server/pipeline/quote-verify");
  const { toQuestion, toRequirement } = await import("../../src/features/bids/server/pipeline/transform");
  const { keepRequirement, mergeQuestionPass, mergeRequirementPass } = await import("../../src/features/bids/server/pipeline/union");
  const { classifyDocument } = await import("../../src/features/bids/server/pipeline/step-analyse");
  type ExistingRequirement = import("../../src/features/bids/server/pipeline/union").ExistingRequirement;
  type ExistingQuestion = import("../../src/features/bids/server/pipeline/union").ExistingQuestion;
  type PassId = import("../../src/features/bids/server/pipeline/union").PassId;

  const [bid] = await db.select().from(bids).where(eq(bids.id, bidId));
  if (!bid) throw new Error("bid not found");
  const files = await db.select().from(bidFiles).where(eq(bidFiles.bidId, bidId)).orderBy(asc(bidFiles.sortOrder));
  const index = buildPackIndex(await Promise.all(files.filter((file) => file.textStorageKey).map(async (file) => ({ id: file.id, name: file.name, units: await readText(file.textStorageKey) }))));
  const workDir = path.resolve(".data/storage/org", bid.organizationId, "bids", bid.id, "work");
  const names = readdirSync(workDir).filter((name) => name.endsWith(".json") && !name.endsWith(".meta.json"));
  const order = ["requirements-primary.json", "requirements-second.json", "questions-primary.json", "questions-second.json", ...names.filter((name) => name.startsWith("document-"))];

  let requirements: ExistingRequirement[] = [];
  let questions: ExistingQuestion[] = [];
  let counter = 0;
  for (const name of order) {
    if (!names.includes(name)) continue;
    const value = JSON.parse(readFileSync(path.join(workDir, name), "utf8")).value as { requirements?: never[]; questions?: never[] };
    const pass: PassId = name.includes("primary") ? "primary" : name.includes("second") ? "second" : "document";
    const file = files.find((entry) => name.includes(entry.id));
    const documentClass = file ? classifyDocument(file.name, "") : null;
    if (pass === "document" && (!documentClass || documentClass === "pricing")) {
      console.log(`${name}: skipped (${file?.name ?? "?"} would no longer get its own reading)`);
      continue;
    }
    if (value.requirements && !name.startsWith("questions")) {
      const drafts = value.requirements.map((raw) => toRequirement(index, raw));
      const kept = drafts.filter((draft) => keepRequirement(draft, { pass, documentClass }));
      const plan = mergeRequirementPass(requirements, kept, pass);
      for (const update of plan.updates) Object.assign(requirements.find((row) => row.id === update.id)!, update.patch);
      requirements = [...requirements, ...plan.inserts.map((draft) => ({ id: `r${(counter += 1)}`, ...draft, locked: false }))];
      console.log(`${name}${file ? ` (${file.name}, ${documentClass})` : ""}: ${drafts.length} requirements, ${drafts.length - kept.length} filtered, ${plan.inserts.length} added, ${plan.updates.length} merged`);
    }
    if (value.questions && !name.startsWith("requirements")) {
      const drafts = value.questions.map((raw) => toQuestion(index, raw));
      const plan = mergeQuestionPass(questions, drafts, pass);
      for (const update of plan.updates) Object.assign(questions.find((row) => row.id === update.id)!, update.patch);
      questions = [...questions, ...plan.inserts.map((draft) => ({ id: `q${(counter += 1)}`, ...draft, locked: false }))];
      console.log(`${name}${file ? ` (${file.name}, ${documentClass})` : ""}: ${drafts.length} questions, ${plan.inserts.length} added, ${plan.updates.length} merged`);
    }
  }
  const verified = requirements.filter((row) => row.citation?.verified).length;
  console.log(`\nRESULT: ${requirements.length} requirements (${requirements.filter((row) => row.isPassFail).length} pass/fail, ${verified} with a verified quote), ${questions.length} questions`);
  if (list) {
    for (const row of requirements) console.log(` R ${row.isPassFail ? "PF" : "  "} ${(row as unknown as { category: string }).category.padEnd(13)} [${row.provenance?.passes.join("+")}] ${row.text.slice(0, 110)}${row.threshold ? ` | ${row.threshold}` : ""}`);
    for (const row of questions) console.log(` Q ${(row.ref || "-").padEnd(8).slice(0, 8)} [${row.provenance?.passes.join("+")}] ${row.title ?? ""} ${(row as unknown as { scored: string }).scored}`);
  }
  await pg.end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
