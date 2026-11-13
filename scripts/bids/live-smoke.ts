/**
 * Live smoke test: runs ONE real tender pack through the whole pipeline with real models
 * and prints accuracy against the spike's hand-written ground truth.
 *
 *   NODE_USE_ENV_PROXY=1 pnpm tsx --import ./scripts/register-server-only.mjs scripts/bids/live-smoke.ts [slug] [--draft] [--keep]
 *
 *   slug     pack under $BIDS_SPIKE_DIR/packs (default blyth-bus-shelters)
 *   --draft  also draft + evaluate one answer (needs the evidence fixture; costs a little more)
 *   --keep   keep the bid and workspace in the database afterwards (default: delete)
 *
 * Uses the local database from .env.local and the gateway token in $BIDS_GATEWAY_ENV_FILE
 * (default /home/user/vtest/.env.local; the token is never printed). Costs real money:
 * roughly $0.02–0.10 per pack with the default models. Prints the spend it recorded.
 */
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "../load-env.mjs";
import { scoreBrief, summarise, type ScoreFact, type ScoreResult } from "./score";

loadEnv();
const gatewayEnv = process.env.BIDS_GATEWAY_ENV_FILE ?? "/home/user/vtest/.env.local";
if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN && existsSync(gatewayEnv)) {
  for (const line of readFileSync(gatewayEnv, "utf8").split("\n")) {
    const match = /^(VERCEL_OIDC_TOKEN|AI_GATEWAY_API_KEY)=(.*)$/.exec(line.trim());
    if (match) process.env[match[1]!] = match[2]!.replace(/^"|"$/g, "");
  }
}

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const slug = args.find((arg) => !arg.startsWith("--")) ?? "blyth-bus-shelters";
const spikeDir = process.env.BIDS_SPIKE_DIR ?? "/home/user/spikes/bid-pack";

const pct = (part: number, whole: number) => (whole === 0 ? "n/a" : `${Math.round((part / whole) * 100)}%`);

async function main() {
  const packDir = path.join(spikeDir, "packs", slug, "files");
  const truthPath = path.join(spikeDir, "groundtruth", `${slug}.json`);
  if (!existsSync(packDir)) throw new Error(`Pack not found: ${packDir}`);

  // Imported lazily: these modules validate env at import time.
  const { eq, and, gte, sql } = await import("drizzle-orm");
  const { db, pg } = await import("../../src/db");
  const { aiUsage, bidCredits, bidQuestions, bidRequirements, bids, companyFacts, organizations, users, members } = await import("../../src/db/schema");
  const { storage } = await import("../../src/lib/storage");
  const { runWorker } = await import("../../src/lib/jobs/worker");
  const bidsApi = await import("../../src/features/bids/server/bids");
  const { unsupportedFileReason } = await import("../../src/features/bids/constants");
  const { modelIdsFor } = await import("../../src/features/bids/server/ai/models");
  const { KIND_TO_RAW } = await import("../../src/features/bids/server/pipeline/transform");

  const stamp = Date.now().toString(36);
  const organizationId = `smoke_${stamp}`;
  const userId = `smoke_user_${stamp}`;
  await db.insert(users).values({ id: userId, name: "Smoke Test", email: `smoke-${stamp}@example.com`, emailVerified: true });
  await db.insert(organizations).values({ id: organizationId, name: "Example Facilities Ltd", slug: `smoke-${stamp}`, createdAt: new Date() });
  await db.insert(members).values({ id: `smoke_member_${stamp}`, organizationId, userId, role: "owner", createdAt: new Date() });
  // Confirmed company facts for a clearly fictional bidder, so the company check has something to compare.
  await db.insert(companyFacts).values({
    organizationId,
    confirmedAt: new Date(),
    confirmedBy: userId,
    facts: {
      legalName: "Example Facilities Ltd",
      companyNumber: "01234567",
      turnoverBand: "1m_2m",
      employees: 18,
      yearsTrading: 12,
      insurance: {
        publicLiability: { amountGbp: 5_000_000, expiresAt: "2027-06-30" },
        employersLiability: { amountGbp: 10_000_000, expiresAt: "2027-06-30" },
        professionalIndemnity: { amountGbp: 1_000_000, expiresAt: "2027-06-30" },
      },
      accreditations: [
        { name: "ISO 9001:2015", reference: "FS 000000", expiresAt: "2027-09-30" },
        { name: "CHAS", reference: null, expiresAt: "2027-03-31" },
      ],
      sectors: ["Local government", "Street furniture"],
      regions: ["North East England"],
      policies: ["Health and Safety Policy", "Environmental Policy", "Equality and Diversity Policy"],
      notes: null,
    },
  });
  const ctx = { organization: { id: organizationId }, user: { id: userId } } as unknown as Parameters<typeof bidsApi.createBid>[0];

  console.log(`\n== Live smoke: ${slug} ==`);
  console.log(`models: extract=${modelIdsFor("extract").primary} verify=${modelIdsFor("verify").primary} company=${modelIdsFor("company").primary}`);
  const started = Date.now();
  const bid = await bidsApi.createBid(ctx, {});
  let uploaded = 0;
  for (const name of (await readdir(packDir)).sort()) {
    if (name.startsWith(".")) continue;
    const reason = unsupportedFileReason(name);
    if (reason) {
      console.log(`  skipped ${name}: ${reason}`);
      continue;
    }
    const bytes = new Uint8Array(await readFile(path.join(packDir, name)));
    const plan = await bidsApi.planBidUpload(ctx, bid.id, { name, size: bytes.byteLength });
    await storage.put(plan.storageKey, bytes, { contentType: plan.contentType });
    await bidsApi.registerBidFile(ctx, bid.id, { fileId: plan.fileId, name });
    uploaded += 1;
  }
  console.log(`  uploaded ${uploaded} files`);

  await bidsApi.startBidProcessing(ctx, bid.id);
  let current = await bidsApi.getBid(ctx, bid.id);
  for (let round = 0; round < 40 && current.status === "processing"; round += 1) {
    const summary = await runWorker({ maxJobs: 20, timeBudgetMs: 600_000 });
    current = await bidsApi.getBid(ctx, bid.id);
    if (current.status === "processing" && summary.claimed === 0) await new Promise((resolve) => setTimeout(resolve, 5_000)); // a retry is backing off
    const steps = Object.entries(current.processingState?.steps ?? {}).map(([step, state]) => `${step}:${state.status}`);
    console.log(`  [${Math.round((Date.now() - started) / 1000)}s] ${current.status} ${current.processingProgress}% ${steps.join(" ")}`);
  }
  const seconds = Math.round((Date.now() - started) / 1000);

  const [requirements, questions, files] = await Promise.all([bidsApi.listRequirements(ctx, bid.id), bidsApi.listQuestions(ctx, bid.id), bidsApi.listBidFiles(ctx, bid.id)]);
  const [spend] = await db
    .select({ cost: sql<string>`coalesce(sum(${aiUsage.costUsd}), 0)`, input: sql<string>`coalesce(sum(${aiUsage.inputTokens}), 0)`, output: sql<string>`coalesce(sum(${aiUsage.outputTokens}), 0)`, calls: sql<string>`count(*)` })
    .from(aiUsage)
    .where(and(eq(aiUsage.organizationId, organizationId), gte(aiUsage.createdAt, new Date(started))));

  console.log(`\nstatus: ${current.status}${current.processingState?.failure ? ` — FAILED at ${current.processingState.failure.step}: ${current.processingState.failure.message}` : ""}`);
  console.log(`files: ${files.map((file) => `${file.name} [${file.extractionStatus}, ${file.pages ?? 0} units, ${file.tokenCount} tok${file.error ? `, ${file.error}` : ""}]`).join("\n       ")}`);
  console.log(`pack: ${current.packStats?.tokens ?? 0} tokens, ${current.packStats?.pages ?? 0} pages/sections; warnings: ${JSON.stringify(current.packStats?.warnings ?? [])}`);
  console.log(`time: ${seconds}s   cost: $${Number(spend?.cost ?? 0).toFixed(4)} (${spend?.calls} calls, ${spend?.input} in / ${spend?.output} out tokens)`);
  console.log(`models used: ${JSON.stringify(current.packStats?.models ?? {})}`);
  console.log(`deadline: ${current.submissionDeadline?.toISOString() ?? "not stated"} (${current.brief?.summary.submission_deadline.value ?? "-"})`);
  console.log(`requirements: ${requirements.length} (${requirements.filter((row) => row.isPassFail).length} pass/fail, ${requirements.filter((row) => row.source === "ai_recheck").length} from second pass)`);
  console.log(`questions: ${questions.length} (${questions.filter((row) => row.source === "ai_recheck").length} from second pass)`);
  console.log(`verdict: ${current.verdict?.verdict ?? "-"} ${JSON.stringify(current.verdict?.counts ?? {})}`);

  const cited = [
    ...requirements.map((row) => ({ kind: "requirement", label: row.ref, citation: row.citation })),
    ...questions.map((row) => ({ kind: "question", label: row.ref || row.title || "?", citation: row.citation })),
    ...Object.entries(current.brief?.summary ?? {}).filter(([, fact]) => fact.status !== "not_stated").map(([field, fact]) => ({ kind: "summary", label: field, citation: fact.citation })),
    ...(current.keyDates ?? []).map((item) => ({ kind: "date", label: item.event, citation: item.citation })),
    ...(current.brief?.redFlags ?? []).map((item) => ({ kind: "red_flag", label: item.type, citation: item.citation })),
    ...(current.brief?.documentsToReturn ?? []).map((item) => ({ kind: "document", label: item.name, citation: item.citation })),
    ...(current.evaluationModel?.criteria ?? []).map((item) => ({ kind: "criterion", label: item.name, citation: item.citation })),
  ];
  const verified = cited.filter((item) => item.citation?.verified);
  const byMatch: Record<string, number> = {};
  for (const item of cited) byMatch[item.citation?.match ?? "missing"] = (byMatch[item.citation?.match ?? "missing"] ?? 0) + 1;
  console.log(`citations: ${verified.length}/${cited.length} verified (${pct(verified.length, cited.length)}) ${JSON.stringify(byMatch)}`);
  const requirementCites = requirements.filter((row) => row.citation?.verified).length;
  console.log(`  requirements with a verified quote: ${requirementCites}/${requirements.length} (${pct(requirementCites, requirements.length)})`);
  for (const item of cited.filter((entry) => !entry.citation?.verified).slice(0, 8)) {
    console.log(`  UNVERIFIED ${item.kind} ${item.label}: ${item.citation ? `${item.citation.match}${item.citation.issue ? `/${item.citation.issue}` : ""} "${item.citation.quote.slice(0, 90)}"` : "no citation"}`);
  }

  if (existsSync(truthPath) && current.brief) {
    const facts = (JSON.parse(readFileSync(truthPath, "utf8")) as { facts: ScoreFact[] }).facts;
    const rawFact = (fact: { value: string | null; normalized: string | null; status: string; note: string | null; citation: { quote: string } | null }) => ({
      value: fact.value,
      normalized: fact.normalized,
      status: fact.status,
      note: fact.note,
      quote: fact.citation?.quote ?? null,
    });
    const evaluation = current.evaluationModel;
    const result: ScoreResult = {
      summary: Object.fromEntries(Object.entries(current.brief.summary).map(([field, fact]) => [field, rawFact(fact)])),
      key_dates: (current.keyDates ?? []).map((item) => ({ event: item.event, date_iso: item.dateIso, time_24h: item.time, quote: item.citation?.quote ?? null })),
      requirements: requirements.map((row) => ({
        id: row.ref,
        category: row.category,
        requirement: row.text,
        threshold: row.threshold,
        kind: KIND_TO_RAW[row.kind as keyof typeof KIND_TO_RAW],
        evidence_to_provide: row.evidenceToProvide,
        quote: row.citation?.quote ?? null,
      })),
      questions: questions.map((row) => ({
        id: row.ref,
        title: row.title,
        text: row.text,
        section: row.section,
        guidance: row.guidance,
        weight_percent: row.weighting,
        max_score_points: row.maxScore,
        limit_text: row.limitText,
        limit_words: row.wordLimit,
        limit_pages: row.pageLimit,
        scored: row.scored,
        quote: row.citation?.quote ?? null,
      })),
      documents_to_return: current.brief.documentsToReturn.map((item) => ({ name: item.name, mandatory: item.mandatory, format_note: item.formatNote, quote: item.citation?.quote ?? null })),
      red_flags: current.brief.redFlags.map((item) => ({ type: item.type, description: item.description, severity: item.severity, quote: item.citation?.quote ?? null })),
      unknowns: current.brief.unknowns.map((item) => ({ item: item.item, why_it_matters: item.whyItMatters })),
      evaluation: {
        price_weight_percent: evaluation?.priceWeight ?? null,
        quality_weight_percent: evaluation?.qualityWeight ?? null,
        social_value_weight_percent: evaluation?.socialValueWeight ?? null,
        criteria: (evaluation?.criteria ?? []).map((item) => ({ name: item.name, weight_percent: item.weight, parent: item.parent, what_is_assessed: item.whatIsAssessed, quote: item.citation?.quote ?? null })),
        scoring_scale: (evaluation?.scoringScale ?? []).map((item) => ({ score: item.score, label: item.label, descriptor: item.descriptor })),
        minimum_thresholds: (evaluation?.minimumThresholds ?? []).map((item) => ({ description: item.description })),
        price_scoring_method: evaluation?.priceScoringMethod ? rawFact(evaluation.priceScoringMethod) : null,
      },
    };
    const outcomes = scoreBrief(facts, result);
    const table = summarise(outcomes);
    console.log(`\nACCURACY vs ground truth (${facts.length} facts)`);
    for (const [category, row] of Object.entries(table)) {
      console.log(`  ${category.padEnd(16)} ${row.correct}/${row.total} correct${row.wrong ? `, ${row.wrong} wrong` : ""}${row.missing ? `, ${row.missing} missing` : ""}${row.review ? `, ${row.review} review` : ""}`);
    }
    const recall = (categories: string[]) => {
      const rows = categories.map((category) => table[category]).filter((row): row is NonNullable<typeof row> => Boolean(row));
      const correct = rows.reduce((sum, row) => sum + row.correct, 0);
      const total = rows.reduce((sum, row) => sum + row.total, 0);
      return `${correct}/${total} (${pct(correct, total)})`;
    };
    console.log(`  => pass/fail recall: ${recall(["pass_fail", "mandatory_tech"])}   question recall: ${recall(["question"])}   deadlines: ${recall(["deadline"])}`);
    for (const outcome of outcomes.filter((entry) => entry.status !== "correct")) {
      console.log(`  ${outcome.status.toUpperCase().padEnd(8)} ${outcome.cat}/${outcome.id}: ${outcome.desc.slice(0, 90)}${outcome.why ? ` | ${outcome.why.slice(0, 120)}` : ""}`);
    }
  } else {
    console.log("\n(no ground truth for this pack, or the brief is missing)");
  }

  if (flags.has("--draft") && current.status === "ready" && questions.length > 0) {
    const { runDraftSmoke } = await import("./draft-smoke");
    await runDraftSmoke({ ctx, bidId: bid.id, organizationId });
  }

  if (!flags.has("--keep")) {
    await bidsApi.deleteBid(ctx, bid.id).catch(() => undefined);
    await db.delete(bidRequirements).where(eq(bidRequirements.organizationId, organizationId));
    await db.delete(bidQuestions).where(eq(bidQuestions.organizationId, organizationId));
    await db.delete(bidCredits).where(eq(bidCredits.organizationId, organizationId));
    await db.delete(bids).where(eq(bids.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, userId));
  } else {
    console.log(`\nkept: organization ${organizationId}, bid ${bid.id}`);
  }
  await pg.end({ timeout: 5 });
}

main().catch((error) => {
  console.error("smoke failed:", error instanceof Error ? error.stack : error);
  process.exit(1);
});
