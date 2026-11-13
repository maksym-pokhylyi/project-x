import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bidFiles, bidQuestions, bidRequirements, bids } from "@/db/schema";
import type { EditorSource } from "@/features/bids/components/answer-editor";
import type { BidBrief, BidKeyDate, BidVerdict, CompanyFacts, EvaluationModel, PackStats } from "@/features/bids/types";
import { log } from "@/lib/logger";
import snapshotJson from "./sample-check.json";

/**
 * The public sample at /sample-check.
 *
 * It is a normal bid owned by a designated demo organisation, loaded into the database by
 * `scripts/seed-sample-check.ts` from the committed snapshot (./sample-check.json — a real
 * run of the pipeline on a pack the buyer published; the bidder is fictional). Until the
 * seed has run — or when the database cannot be reached at build time — the same snapshot
 * is rendered directly, so the page never depends on the seed having happened.
 */

export const SAMPLE_ORG_ID = "org_bidfolio_sample_check";
export const SAMPLE_ORG_SLUG = "bidfolio-sample-check";
/** Marks the sample bid inside the demo organisation (`bids.notice_id`). */
export const SAMPLE_NOTICE_ID = "sample-check";

type FileRow = typeof bidFiles.$inferSelect;
type RequirementRow = typeof bidRequirements.$inferSelect;
type QuestionRow = typeof bidQuestions.$inferSelect;

export type SampleSnapshot = {
  exportedAt: string;
  source: { buyer: string; title: string; noticeUrl: string; documentsPage: string; retrieved: string; files: Array<{ name: string; url: string }> } | null;
  bidder: { name: string; fictional: boolean; facts: CompanyFacts; libraryDocuments: number };
  bid: {
    title: string;
    buyerName: string | null;
    reference: string | null;
    submissionDeadline: string | null;
    keyDates: BidKeyDate[] | null;
    brief: BidBrief | null;
    verdict: BidVerdict | null;
    evaluationModel: EvaluationModel | null;
    packStats: PackStats | null;
    readyAt: string | null;
  };
  files: Array<Pick<FileRow, "id" | "parentFileId" | "name" | "mime" | "kind" | "size" | "pages" | "extractionStatus" | "lowText" | "transcribedPages" | "charCount" | "tokenCount" | "includedInAnalysis" | "error" | "sortOrder">>;
  requirements: Array<Pick<RequirementRow, "ref" | "category" | "text" | "threshold" | "kind" | "isPassFail" | "evidenceToProvide" | "citation" | "companyStatus" | "companyNote" | "provenance" | "source" | "sortOrder">>;
  questions: Array<
    Pick<QuestionRow, "ref" | "title" | "text" | "section" | "weighting" | "maxScore" | "wordLimit" | "pageLimit" | "limitText" | "guidance" | "scored" | "scoringDescriptors" | "citation" | "provenance" | "source" | "sortOrder" | "status" | "draftText" | "draftMeta" | "evaluation"> & {
      sample: boolean;
    }
  >;
  sampleAnswer: { sources: EditorSource[]; draftedToWords: number | null } | null;
};

export const sampleSnapshot = snapshotJson as unknown as SampleSnapshot;

export type SampleCheck = {
  fromDatabase: boolean;
  source: NonNullable<SampleSnapshot["source"]>;
  bidderName: string;
  bid: { id: string; title: string; buyerName: string | null; submissionDeadline: Date | null; keyDates: BidKeyDate[]; brief: BidBrief | null; verdict: BidVerdict | null; evaluationModel: EvaluationModel | null; packStats: PackStats | null; readyAt: Date | null };
  files: FileRow[];
  requirements: RequirementRow[];
  questions: QuestionRow[];
  /** The one question shown with its draft and marking. */
  sampleQuestion: QuestionRow | null;
  sources: EditorSource[];
  draftedToWords: number | null;
  /** Where the buyer published each file, by file id. */
  fileUrls: Record<string, string>;
};

function fromSnapshot(): Omit<SampleCheck, "source" | "bidderName" | "sources" | "draftedToWords" | "fileUrls" | "sampleQuestion"> {
  const snapshot = sampleSnapshot;
  const now = new Date(snapshot.exportedAt);
  return {
    fromDatabase: false,
    bid: {
      id: "sample",
      title: snapshot.bid.title,
      buyerName: snapshot.bid.buyerName,
      submissionDeadline: snapshot.bid.submissionDeadline ? new Date(snapshot.bid.submissionDeadline) : null,
      keyDates: snapshot.bid.keyDates ?? [],
      brief: snapshot.bid.brief,
      verdict: snapshot.bid.verdict,
      evaluationModel: snapshot.bid.evaluationModel,
      packStats: snapshot.bid.packStats,
      readyAt: snapshot.bid.readyAt ? new Date(snapshot.bid.readyAt) : null,
    },
    files: snapshot.files.map((file) => ({ ...file, organizationId: SAMPLE_ORG_ID, bidId: "sample", storageKey: "", textStorageKey: null, createdAt: now, updatedAt: now })) as unknown as FileRow[],
    requirements: snapshot.requirements.map((row, index) => ({ ...row, id: `sample-requirement-${index + 1}`, companyStatusSource: "ai", note: null, checkedAt: null, checkedBy: null, userEdited: false })) as unknown as RequirementRow[],
    questions: snapshot.questions.map((row, index) => ({ ...row, id: `sample-question-${index + 1}`, versions: [], userEdited: false })) as unknown as QuestionRow[],
  };
}

async function fromDatabase(): Promise<ReturnType<typeof fromSnapshot> | null> {
  const [bid] = await db
    .select()
    .from(bids)
    .where(and(eq(bids.organizationId, SAMPLE_ORG_ID), eq(bids.noticeId, SAMPLE_NOTICE_ID), eq(bids.status, "ready")))
    .orderBy(desc(bids.createdAt))
    .limit(1);
  if (!bid) return null;
  const scoped = <T extends { organizationId: unknown; bidId: unknown }>(table: T) => and(eq(table.organizationId as never, SAMPLE_ORG_ID), eq(table.bidId as never, bid.id));
  const [files, requirements, questions] = await Promise.all([
    db.select().from(bidFiles).where(scoped(bidFiles)).orderBy(asc(bidFiles.sortOrder)),
    db.select().from(bidRequirements).where(scoped(bidRequirements)).orderBy(asc(bidRequirements.sortOrder)),
    db.select().from(bidQuestions).where(scoped(bidQuestions)).orderBy(asc(bidQuestions.sortOrder)),
  ]);
  return {
    fromDatabase: true,
    bid: { id: bid.id, title: bid.title, buyerName: bid.buyerName, submissionDeadline: bid.submissionDeadline, keyDates: bid.keyDates ?? [], brief: bid.brief, verdict: bid.verdict, evaluationModel: bid.evaluationModel, packStats: bid.packStats, readyAt: bid.readyAt },
    files,
    requirements,
    questions,
  };
}

/** Loads the sample: the seeded demo bid when it exists, the committed snapshot otherwise. */
export async function loadSampleCheck(): Promise<SampleCheck | null> {
  const snapshot = sampleSnapshot;
  if (!snapshot.source) return null;
  let data: ReturnType<typeof fromSnapshot> | null = null;
  try {
    data = await fromDatabase();
  } catch (error) {
    // No table yet, or no database at build time: the snapshot is the same content.
    log.warn("sample-check: database not available, rendering the committed snapshot", { reason: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
  }
  data ??= fromSnapshot();
  const urlByName = new Map(snapshot.source.files.map((file) => [file.name, file.url]));
  const fileUrls = Object.fromEntries(data.files.flatMap((file) => (urlByName.has(file.name) ? [[file.id, urlByName.get(file.name)!]] : [])));
  return {
    ...data,
    source: snapshot.source,
    bidderName: snapshot.bidder.name,
    sampleQuestion: data.questions.find((question) => question.draftText?.trim()) ?? null,
    sources: snapshot.sampleAnswer?.sources ?? [],
    draftedToWords: snapshot.sampleAnswer?.draftedToWords ?? null,
    fileUrls,
  };
}
