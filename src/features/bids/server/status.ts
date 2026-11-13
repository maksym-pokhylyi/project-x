import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bidFiles, bidQuestions, bidRequirements } from "@/db/schema";
import { PIPELINE_STEPS, PROCESSING_STAGES, STEP_STAGE, type ProcessingStage } from "@/features/bids/types";
import { kickWorker } from "@/lib/jobs/worker";
import type { BidRow, Scope } from "./bids";
import { enqueueBidJob } from "./pipeline/dispatch";
import { LOCK_TTL_SECONDS } from "./pipeline/state";

export type StageStatus = "pending" | "running" | "done" | "failed";

export type BidStatus = {
  status: string;
  stage: string | null;
  progress: number;
  stages: Array<{ stage: ProcessingStage; status: StageStatus; note: string | null }>;
  failure: { step: string; stage: ProcessingStage; message: string; retryable: boolean } | null;
  counts: { files: number; filesRead: number; requirements: number; passFail: number; questions: number };
  startedAt: string | null;
  readyAt: string | null;
  /** Changes whenever anything visible changed: the client refreshes the page on it. */
  version: string;
};

/**
 * Processing status of one bid, read entirely from the database (so a refresh, another
 * tab or another device shows the same thing). `bid` must already have been loaded
 * through the caller's workspace scope.
 */
export async function getBidStatus(ctx: Scope, bid: BidRow): Promise<BidStatus> {
  const [[files], [requirements], [questions]] = await Promise.all([
    db
      .select({ total: sql<number>`count(*) filter (where ${bidFiles.kind} <> 'zip')::int`, read: sql<number>`count(*) filter (where ${bidFiles.kind} <> 'zip' and ${bidFiles.extractionStatus} in ('done', 'failed', 'skipped'))::int` })
      .from(bidFiles)
      .where(and(eq(bidFiles.bidId, bid.id), eq(bidFiles.organizationId, ctx.organization.id))),
    db
      .select({ total: sql<number>`count(*)::int`, passFail: sql<number>`count(*) filter (where ${bidRequirements.isPassFail})::int` })
      .from(bidRequirements)
      .where(and(eq(bidRequirements.bidId, bid.id), eq(bidRequirements.organizationId, ctx.organization.id))),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(bidQuestions)
      .where(and(eq(bidQuestions.bidId, bid.id), eq(bidQuestions.organizationId, ctx.organization.id))),
  ]);
  const state = bid.processingState;
  const stages = PROCESSING_STAGES.map((stage) => {
    const steps = PIPELINE_STEPS.filter((step) => STEP_STAGE[step] === stage).map((step) => state?.steps?.[step] ?? { status: "pending" as const });
    const status: StageStatus = steps.some((step) => step.status === "failed")
      ? "failed"
      : steps.every((step) => step.status === "done")
        ? "done"
        : steps.some((step) => step.status === "running" || step.status === "done")
          ? "running"
          : "pending";
    const note = status === "done" ? null : (steps.map((step) => step.error).find((error): error is string => Boolean(error)) ?? null);
    return { stage, status, note };
  });
  const counts = { files: files?.total ?? 0, filesRead: files?.read ?? 0, requirements: requirements?.total ?? 0, passFail: requirements?.passFail ?? 0, questions: questions?.total ?? 0 };
  return {
    status: bid.status,
    stage: bid.processingStage,
    progress: bid.processingProgress,
    stages,
    failure: bid.status === "failed" ? (state?.failure ?? null) : null,
    counts,
    startedAt: bid.processingStartedAt?.toISOString() ?? null,
    readyAt: bid.readyAt?.toISOString() ?? null,
    version: `${bid.status}:${bid.processingProgress}:${counts.requirements}:${counts.questions}:${counts.filesRead}:${bid.brief ? 1 : 0}:${bid.verdict ? 1 : 0}`,
  };
}

const IDLE_BEFORE_WATCHDOG_MS = 25_000;

/**
 * Watchdog, run while someone is watching a processing bid: if no worker has touched it
 * for a while (a lost nudge, a crashed function), queue and start another run. Steps are
 * idempotent and finished ones are never repeated, so an extra run is harmless.
 */
export async function reviveStalledBid(bid: BidRow): Promise<boolean> {
  const runId = bid.processingState?.runId;
  if (bid.status !== "processing" || !runId) return false;
  const lockAge = bid.processingLockAt ? Date.now() - bid.processingLockAt.getTime() : Infinity;
  const lockFree = !bid.processingLockAt || lockAge > LOCK_TTL_SECONDS * 1000;
  const idle = Date.now() - bid.updatedAt.getTime();
  if (!lockFree || idle < IDLE_BEFORE_WATCHDOG_MS) return false;
  await enqueueBidJob(bid.id, runId, `watchdog:${Math.floor(Date.now() / 30_000)}`);
  kickWorker();
  return true;
}
