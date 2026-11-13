import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { libraryDocs } from "@/db/schema";
import { getBidAccess, getBidCapabilities } from "@/features/bids/access";
import { AnswerEditor } from "@/features/bids/components/answer-editor";
import { DEFAULT_SCALE } from "@/features/bids/server/drafting";
import { factsConfirmed, loadBidPage } from "@/features/bids/server/page-data";
import { editorKey, toEditorQuestion } from "@/features/bids/view";

export const metadata: Metadata = { title: "Answer" };
export const dynamic = "force-dynamic";
// Drafting + claims check, marking and revising run as Server Actions from this page.
export const maxDuration = 300;

export default async function AnswerPage({ params }: { params: Promise<{ bidId: string; questionId: string }> }) {
  const { bidId, questionId } = await params;
  const { ctx, bid, questions } = await loadBidPage(bidId);
  const index = questions.findIndex((question) => question.id === questionId);
  if (index < 0) notFound();
  const question = questions[index]!;
  const [capabilities, access, confirmed, [docs]] = await Promise.all([
    getBidCapabilities(ctx.organization.id, bid),
    getBidAccess(ctx.organization.id),
    factsConfirmed(ctx.organization.id),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(libraryDocs)
      .where(and(eq(libraryDocs.organizationId, ctx.organization.id), eq(libraryDocs.status, "ready"))),
  ]);
  const packScale = (question.scoringDescriptors?.length ? question.scoringDescriptors : (bid.evaluationModel?.scoringScale ?? [])).filter((row) => row.score.trim() !== "");
  const usePack = packScale.length >= 2;
  const locked = bid.status === "archived" ? ("archived" as const) : bid.status !== "ready" ? ("not_ready" as const) : capabilities.drafting ? null : (capabilities.lockedReason ?? "check_only");
  const base = `/app/bids/${bid.id}/questions`;
  const previous = questions[index - 1];
  const next = questions[index + 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-sm">
        <Link href={base} className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline">
          <ChevronLeft aria-hidden className="size-3.5" />
          All questions
        </Link>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="tabular-nums">
            {index + 1} of {questions.length}
          </span>
          {previous ? (
            <Link href={`${base}/${previous.id}`} aria-label="Previous question" className="rounded border p-1 hover:text-foreground">
              <ChevronLeft aria-hidden className="size-4" />
            </Link>
          ) : null}
          {next ? (
            <Link href={`${base}/${next.id}`} aria-label="Next question" className="rounded border p-1 hover:text-foreground">
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          ) : null}
        </div>
      </div>
      <AnswerEditor
        bidId={bid.id}
        key={editorKey(question)}
        question={toEditorQuestion(question)}
        scale={usePack ? packScale.map((row) => ({ score: row.score, label: row.label, descriptor: row.descriptor })) : DEFAULT_SCALE}
        scaleKind={usePack ? "pack" : "default"}
        links={{ kind: "app", bidId: bid.id }}
        locked={locked}
        canUnlock={bid.accessLevel !== "full" && (access.bidPasses > 0 || access.drafting)}
        library={{ factsConfirmed: confirmed, documents: docs?.count ?? 0 }}
      />
    </div>
  );
}
