/**
 * Writes the snapshot behind the public /sample-check page from a bid in the LOCAL database
 * (normally one kept by `live-smoke.ts <slug> --draft --keep`):
 *
 *   NODE_USE_ENV_PROXY=1 pnpm tsx --import ./scripts/register-server-only.mjs scripts/bids/export-sample.ts <bidId> [--recheck] [--evaluate]
 *
 *   --recheck   run the company check again first (one model call)
 *   --evaluate  mark the drafted sample answer again (one model call)
 *
 * The snapshot (src/features/bids/sample/sample-check.json) is committed; it is what
 * `scripts/seed-sample-check.ts` loads into the demo organisation. Everything about the
 * tender comes from the buyer's published pack; the bidder is fictional.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "../load-env.mjs";

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
const bidId = args.find((arg) => !arg.startsWith("--"));
const slug = process.env.BIDS_SAMPLE_SLUG ?? "blyth-bus-shelters";
const spikeDir = process.env.BIDS_SPIKE_DIR ?? "/home/user/spikes/bid-pack";

async function main() {
  if (!bidId) throw new Error("usage: export-sample.ts <bidId> [--recheck] [--evaluate]");
  const { db, pg } = await import("../../src/db");
  const { bidFiles, bidQuestions, bidRequirements, bids, companyFacts, libraryDocs } = await import("../../src/db/schema");
  const { asc, eq, inArray } = await import("drizzle-orm");
  const { splitCombinedMarkers, findEvidenceMarkers, findEvidenceGaps } = await import("../../src/features/bids/answer-text");
  const { countWords } = await import("../../src/features/bids/constants");
  const { renderCompanyFacts, evaluateAnswer } = await import("../../src/features/bids/server/drafting");
  const { runCompanyCheck } = await import("../../src/features/bids/server/pipeline/step-company");
  const { LIBRARY_DOC_KIND_LABELS } = await import("../../src/features/bids/types");

  let [bid] = await db.select().from(bids).where(eq(bids.id, bidId));
  if (!bid) throw new Error("bid not found");
  const scope = { organization: { id: bid.organizationId }, user: { id: bid.createdBy ?? "" } } as never;

  if (flags.has("--recheck")) {
    const outcome = await runCompanyCheck(bid.organizationId, bid.id, bid.createdBy);
    console.log(`company check: ${outcome.verdict.verdict} ${JSON.stringify(outcome.verdict.counts)} ($${outcome.usage.costUsd})`);
  }

  // The drafted answer: one marker per source, and the limit the PACK states (the smoke test sets its own).
  let [sample] = (await db.select().from(bidQuestions).where(eq(bidQuestions.bidId, bid.id)).orderBy(asc(bidQuestions.sortOrder))).filter((row) => row.draftText?.trim());
  if (sample) {
    const text = splitCombinedMarkers(sample.draftText!);
    if (text !== sample.draftText) {
      await db.update(bidQuestions).set({ draftText: text, evaluation: null }).where(eq(bidQuestions.id, sample.id));
    }
    if (flags.has("--evaluate") || !sample.evaluation) {
      if (!flags.has("--evaluate")) console.log("note: the sample answer has no marking; run with --evaluate to add one");
      else {
        process.env.BIDS_SIMULATE_PLAN ||= "bid_desk"; // the smoke workspace has no paid plan of its own
        const result = await evaluateAnswer(scope, bid.id, sample.id);
        console.log(`evaluation: ${result.question.evaluation?.score}/${result.question.evaluation?.maxScore} ($${result.usage.costUsd})`);
      }
    }
    [sample] = await db.select().from(bidQuestions).where(eq(bidQuestions.id, sample.id));
  }

  [bid] = await db.select().from(bids).where(eq(bids.id, bidId));
  const files = await db.select().from(bidFiles).where(eq(bidFiles.bidId, bid!.id)).orderBy(asc(bidFiles.sortOrder));
  const requirements = await db.select().from(bidRequirements).where(eq(bidRequirements.bidId, bid!.id)).orderBy(asc(bidRequirements.sortOrder));
  const questions = await db.select().from(bidQuestions).where(eq(bidQuestions.bidId, bid!.id)).orderBy(asc(bidQuestions.sortOrder));
  const [factsRow] = await db.select().from(companyFacts).where(eq(companyFacts.organizationId, bid!.organizationId));

  const refs = sample?.draftMeta?.evidenceRefs ?? [];
  const docIds = refs.flatMap((ref) => (ref.docId ? [ref.docId] : []));
  const docs = docIds.length > 0 ? await db.select().from(libraryDocs).where(inArray(libraryDocs.id, docIds)) : [];
  const used = sample?.draftText ? findEvidenceMarkers(sample.draftText) : [];
  const sources = refs
    .filter((ref) => used.includes(ref.marker))
    .map((ref) => {
      if (ref.source === "company_facts") return { marker: ref.marker, title: "Company facts", detail: "Confirmed by the bidder (fictional)", passage: factsRow ? renderCompanyFacts(factsRow.facts) : null };
      const doc = docs.find((item) => item.id === ref.docId);
      return {
        marker: ref.marker,
        title: doc?.fileName ?? ref.title,
        detail: doc ? `${LIBRARY_DOC_KIND_LABELS[doc.kind as keyof typeof LIBRARY_DOC_KIND_LABELS] ?? "Document"} (fictional)` : "Document",
        passage: doc ? [doc.summary, ...(doc.keyFacts?.facts ?? []).slice(0, 6).map((fact) => `• ${fact}`)].filter(Boolean).join("\n") : null,
      };
    });

  const sourcePath = path.join(spikeDir, "packs", slug, "source.json");
  const published = existsSync(sourcePath) ? (JSON.parse(readFileSync(sourcePath, "utf8")) as { buyer: string; title: string; notice_url: string; documents_page: string; retrieved: string; files: Array<{ file: string; url: string }> }) : null;

  const snapshot = {
    exportedAt: new Date().toISOString(),
    source: published
      ? { buyer: published.buyer, title: published.title, noticeUrl: published.notice_url, documentsPage: published.documents_page, retrieved: published.retrieved, files: published.files.map((file) => ({ name: file.file, url: file.url })) }
      : null,
    bidder: { name: "Example Facilities Ltd", fictional: true, facts: factsRow?.facts ?? {}, libraryDocuments: docs.length },
    bid: {
      title: bid!.title,
      buyerName: bid!.buyerName,
      reference: bid!.reference,
      submissionDeadline: bid!.submissionDeadline?.toISOString() ?? null,
      keyDates: bid!.keyDates,
      brief: bid!.brief,
      verdict: bid!.verdict,
      evaluationModel: bid!.evaluationModel,
      packStats: bid!.packStats,
      readyAt: bid!.readyAt?.toISOString() ?? null,
    },
    files: files.map((file) => ({
      id: file.id,
      parentFileId: file.parentFileId,
      name: file.name,
      mime: file.mime,
      kind: file.kind,
      size: file.size,
      pages: file.pages,
      extractionStatus: file.extractionStatus,
      lowText: file.lowText,
      transcribedPages: file.transcribedPages,
      charCount: file.charCount,
      tokenCount: file.tokenCount,
      includedInAnalysis: file.includedInAnalysis,
      error: file.error,
      sortOrder: file.sortOrder,
    })),
    requirements: requirements.map((row) => ({
      ref: row.ref,
      category: row.category,
      text: row.text,
      threshold: row.threshold,
      kind: row.kind,
      isPassFail: row.isPassFail,
      evidenceToProvide: row.evidenceToProvide,
      citation: row.citation,
      companyStatus: row.companyStatus,
      companyNote: row.companyNote,
      provenance: row.provenance,
      source: row.source,
      sortOrder: row.sortOrder,
    })),
    questions: questions.map((row) => {
      const isSample = row.id === sample?.id;
      const draftText = isSample ? row.draftText : null;
      return {
        ref: row.ref,
        title: row.title,
        text: row.text,
        section: row.section,
        weighting: row.weighting,
        maxScore: row.maxScore,
        // The smoke test gives the drafted question a 300-word limit of its own: not a fact of the pack.
        wordLimit: isSample && row.userEdited ? null : row.wordLimit,
        pageLimit: row.pageLimit,
        limitText: isSample && row.userEdited ? null : row.limitText,
        guidance: row.guidance,
        scored: row.scored,
        scoringDescriptors: row.scoringDescriptors,
        citation: row.citation,
        provenance: row.provenance,
        source: row.source === "user" ? "ai" : row.source,
        sortOrder: row.sortOrder,
        status: isSample ? "draft" : "not_started",
        draftText,
        draftMeta: isSample && row.draftMeta ? { ...row.draftMeta, evidenceGaps: findEvidenceGaps(draftText ?? ""), wordCount: countWords(draftText ?? "") } : null,
        evaluation: isSample ? row.evaluation : null,
        sample: isSample,
      };
    }),
    sampleAnswer: sample ? { sources, draftedToWords: sample.wordLimit } : null,
  };

  const target = path.resolve("src/features/bids/sample/sample-check.json");
  writeFileSync(target, `${JSON.stringify(snapshot, null, 1)}\n`);
  console.log(`wrote ${target}: ${snapshot.requirements.length} requirements, ${snapshot.questions.length} questions, ${snapshot.files.length} files, sample answer: ${sample ? "yes" : "no"}${sample?.evaluation ? " (marked)" : ""}`);
  await pg.end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
