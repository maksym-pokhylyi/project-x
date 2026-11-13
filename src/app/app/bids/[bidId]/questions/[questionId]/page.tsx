import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { companyFacts, libraryDocs } from "@/db/schema";
import { getBidAccess, getBidCapabilities } from "@/features/bids/access";
import { effectiveWordLimit } from "@/features/bids/answer-text";
import { AnswerEditor, type EditorNavItem, type EditorSource } from "@/features/bids/components/answer-editor";
import { countWords } from "@/features/bids/constants";
import { DEFAULT_SCALE, renderCompanyFacts } from "@/features/bids/server/drafting";
import { loadBidPage } from "@/features/bids/server/page-data";
import { LIBRARY_DOC_KIND_LABELS, type LibraryDocKind, type QuestionStatus } from "@/features/bids/types";
import { editorKey, isScoredQuestion, toEditorQuestion } from "@/features/bids/view";

export const metadata: Metadata = { title: "Answer" };
export const dynamic = "force-dynamic";
// Drafting + claims check, marking and revising run as Server Actions from this page.
export const maxDuration = 300;

/** Answer editor: one question, its draft and the evaluator's view (outside the workspace tabs). */
export default async function AnswerPage({ params }: { params: Promise<{ bidId: string; questionId: string }> }) {
  const { bidId, questionId } = await params;
  const { ctx, bid, questions } = await loadBidPage(bidId);
  const question = questions.find((item) => item.id === questionId);
  if (!question) notFound();

  const refs = question.draftMeta?.evidenceRefs ?? [];
  const docIds = refs.flatMap((ref) => (ref.docId ? [ref.docId] : []));
  const [capabilities, access, [factsRow], [docCount], docs] = await Promise.all([
    getBidCapabilities(ctx.organization.id, bid),
    getBidAccess(ctx.organization.id),
    db.select().from(companyFacts).where(eq(companyFacts.organizationId, ctx.organization.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(libraryDocs)
      .where(and(eq(libraryDocs.organizationId, ctx.organization.id), eq(libraryDocs.status, "ready"))),
    docIds.length > 0
      ? db
          .select()
          .from(libraryDocs)
          .where(and(eq(libraryDocs.organizationId, ctx.organization.id), inArray(libraryDocs.id, docIds)))
      : Promise.resolve([]),
  ]);

  const packScale = (question.scoringDescriptors?.length ? question.scoringDescriptors : (bid.evaluationModel?.scoringScale ?? [])).filter((row) => row.score.trim() !== "");
  const usePack = packScale.length >= 2;
  const locked = bid.status === "archived" ? ("archived" as const) : bid.status !== "ready" ? ("not_ready" as const) : capabilities.drafting ? null : (capabilities.lockedReason ?? "check_only");
  const base = `/app/bids/${bid.id}`;

  // The list on the left: the scored written answers, plus this question if it is a form or declaration.
  const listed = questions.filter((item) => isScoredQuestion(item) || item.id === question.id);
  const items: EditorNavItem[] = listed.map((item) => ({
    id: item.id,
    ref: item.ref,
    title: item.title ?? item.text.slice(0, 80),
    weighting: item.weighting,
    wordCount: countWords(item.draftText ?? ""),
    limit: effectiveWordLimit(item).limit,
    status: item.status as QuestionStatus,
    gaps: item.draftMeta?.evidenceGaps.length ?? 0,
    score: item.evaluation?.score ?? null,
    href: `${base}/questions/${item.id}`,
  }));
  const index = listed.findIndex((item) => item.id === question.id);

  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  const sources: EditorSource[] = refs.map((ref) => {
    if (ref.source === "company_facts") {
      return { marker: ref.marker, title: "Company facts", detail: factsRow?.confirmedAt ? "Confirmed by you in Documents" : "Documents", passage: factsRow ? renderCompanyFacts(factsRow.facts) : null };
    }
    const doc = ref.docId ? byId.get(ref.docId) : undefined;
    const facts = doc?.keyFacts?.facts ?? [];
    return {
      marker: ref.marker,
      title: doc?.fileName ?? ref.title,
      detail: doc ? (LIBRARY_DOC_KIND_LABELS[doc.kind as LibraryDocKind] ?? "Document") : "No longer in your documents",
      passage: doc ? [doc.summary, ...facts.slice(0, 6).map((fact) => `• ${fact}`)].filter(Boolean).join("\n") || null : null,
    };
  });

  return (
    <AnswerEditor
      bidId={bid.id}
      key={editorKey(question)}
      question={toEditorQuestion(question)}
      scale={usePack ? packScale : DEFAULT_SCALE}
      scaleKind={usePack ? "pack" : "default"}
      links={{ kind: "app", bidId: bid.id }}
      locked={locked}
      canUnlock={bid.accessLevel !== "full" && (access.bidPasses > 0 || access.drafting)}
      library={{ factsConfirmed: Boolean(factsRow?.confirmedAt), documents: docCount?.count ?? 0 }}
      bid={{
        title: bid.title,
        buyerName: bid.buyerName,
        deadline: bid.submissionDeadline ? bid.submissionDeadline.toISOString() : null,
        briefHref: base,
        exportHref: capabilities.exportAnswers ? `/api/bids/${bid.id}/export/answers` : null,
      }}
      nav={{
        items,
        qualityWeight: bid.evaluationModel?.qualityWeight ?? null,
        previousHref: index > 0 ? items[index - 1]!.href : null,
        nextHref: index >= 0 && index < items.length - 1 ? items[index + 1]!.href : null,
      }}
      sources={sources}
    />
  );
}
