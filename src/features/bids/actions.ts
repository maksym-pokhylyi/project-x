"use server";

import { revalidatePath } from "next/cache";
import { storageBackend } from "@/lib/storage";
import { runAction, type ActionResult } from "@/server/http";
import { requireOrg } from "@/server/session";
import * as bids from "./server/bids";
import { applySuggestions, draftAnswer, evaluateAnswer, restoreVersion, saveAnswer } from "./server/drafting";
import { runCompanyCheck } from "./server/pipeline/step-company";

/**
 * Server Actions of the bid desk. Each one resolves the workspace from the session
 * (`requireOrg`) and passes that context to the data layer — ids coming from the browser
 * are only ever looked up inside the caller's own workspace.
 */

function refresh(bidId: string): void {
  revalidatePath(`/app/bids/${bidId}`, "layout");
  revalidatePath("/app/bids");
}

export async function createBidAction(input: { title?: string; noticeId?: string }): Promise<ActionResult<{ bidId: string }>> {
  return runAction("bids.create", async () => {
    const ctx = await requireOrg({ write: true });
    const bid = await bids.createBid(ctx, input);
    return { bidId: bid.id };
  });
}

export type UploadTarget = { fileId: string; pathname: string; contentType: string; mode: "blob" | "direct"; directUrl: string };

/** Validates a file before upload and says where the browser should send the bytes. */
export async function planUploadAction(bidId: string, file: { name: string; size: number }): Promise<ActionResult<UploadTarget>> {
  return runAction("bids.plan_upload", async () => {
    const ctx = await requireOrg({ write: true });
    const plan = await bids.planBidUpload(ctx, bidId, file);
    return {
      fileId: plan.fileId,
      pathname: plan.storageKey,
      contentType: plan.contentType,
      mode: storageBackend === "vercel-blob" ? ("blob" as const) : ("direct" as const),
      directUrl: `/api/bids/${bidId}/upload?fileId=${plan.fileId}&name=${encodeURIComponent(file.name)}`,
    };
  });
}

export async function registerFileAction(bidId: string, input: { fileId: string; name: string }): Promise<ActionResult<{ id: string; name: string; size: number; kind: string }>> {
  return runAction("bids.register_file", async () => {
    const ctx = await requireOrg({ write: true });
    const file = await bids.registerBidFile(ctx, bidId, input);
    return { id: file.id, name: file.name, size: file.size, kind: file.kind };
  });
}

export async function removeFileAction(bidId: string, fileId: string): Promise<ActionResult> {
  return runAction("bids.remove_file", async () => {
    const ctx = await requireOrg({ write: true });
    await bids.removeBidFile(ctx, bidId, fileId);
    return undefined;
  });
}

export async function startProcessingAction(bidId: string): Promise<ActionResult<{ bidId: string }>> {
  return runAction("bids.start", async () => {
    const ctx = await requireOrg({ write: true });
    const bid = await bids.startBidProcessing(ctx, bidId);
    refresh(bid.id);
    return { bidId: bid.id };
  });
}

export async function retryProcessingAction(bidId: string): Promise<ActionResult> {
  return runAction("bids.retry", async () => {
    const ctx = await requireOrg({ write: true });
    await bids.retryBidProcessing(ctx, bidId);
    refresh(bidId);
    return undefined;
  });
}

export async function updateBidAction(bidId: string, input: { title?: string; buyerName?: string | null; reference?: string | null; noticeId?: string | null }): Promise<ActionResult> {
  return runAction("bids.update", async () => {
    const ctx = await requireOrg({ write: true });
    await bids.updateBid(ctx, bidId, input);
    refresh(bidId);
    return undefined;
  });
}

export async function setBidArchivedAction(bidId: string, archived: boolean): Promise<ActionResult> {
  return runAction("bids.archive", async () => {
    const ctx = await requireOrg({ write: true });
    await bids.setBidArchived(ctx, bidId, archived);
    refresh(bidId);
    return undefined;
  });
}

export async function deleteBidAction(bidId: string): Promise<ActionResult> {
  return runAction("bids.delete", async () => {
    const ctx = await requireOrg();
    await bids.deleteBid(ctx, bidId);
    revalidatePath("/app/bids");
    return undefined;
  });
}

export async function unlockFullBidAction(bidId: string): Promise<ActionResult> {
  return runAction("bids.unlock", async () => {
    const ctx = await requireOrg({ write: true });
    await bids.unlockFullBid(ctx, bidId);
    refresh(bidId);
    return undefined;
  });
}

// --- Requirements -----------------------------------------------------------------------

export async function addRequirementAction(bidId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("bids.requirement.add", async () => {
    const ctx = await requireOrg({ write: true });
    const row = await bids.addRequirement(ctx, bidId, input);
    refresh(bidId);
    return { id: row.id };
  });
}

export async function updateRequirementAction(bidId: string, requirementId: string, input: unknown): Promise<ActionResult> {
  return runAction("bids.requirement.update", async () => {
    const ctx = await requireOrg({ write: true });
    await bids.updateRequirement(ctx, bidId, requirementId, input);
    refresh(bidId);
    return undefined;
  });
}

export async function deleteRequirementAction(bidId: string, requirementId: string): Promise<ActionResult> {
  return runAction("bids.requirement.delete", async () => {
    const ctx = await requireOrg({ write: true });
    await bids.deleteRequirement(ctx, bidId, requirementId);
    refresh(bidId);
    return undefined;
  });
}

export async function setRequirementCheckedAction(bidId: string, requirementId: string, checked: boolean): Promise<ActionResult> {
  return runAction("bids.requirement.check", async () => {
    const ctx = await requireOrg({ write: true });
    await bids.setRequirementChecked(ctx, bidId, requirementId, checked);
    refresh(bidId);
    return undefined;
  });
}

export async function setFactConfirmedAction(bidId: string, field: string, confirmed: boolean): Promise<ActionResult> {
  return runAction("bids.fact.confirm", async () => {
    const ctx = await requireOrg({ write: true });
    await bids.setFactConfirmed(ctx, bidId, field, confirmed);
    refresh(bidId);
    return undefined;
  });
}

/** Re-runs the comparison with company facts (after the facts or the requirements changed). */
export async function recheckCompanyAction(bidId: string): Promise<ActionResult<{ verdict: string }>> {
  return runAction("bids.company_check", async () => {
    const ctx = await requireOrg({ write: true });
    const bid = await bids.getBid(ctx, bidId);
    const outcome = await runCompanyCheck(ctx.organization.id, bid.id, ctx.user.id);
    refresh(bidId);
    return { verdict: outcome.verdict.verdict };
  });
}

// --- Questions --------------------------------------------------------------------------

export async function addQuestionAction(bidId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("bids.question.add", async () => {
    const ctx = await requireOrg({ write: true });
    const row = await bids.addQuestion(ctx, bidId, input);
    refresh(bidId);
    return { id: row.id };
  });
}

export async function updateQuestionAction(bidId: string, questionId: string, input: unknown): Promise<ActionResult> {
  return runAction("bids.question.update", async () => {
    const ctx = await requireOrg({ write: true });
    await bids.updateQuestion(ctx, bidId, questionId, input);
    refresh(bidId);
    return undefined;
  });
}

export async function deleteQuestionAction(bidId: string, questionId: string): Promise<ActionResult> {
  return runAction("bids.question.delete", async () => {
    const ctx = await requireOrg({ write: true });
    await bids.deleteQuestion(ctx, bidId, questionId);
    refresh(bidId);
    return undefined;
  });
}

export async function setQuestionStatusAction(bidId: string, questionId: string, status: string): Promise<ActionResult> {
  return runAction("bids.question.status", async () => {
    const ctx = await requireOrg({ write: true });
    await bids.setQuestionStatus(ctx, bidId, questionId, status);
    refresh(bidId);
    return undefined;
  });
}

// --- Answers ----------------------------------------------------------------------------

export async function draftAnswerAction(bidId: string, questionId: string, input: { instructions?: string } = {}): Promise<ActionResult<{ libraryEmpty: boolean }>> {
  return runAction("bids.answer.draft", async () => {
    const ctx = await requireOrg({ write: true });
    const outcome = await draftAnswer(ctx, bidId, questionId, input);
    refresh(bidId);
    return { libraryEmpty: outcome.libraryEmpty };
  });
}

export async function saveAnswerAction(bidId: string, questionId: string, text: string): Promise<ActionResult<{ savedAt: string }>> {
  return runAction("bids.answer.save", async () => {
    const ctx = await requireOrg({ write: true });
    await saveAnswer(ctx, bidId, questionId, { text });
    return { savedAt: new Date().toISOString() };
  });
}

export async function evaluateAnswerAction(bidId: string, questionId: string): Promise<ActionResult> {
  return runAction("bids.answer.evaluate", async () => {
    const ctx = await requireOrg({ write: true });
    await evaluateAnswer(ctx, bidId, questionId);
    refresh(bidId);
    return undefined;
  });
}

export async function applySuggestionsAction(bidId: string, questionId: string, indexes: number[]): Promise<ActionResult> {
  return runAction("bids.answer.apply", async () => {
    const ctx = await requireOrg({ write: true });
    await applySuggestions(ctx, bidId, questionId, { indexes });
    refresh(bidId);
    return undefined;
  });
}

export async function restoreVersionAction(bidId: string, questionId: string, versionId: string): Promise<ActionResult> {
  return runAction("bids.answer.restore", async () => {
    const ctx = await requireOrg({ write: true });
    await restoreVersion(ctx, bidId, questionId, versionId);
    refresh(bidId);
    return undefined;
  });
}
