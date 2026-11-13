/**
 * Seeds the public sample behind /sample-check: one finished bid owned by a designated demo
 * organisation, loaded from the committed snapshot (src/features/bids/sample/sample-check.json).
 *
 *   pnpm tsx --import ./scripts/register-server-only.mjs scripts/seed-sample-check.ts
 *
 * Idempotent: running it again replaces the sample bid and nothing else. Safe to run against
 * production (DATABASE_URL decides the target; no model calls, no uploads, no users created).
 * The demo organisation has no members, so nobody can sign in to it; the page reads it
 * directly. The tender data are the buyer's published documents; the bidder is fictional.
 */
import { randomUUID } from "node:crypto";
import { loadEnv } from "./load-env.mjs";

loadEnv();

async function main() {
  const { db, pg } = await import("../src/db");
  const { bidFiles, bidQuestions, bidRequirements, bids, companyFacts, organizations } = await import("../src/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const { SAMPLE_NOTICE_ID, SAMPLE_ORG_ID, SAMPLE_ORG_SLUG, sampleSnapshot } = await import("../src/features/bids/sample/load");

  const bidId = randomUUID();
  // Fresh file ids on every run; citations in every JSON field are remapped to them.
  const fileIds = new Map(sampleSnapshot.files.map((file) => [file.id, randomUUID()]));
  const remap = <T>(value: T): T => {
    let text = JSON.stringify(value);
    for (const [from, to] of fileIds) text = text.replaceAll(from, to);
    return JSON.parse(text) as T;
  };
  const snapshot = remap(sampleSnapshot);
  const key = (fileId: string, kind: string) => `org/${SAMPLE_ORG_ID}/bids/${bidId}/src/${fileId}.${kind}`;

  await db.transaction(async (tx) => {
    await tx
      .insert(organizations)
      .values({ id: SAMPLE_ORG_ID, name: `${snapshot.bidder.name} (sample)`, slug: SAMPLE_ORG_SLUG, createdAt: new Date() })
      .onConflictDoNothing();
    await tx
      .insert(companyFacts)
      .values({ organizationId: SAMPLE_ORG_ID, facts: snapshot.bidder.facts, confirmedAt: new Date() })
      .onConflictDoUpdate({ target: companyFacts.organizationId, set: { facts: snapshot.bidder.facts, confirmedAt: new Date(), updatedAt: new Date() } });
    // Replace the previous sample (files, requirements and questions go with it).
    await tx.delete(bids).where(and(eq(bids.organizationId, SAMPLE_ORG_ID), eq(bids.noticeId, SAMPLE_NOTICE_ID)));

    await tx.insert(bids).values({
      id: bidId,
      organizationId: SAMPLE_ORG_ID,
      noticeId: SAMPLE_NOTICE_ID,
      title: snapshot.bid.title,
      buyerName: snapshot.bid.buyerName,
      reference: snapshot.bid.reference,
      status: "ready",
      accessLevel: "full",
      accessSource: "credit",
      processingStage: "done",
      processingProgress: 100,
      submissionDeadline: snapshot.bid.submissionDeadline ? new Date(snapshot.bid.submissionDeadline) : null,
      keyDates: snapshot.bid.keyDates,
      brief: snapshot.bid.brief,
      verdict: snapshot.bid.verdict,
      evaluationModel: snapshot.bid.evaluationModel,
      packStats: snapshot.bid.packStats,
      readyAt: snapshot.bid.readyAt ? new Date(snapshot.bid.readyAt) : new Date(),
    });
    if (snapshot.files.length > 0) {
      await tx.insert(bidFiles).values(
        snapshot.files.map((file) => ({
          ...file,
          organizationId: SAMPLE_ORG_ID,
          bidId,
          // The buyer's files are not copied: the page links to where the buyer published them.
          storageKey: key(file.id, file.kind),
          textStorageKey: null,
        })),
      );
    }
    if (snapshot.requirements.length > 0) {
      await tx.insert(bidRequirements).values(snapshot.requirements.map((row) => ({ ...row, organizationId: SAMPLE_ORG_ID, bidId })));
    }
    if (snapshot.questions.length > 0) {
      await tx.insert(bidQuestions).values(snapshot.questions.map(({ sample: _sample, ...row }) => ({ ...row, organizationId: SAMPLE_ORG_ID, bidId, versions: [] })));
    }
  });

  console.log(`[seed-sample-check] seeded bid ${bidId} in ${SAMPLE_ORG_ID}: ${snapshot.requirements.length} requirements, ${snapshot.questions.length} questions, ${snapshot.files.length} files`);
  await pg.end({ timeout: 5 });
}

main().catch((error) => {
  console.error("[seed-sample-check] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
