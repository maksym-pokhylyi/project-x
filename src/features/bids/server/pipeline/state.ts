import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bids } from "@/db/schema";
import { PIPELINE_STEPS, STEP_STAGE, type PipelineStep, type ProcessingStage, type ProcessingState, type StepState } from "@/features/bids/types";

export type BidRow = typeof bids.$inferSelect;

/** A failure retrying will not fix; `message` is shown to the user as is. */
export class PermanentPipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentPipelineError";
  }
}

/** A worker holding the lock longer than this is assumed dead (function maxDuration is 300 s). */
export const LOCK_TTL_SECONDS = 330;

const STEP_WEIGHT: Record<PipelineStep, number> = { extract: 20, overview: 12, requirements: 20, questions: 14, documents: 8, recheck: 14, company: 9, finalise: 3 };

export async function loadBidRow(bidId: string): Promise<BidRow | null> {
  const [row] = await db.select().from(bids).where(eq(bids.id, bidId));
  return row ?? null;
}

/**
 * Takes the per-bid processing lock for this run. Returns the bid, or null when the bid is
 * gone, not processing, on another run, or another live worker holds the lock.
 */
export async function claimBid(bidId: string, runId: string): Promise<BidRow | null> {
  const rows = await db
    .update(bids)
    .set({ processingLockAt: new Date() })
    .where(
      and(
        eq(bids.id, bidId),
        eq(bids.status, "processing"),
        sql`${bids.processingState} ->> 'runId' = ${runId}`,
        sql`(${bids.processingLockAt} is null or ${bids.processingLockAt} < now() - make_interval(secs => ${LOCK_TTL_SECONDS}::int))`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function releaseBid(bidId: string): Promise<void> {
  await db.update(bids).set({ processingLockAt: null }).where(eq(bids.id, bidId));
}

/** Heartbeat for long steps so the lock does not look stale while work is still going on. */
export async function touchBid(bidId: string): Promise<void> {
  await db.update(bids).set({ processingLockAt: new Date() }).where(eq(bids.id, bidId));
}

export function stepState(state: ProcessingState | null | undefined, step: PipelineStep): StepState {
  return state?.steps?.[step] ?? { status: "pending" };
}

export function isStepDone(state: ProcessingState | null | undefined, step: PipelineStep): boolean {
  return stepState(state, step).status === "done";
}

export function computeProgress(state: ProcessingState | null | undefined): { progress: number; stage: ProcessingStage | "done" } {
  let progress = 0;
  let stage: ProcessingStage | "done" = "done";
  let stageFound = false;
  for (const step of PIPELINE_STEPS) {
    const status = stepState(state, step).status;
    if (status === "done") progress += STEP_WEIGHT[step];
    else {
      if (status === "running") progress += STEP_WEIGHT[step] * 0.3;
      if (!stageFound) {
        stage = STEP_STAGE[step];
        stageFound = true;
      }
    }
  }
  return { progress: Math.min(100, Math.round(progress)), stage };
}

/**
 * Merges `patch` into one step's state with a single atomic UPDATE (steps of the same
 * phase run in parallel, so read-modify-write of the whole JSON would lose updates), then
 * refreshes the denormalised stage + progress columns.
 */
export async function setStepState(bidId: string, step: PipelineStep, patch: Partial<StepState>): Promise<void> {
  const path = `{steps,${step}}`;
  const rows = await db
    .update(bids)
    .set({
      processingState: sql`jsonb_set(
        coalesce(${bids.processingState}, '{"steps":{}}'::jsonb),
        ${path}::text[],
        coalesce(${bids.processingState} #> ${path}::text[], '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb,
        true
      )`,
      updatedAt: new Date(),
    })
    .where(eq(bids.id, bidId))
    .returning({ state: bids.processingState });
  const state = rows[0]?.state;
  if (!state) return;
  const { progress, stage } = computeProgress(state);
  await db
    .update(bids)
    .set({ processingStage: stage, processingProgress: sql`greatest(${bids.processingProgress}, ${progress})` })
    .where(eq(bids.id, bidId));
}

export async function markStepRunning(bidId: string, step: PipelineStep, attempts: number): Promise<void> {
  await setStepState(bidId, step, { status: "running", startedAt: new Date().toISOString(), attempts });
}

export async function markStepDone(bidId: string, step: PipelineStep, extra: Partial<StepState> = {}): Promise<void> {
  await setStepState(bidId, step, { status: "done", finishedAt: new Date().toISOString(), ...extra });
}

/** A fresh processing state for a (re)started run, keeping the steps that already finished. */
export function nextRunState(previous: ProcessingState | null | undefined, runId: string): ProcessingState {
  const steps: ProcessingState["steps"] = {};
  for (const step of PIPELINE_STEPS) {
    const state = previous?.steps?.[step];
    if (state?.status === "done") steps[step] = state;
  }
  return { runId, steps };
}
