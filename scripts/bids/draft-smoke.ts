/**
 * Drafting + evaluation part of the live smoke test (see live-smoke.ts --draft).
 * Adds a small evidence library for a clearly fictional bidder, simulates a paid plan,
 * drafts one answer, marks it, applies the suggestions and prints what happened.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

type Ctx = Parameters<typeof import("../../src/features/bids/server/bids").getBid>[0];

const CASE_STUDY = `Case study: Bus shelter replacement programme for Durham Parish Councils Group

Client: Durham Parish Councils Group (contact: Clerk to the Group). Contract value £86,400. Delivered March to June 2025.
Example Facilities Ltd removed 14 life-expired bus shelters and installed 14 new cantilever shelters across six villages, including new concrete foundations, perch seating and polycarbonate roof panels.
All 14 sites were completed in 11 weeks against a 12-week programme. Works were carried out under Chapter 8 traffic management by our own NRSWA-accredited operatives; no footway was closed for more than one working day.
98% of removed materials by weight were recycled through a licensed waste carrier (waste transfer notes kept for each site).
There were no reportable accidents (RIDDOR) on the programme. The client's post-completion inspection recorded two minor snags, both fixed within five working days.
A 12-month defects period applied; one roof panel was replaced under warranty within 48 hours of being reported.`;

const HS_POLICY = `Example Facilities Ltd — Health and Safety Policy (reviewed January 2026, next review January 2027)

Signed by the Managing Director. The company employs 18 people.
The Operations Manager holds NEBOSH National General Certificate and is the appointed competent person.
All site operatives hold CSCS cards; supervisors hold SMSTS. Operatives working on the highway hold NRSWA Streetworks accreditation.
Risk assessments and method statements (RAMS) are prepared for every site before work starts and briefed to the team each morning.
Accidents and near misses are recorded in the company accident book and reviewed monthly by the Managing Director. There have been no RIDDOR-reportable incidents in the last three years.
The company holds CHAS accreditation (valid to 31 March 2027).`;

export async function runDraftSmoke(options: { ctx: Ctx; bidId: string; organizationId: string }): Promise<void> {
  const { ctx, bidId, organizationId } = options;
  const { db } = await import("../../src/db");
  const { libraryDocs } = await import("../../src/db/schema");
  const { storage } = await import("../../src/lib/storage");
  const { runWorker } = await import("../../src/lib/jobs/worker");
  const { eq } = await import("drizzle-orm");
  const docsApi = await import("../../src/features/library/server/docs");
  const bidsApi = await import("../../src/features/bids/server/bids");
  const drafting = await import("../../src/features/bids/server/drafting");
  const { countWords } = await import("../../src/features/bids/constants");
  void readFile;
  void path;

  console.log("\n== Drafting and evaluation ==");
  process.env.BIDS_SIMULATE_PLAN = "bid_desk";
  for (const [name, text] of [
    ["Case study - Durham bus shelters.txt", CASE_STUDY],
    ["Health and Safety Policy.txt", HS_POLICY],
  ] as const) {
    const bytes = new TextEncoder().encode(text);
    const plan = await docsApi.planLibraryUpload(ctx, { name, size: bytes.byteLength });
    await storage.put(plan.storageKey, bytes, { contentType: plan.contentType });
    await docsApi.registerLibraryDoc(ctx, { docId: plan.docId, name });
  }
  await runWorker({ maxJobs: 10, timeBudgetMs: 240_000 });
  const docs = await db.select().from(libraryDocs).where(eq(libraryDocs.organizationId, organizationId));
  for (const doc of docs) console.log(`  library: ${doc.title} [${doc.status}, ${doc.kind}] ${doc.summary?.slice(0, 110) ?? doc.error ?? ""}`);

  await bidsApi.unlockFullBid(ctx, bidId);
  const questions = await bidsApi.listQuestions(ctx, bidId);
  const target = questions.find((question) => /method|programme|quality|site management/i.test(`${question.title} ${question.text}`)) ?? questions[0]!;
  // A word limit makes the limit enforcement observable (this pack states none).
  await bidsApi.updateQuestion(ctx, bidId, target.id, { wordLimit: 300 });
  console.log(`  question: ${target.ref} ${target.title ?? ""} — limit set to 300 words for the test`);

  let started = Date.now();
  const drafted = await drafting.draftAnswer(ctx, bidId, target.id, {});
  const meta = drafted.question.draftMeta!;
  console.log(`  draft: ${countWords(drafted.question.draftText ?? "")} words (limit 300), ${meta.evidenceRefs.length} sources cited, ${meta.evidenceGaps.length} evidence gaps, ${meta.flaggedClaims.length} flagged claims, trimmed=${meta.trimmedToLimit}, ${Math.round((Date.now() - started) / 1000)}s, $${drafted.usage.costUsd.toFixed(4)} (${meta.model})`);
  console.log(`  gaps: ${meta.evidenceGaps.slice(0, 5).join(" | ")}`);
  for (const flag of meta.flaggedClaims.slice(0, 5)) console.log(`  flagged: "${flag.claim.slice(0, 90)}" — ${flag.reason.slice(0, 110)}`);
  console.log(`  --- draft text ---\n${(drafted.question.draftText ?? "").slice(0, 1400)}\n  ---`);

  started = Date.now();
  const evaluated = await drafting.evaluateAnswer(ctx, bidId, target.id);
  const evaluation = evaluated.question.evaluation!;
  console.log(`  evaluation: ${evaluation.score}/${evaluation.maxScore} (${evaluation.band ?? "-"}, ${evaluation.scale} scale), ${evaluation.improvements.length} improvements, ${Math.round((Date.now() - started) / 1000)}s, $${evaluated.usage.costUsd.toFixed(4)}`);
  console.log(`  rationale: ${evaluation.rationale.slice(0, 300)}`);
  for (const [index, improvement] of evaluation.improvements.slice(0, 4).entries()) console.log(`  ${index + 1}. [${improvement.impact}${improvement.needsEvidence ? ", needs evidence" : ""}] ${improvement.suggestion.slice(0, 160)}`);

  if (evaluation.improvements.length > 0) {
    started = Date.now();
    const revised = await drafting.applySuggestions(ctx, bidId, target.id, { indexes: [0] });
    console.log(`  apply suggestion 1: ${countWords(revised.question.draftText ?? "")} words, versions kept: ${revised.question.versions.length}, ${Math.round((Date.now() - started) / 1000)}s, $${revised.usage.costUsd.toFixed(4)}`);
  }
  await db.delete(libraryDocs).where(eq(libraryDocs.organizationId, organizationId));
}
