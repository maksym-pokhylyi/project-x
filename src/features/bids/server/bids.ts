import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bidFiles, bidQuestions, bidRequirements, bids } from "@/db/schema";
import { consumeBidAllowance, consumeFullBid, UPGRADE_URL } from "@/features/bids/access";
import {
  FILE_KIND_MIME,
  fileKindFromName,
  MAX_BID_BYTES,
  MAX_BID_FILES,
  MAX_FILE_BYTES,
  unsupportedFileReason,
  type FileKind,
} from "@/features/bids/constants";
import {
  COMPANY_STATUSES,
  QUESTION_STATUSES,
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_KINDS,
  type ProcessingState,
} from "@/features/bids/types";
import { track } from "@/lib/analytics";
import { AppError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { storage } from "@/lib/storage";
import type { OrgContext } from "@/server/session";
import { enqueueBidJob, nudgeWorker } from "./pipeline/dispatch";
import { nextRunState } from "./pipeline/state";
import { bidSourceKey, deleteKeys } from "./store";

/**
 * Tenant-scoped data access for bids. Every function takes the caller's context first and
 * filters by `ctx.organization.id` — ids from URLs or forms are only ever looked up inside
 * the caller's workspace, so another workspace's bid is indistinguishable from a missing one.
 */
export type Scope = Pick<OrgContext, "organization" | "user">;

export type BidRow = typeof bids.$inferSelect;
export type BidFileRow = typeof bidFiles.$inferSelect;
export type RequirementRow = typeof bidRequirements.$inferSelect;
export type QuestionRow = typeof bidQuestions.$inferSelect;

function asUuid(value: unknown, what: string): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new NotFoundError(`${what} not found.`);
  return parsed.data;
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) (fieldErrors[issue.path.join(".") || "form"] ??= []).push(issue.message);
  throw new ValidationError("Please check the highlighted fields.", fieldErrors);
}

// --- Bids -------------------------------------------------------------------------------

export type BidListItem = BidRow & { requirementCount: number; questionCount: number; draftedCount: number; finalCount: number };

export async function listBids(ctx: Scope, options: { includeArchived?: boolean } = {}): Promise<BidListItem[]> {
  const rows = await db
    .select()
    .from(bids)
    .where(options.includeArchived ? eq(bids.organizationId, ctx.organization.id) : and(eq(bids.organizationId, ctx.organization.id), ne(bids.status, "archived")))
    .orderBy(desc(bids.createdAt));
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [requirementCounts, questionCounts] = await Promise.all([
    db
      .select({ bidId: bidRequirements.bidId, count: sql<number>`count(*)::int` })
      .from(bidRequirements)
      .where(and(eq(bidRequirements.organizationId, ctx.organization.id), inArray(bidRequirements.bidId, ids)))
      .groupBy(bidRequirements.bidId),
    db
      .select({
        bidId: bidQuestions.bidId,
        count: sql<number>`count(*)::int`,
        drafted: sql<number>`count(*) filter (where ${bidQuestions.status} <> 'not_started')::int`,
        final: sql<number>`count(*) filter (where ${bidQuestions.status} = 'final')::int`,
      })
      .from(bidQuestions)
      .where(and(eq(bidQuestions.organizationId, ctx.organization.id), inArray(bidQuestions.bidId, ids)))
      .groupBy(bidQuestions.bidId),
  ]);
  const requirementsById = new Map(requirementCounts.map((row) => [row.bidId, row.count]));
  const questionsById = new Map(questionCounts.map((row) => [row.bidId, row]));
  return rows.map((row) => ({
    ...row,
    requirementCount: requirementsById.get(row.id) ?? 0,
    questionCount: questionsById.get(row.id)?.count ?? 0,
    draftedCount: questionsById.get(row.id)?.drafted ?? 0,
    finalCount: questionsById.get(row.id)?.final ?? 0,
  }));
}

export async function getBid(ctx: Scope, bidId: string): Promise<BidRow> {
  const id = asUuid(bidId, "Bid");
  const [row] = await db.select().from(bids).where(and(eq(bids.id, id), eq(bids.organizationId, ctx.organization.id)));
  if (!row) throw new NotFoundError("Bid not found.");
  return row;
}

const createSchema = z.object({
  title: z.string().trim().max(200).optional(),
  noticeId: z
    .string()
    .trim()
    .max(200)
    .regex(/^[A-Za-z0-9._:\-/]+$/, "Invalid notice reference.")
    .optional(),
});

/** Creates an empty bid in `draft` (files are uploaded next). Costs nothing yet. */
export async function createBid(ctx: Scope, input: unknown = {}): Promise<BidRow> {
  const data = parse(createSchema, input);
  // Abandoned drafts must not pile up: allow a handful of open ones per workspace.
  const [open] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bids)
    .where(and(eq(bids.organizationId, ctx.organization.id), eq(bids.status, "draft")));
  if ((open?.count ?? 0) >= 20) throw new ConflictError("You have many unfinished uploads. Finish or delete some before starting another.");
  const [row] = await db
    .insert(bids)
    .values({
      organizationId: ctx.organization.id,
      title: data.title || "Untitled bid",
      noticeId: data.noticeId ?? null,
      status: "draft",
      createdBy: ctx.user.id,
    })
    .returning();
  return row!;
}

const updateBidSchema = z.object({
  title: z.string().trim().min(1, "Give the bid a title.").max(200).optional(),
  buyerName: z.string().trim().max(200).nullable().optional(),
  reference: z.string().trim().max(120).nullable().optional(),
});

export async function updateBid(ctx: Scope, bidId: string, input: unknown): Promise<BidRow> {
  const bid = await getBid(ctx, bidId);
  const data = parse(updateBidSchema, input);
  const [row] = await db
    .update(bids)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(bids.id, bid.id), eq(bids.organizationId, ctx.organization.id)))
    .returning();
  return row!;
}

export async function setBidArchived(ctx: Scope, bidId: string, archived: boolean): Promise<BidRow> {
  const bid = await getBid(ctx, bidId);
  if (archived && bid.status !== "ready" && bid.status !== "failed") throw new ConflictError("Only finished bids can be archived.");
  if (!archived && bid.status !== "archived") return bid;
  const [row] = await db
    .update(bids)
    .set({ status: archived ? "archived" : "ready", archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(bids.id, bid.id), eq(bids.organizationId, ctx.organization.id)))
    .returning();
  return row!;
}

/** Deletes a bid with its files, requirements and questions (stored objects included). */
export async function deleteBid(ctx: Scope, bidId: string): Promise<void> {
  const bid = await getBid(ctx, bidId);
  if (bid.status === "processing") throw new ConflictError("This bid is being analysed. Wait for it to finish before deleting it.");
  const files = await db.select().from(bidFiles).where(and(eq(bidFiles.bidId, bid.id), eq(bidFiles.organizationId, ctx.organization.id)));
  await db.delete(bids).where(and(eq(bids.id, bid.id), eq(bids.organizationId, ctx.organization.id)));
  await deleteKeys(files.flatMap((file) => [file.extractionStatus === "skipped" ? null : file.storageKey, file.textStorageKey]));
}

// --- Files ------------------------------------------------------------------------------

export async function listBidFiles(ctx: Scope, bidId: string): Promise<BidFileRow[]> {
  const bid = await getBid(ctx, bidId);
  return db
    .select()
    .from(bidFiles)
    .where(and(eq(bidFiles.bidId, bid.id), eq(bidFiles.organizationId, ctx.organization.id)))
    .orderBy(asc(bidFiles.sortOrder), asc(bidFiles.createdAt));
}

export async function getBidFile(ctx: Scope, bidId: string, fileId: string): Promise<BidFileRow> {
  const bid = await getBid(ctx, bidId);
  const id = asUuid(fileId, "File");
  const [row] = await db.select().from(bidFiles).where(and(eq(bidFiles.id, id), eq(bidFiles.bidId, bid.id), eq(bidFiles.organizationId, ctx.organization.id)));
  if (!row) throw new NotFoundError("File not found.");
  return row;
}

export type UploadPlan = { fileId: string; storageKey: string; kind: FileKind; contentType: string };

/**
 * Checks that `name`/`size` may be added to the bid and reserves an id + storage key for
 * the upload. Called before the browser sends the bytes (token route and dev upload route).
 */
export async function planBidUpload(ctx: Scope, bidId: string, input: { name: string; size: number }): Promise<UploadPlan> {
  const bid = await getBid(ctx, bidId);
  if (bid.status !== "draft") throw new ConflictError("Files can only be added before the pack is analysed. Start a new bid for a different pack.");
  const reason = unsupportedFileReason(input.name);
  if (reason) throw new ValidationError(reason);
  const kind = fileKindFromName(input.name)!;
  if (!Number.isFinite(input.size) || input.size <= 0) throw new ValidationError("This file is empty.");
  if (input.size > MAX_FILE_BYTES) throw new ValidationError("Files must be 50 MB or smaller. Split or compress this file.");
  const existing = await db
    .select({ size: bidFiles.size })
    .from(bidFiles)
    .where(and(eq(bidFiles.bidId, bid.id), eq(bidFiles.organizationId, ctx.organization.id)));
  if (existing.length >= MAX_BID_FILES) throw new ValidationError(`A bid holds at most ${MAX_BID_FILES} files.`);
  const total = existing.reduce((sum, file) => sum + file.size, 0);
  if (total + input.size > MAX_BID_BYTES) throw new ValidationError("A bid holds at most 200 MB of files. Remove a file or leave out drawings and photos.");
  const fileId = randomUUID();
  return { fileId, storageKey: bidSourceKey(ctx.organization.id, bid.id, fileId, kind), kind, contentType: FILE_KIND_MIME[kind] };
}

const registerFileSchema = z.object({ fileId: z.uuid(), name: z.string().trim().min(1).max(255) });

/**
 * Records a file whose bytes are already in storage at the key `planBidUpload` reserved.
 * The size is read from storage, never trusted from the browser.
 */
export async function registerBidFile(ctx: Scope, bidId: string, input: unknown): Promise<BidFileRow> {
  const bid = await getBid(ctx, bidId);
  if (bid.status !== "draft") throw new ConflictError("Files can only be added before the pack is analysed.");
  const data = parse(registerFileSchema, input);
  const kind = fileKindFromName(data.name);
  if (!kind) throw new ValidationError(unsupportedFileReason(data.name) ?? "This file type is not supported.");
  const storageKey = bidSourceKey(ctx.organization.id, bid.id, data.fileId, kind);
  const stored = await storage.get(storageKey);
  if (!stored) throw new ValidationError("The upload did not complete. Try again.");
  await stored.body.cancel().catch(() => undefined);
  const size = stored.size ?? 0;
  if (size <= 0) {
    await deleteKeys([storageKey]);
    throw new ValidationError("This file is empty.");
  }
  if (size > MAX_FILE_BYTES) {
    await deleteKeys([storageKey]);
    throw new ValidationError("Files must be 50 MB or smaller.");
  }
  const siblings = await db
    .select({ size: bidFiles.size, sortOrder: bidFiles.sortOrder })
    .from(bidFiles)
    .where(and(eq(bidFiles.bidId, bid.id), eq(bidFiles.organizationId, ctx.organization.id)));
  if (siblings.length >= MAX_BID_FILES || siblings.reduce((sum, file) => sum + file.size, 0) + size > MAX_BID_BYTES) {
    await deleteKeys([storageKey]);
    throw new ValidationError("This bid has reached its size limit (60 files, 200 MB).");
  }
  const [row] = await db
    .insert(bidFiles)
    .values({
      id: data.fileId,
      organizationId: ctx.organization.id,
      bidId: bid.id,
      storageKey,
      name: data.name,
      mime: FILE_KIND_MIME[kind],
      kind,
      size,
      sortOrder: siblings.reduce((max, file) => Math.max(max, file.sortOrder), 0) + 10,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new ConflictError("This file was already added.");
  return row;
}

export async function removeBidFile(ctx: Scope, bidId: string, fileId: string): Promise<void> {
  const bid = await getBid(ctx, bidId);
  if (bid.status !== "draft") throw new ConflictError("Files cannot be removed after the pack has been analysed.");
  const file = await getBidFile(ctx, bid.id, fileId);
  await db.delete(bidFiles).where(and(eq(bidFiles.id, file.id), eq(bidFiles.organizationId, ctx.organization.id)));
  await deleteKeys([file.storageKey, file.textStorageKey]);
}

// --- Processing -------------------------------------------------------------------------

export class AllowanceRequiredError extends AppError {
  constructor(message: string) {
    super("QUOTA_EXCEEDED", message, 402, { metric: "bids", upgradeUrl: UPGRADE_URL });
  }
}

/**
 * Starts the analysis of an uploaded pack: takes one allowance (plan bid, plan check, the
 * free check or a Bid Pass — see access.ts), flips the bid to `processing` and queues the
 * first pipeline job. Safe to call twice: a bid that is already processing is returned.
 */
export async function startBidProcessing(ctx: Scope, bidId: string): Promise<BidRow> {
  const bid = await getBid(ctx, bidId);
  if (bid.status === "processing" || bid.status === "ready") return bid;
  if (bid.status !== "draft") throw new ConflictError("This bid cannot be analysed again. Use Retry, or start a new bid.");
  const files = await db
    .select()
    .from(bidFiles)
    .where(and(eq(bidFiles.bidId, bid.id), eq(bidFiles.organizationId, ctx.organization.id)));
  if (files.length === 0) throw new ValidationError("Add at least one file from the tender pack first.");

  const allowance = await consumeBidAllowance(ctx.organization.id, bid.id);
  if (!allowance.ok) {
    await track("quota.limit_reached", { organizationId: ctx.organization.id, userId: ctx.user.id }, { metric: "bids", limit: 0 });
    throw new AllowanceRequiredError("You have used your cited bid checks. Upgrade your plan or buy a Bid Pass to analyse another tender pack.");
  }

  const runId = randomUUID();
  const state: ProcessingState = { runId, steps: {} };
  const defaultTitle = files[0]!.name.replace(/\.[A-Za-z0-9]{1,8}$/, "").replace(/^\d+[_\-.\s]+/, "").replace(/[_-]+/g, " ").trim();
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(bids)
      .set({
        status: "processing",
        processingState: state,
        processingStage: "reading",
        processingProgress: 0,
        processingStartedAt: new Date(),
        processingLockAt: null,
        title: bid.title === "Untitled bid" && defaultTitle ? `Untitled bid — ${defaultTitle}`.slice(0, 200) : bid.title,
        updatedAt: new Date(),
      })
      .where(and(eq(bids.id, bid.id), eq(bids.organizationId, ctx.organization.id), eq(bids.status, "draft")))
      .returning();
    if (!row) return null;
    await enqueueBidJob(bid.id, runId, "start", tx);
    return row;
  });
  if (!updated) return getBid(ctx, bid.id); // a concurrent call started it

  await track("bid_created", { organizationId: ctx.organization.id, userId: ctx.user.id }, { source: bid.noticeId ? "notice" : "upload", allowance: allowance.source });
  await track("pack_uploaded", { organizationId: ctx.organization.id, userId: ctx.user.id }, { files: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0) });
  await nudgeWorker();
  return updated;
}

/** Restarts a failed analysis from the step that failed (finished steps are kept). */
export async function retryBidProcessing(ctx: Scope, bidId: string): Promise<BidRow> {
  const bid = await getBid(ctx, bidId);
  if (bid.status === "processing") return bid;
  if (bid.status !== "failed") throw new ConflictError("Only a failed analysis can be retried.");
  const runId = randomUUID();
  const state = nextRunState(bid.processingState, runId);
  const updated = await db.transaction(async (tx) => {
    // Files that failed for a transient reason get another chance.
    const [row] = await tx
      .update(bids)
      .set({ status: "processing", processingState: state, processingLockAt: null, updatedAt: new Date() })
      .where(and(eq(bids.id, bid.id), eq(bids.organizationId, ctx.organization.id), eq(bids.status, "failed")))
      .returning();
    if (!row) return null;
    await enqueueBidJob(bid.id, runId, "retry", tx);
    return row;
  });
  if (!updated) return getBid(ctx, bid.id);
  await nudgeWorker();
  return updated;
}

/** Spends a full-bid allowance (plan bid or Bid Pass) to unlock drafting on a check-only bid. */
export async function unlockFullBid(ctx: Scope, bidId: string): Promise<BidRow> {
  const bid = await getBid(ctx, bidId);
  if (bid.accessLevel === "full") return bid;
  const result = await consumeFullBid(ctx.organization.id, bid.id);
  if (!result.ok) throw new AllowanceRequiredError("Drafting, marking and answer export need a Bid Desk plan or a Bid Pass.");
  return getBid(ctx, bid.id);
}

// --- Requirements -----------------------------------------------------------------------

export async function listRequirements(ctx: Scope, bidId: string): Promise<RequirementRow[]> {
  const bid = await getBid(ctx, bidId);
  return db
    .select()
    .from(bidRequirements)
    .where(and(eq(bidRequirements.bidId, bid.id), eq(bidRequirements.organizationId, ctx.organization.id)))
    .orderBy(asc(bidRequirements.sortOrder), asc(bidRequirements.createdAt));
}

const requirementSchema = z.object({
  text: z.string().trim().min(3, "Describe the requirement.").max(2000),
  category: z.enum(REQUIREMENT_CATEGORIES),
  kind: z.enum(REQUIREMENT_KINDS),
  threshold: z.string().trim().max(300).nullable().optional(),
  companyStatus: z.enum(COMPANY_STATUSES).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

function assertEditable(bid: BidRow): void {
  if (bid.status === "archived") throw new ConflictError("This bid is archived. Restore it to make changes.");
}

export async function addRequirement(ctx: Scope, bidId: string, input: unknown): Promise<RequirementRow> {
  const bid = await getBid(ctx, bidId);
  assertEditable(bid);
  const data = parse(requirementSchema, input);
  const existing = await db
    .select({ sortOrder: bidRequirements.sortOrder, ref: bidRequirements.ref })
    .from(bidRequirements)
    .where(and(eq(bidRequirements.bidId, bid.id), eq(bidRequirements.organizationId, ctx.organization.id)));
  const nextNumber = existing.reduce((max, row) => Math.max(max, Number(/^R(\d+)$/.exec(row.ref)?.[1] ?? 0)), 0) + 1;
  const [row] = await db
    .insert(bidRequirements)
    .values({
      organizationId: ctx.organization.id,
      bidId: bid.id,
      ref: `R${nextNumber}`,
      text: data.text,
      category: data.category,
      kind: data.kind,
      isPassFail: data.kind === "pass_fail",
      threshold: data.threshold || null,
      companyStatus: data.companyStatus ?? "unknown",
      companyStatusSource: data.companyStatus ? "user" : "ai",
      note: data.note || null,
      citation: null,
      userEdited: true,
      source: "user",
      sortOrder: existing.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 10,
    })
    .returning();
  return row!;
}

export async function getRequirement(ctx: Scope, bidId: string, requirementId: string): Promise<RequirementRow> {
  const bid = await getBid(ctx, bidId);
  const id = asUuid(requirementId, "Requirement");
  const [row] = await db
    .select()
    .from(bidRequirements)
    .where(and(eq(bidRequirements.id, id), eq(bidRequirements.bidId, bid.id), eq(bidRequirements.organizationId, ctx.organization.id)));
  if (!row) throw new NotFoundError("Requirement not found.");
  return row;
}

export async function updateRequirement(ctx: Scope, bidId: string, requirementId: string, input: unknown): Promise<RequirementRow> {
  const bid = await getBid(ctx, bidId);
  assertEditable(bid);
  const current = await getRequirement(ctx, bid.id, requirementId);
  const data = parse(requirementSchema.partial(), input);
  const contentChanged =
    (data.text !== undefined && data.text !== current.text) ||
    (data.category !== undefined && data.category !== current.category) ||
    (data.kind !== undefined && data.kind !== current.kind) ||
    (data.threshold !== undefined && (data.threshold || null) !== current.threshold);
  const statusChanged = data.companyStatus !== undefined && data.companyStatus !== current.companyStatus;
  const [row] = await db
    .update(bidRequirements)
    .set({
      ...(data.text !== undefined ? { text: data.text } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.kind !== undefined ? { kind: data.kind, isPassFail: data.kind === "pass_fail" } : {}),
      ...(data.threshold !== undefined ? { threshold: data.threshold || null } : {}),
      ...(data.note !== undefined ? { note: data.note || null } : {}),
      ...(statusChanged ? { companyStatus: data.companyStatus, companyStatusSource: "user", companyNote: null } : {}),
      userEdited: current.userEdited || contentChanged,
      updatedAt: new Date(),
    })
    .where(and(eq(bidRequirements.id, current.id), eq(bidRequirements.organizationId, ctx.organization.id)))
    .returning();
  return row!;
}

export async function deleteRequirement(ctx: Scope, bidId: string, requirementId: string): Promise<void> {
  const bid = await getBid(ctx, bidId);
  assertEditable(bid);
  const current = await getRequirement(ctx, bid.id, requirementId);
  await db.delete(bidRequirements).where(and(eq(bidRequirements.id, current.id), eq(bidRequirements.organizationId, ctx.organization.id)));
}

// --- Questions --------------------------------------------------------------------------

export async function listQuestions(ctx: Scope, bidId: string): Promise<QuestionRow[]> {
  const bid = await getBid(ctx, bidId);
  return db
    .select()
    .from(bidQuestions)
    .where(and(eq(bidQuestions.bidId, bid.id), eq(bidQuestions.organizationId, ctx.organization.id)))
    .orderBy(asc(bidQuestions.sortOrder), asc(bidQuestions.createdAt));
}

export async function getQuestion(ctx: Scope, bidId: string, questionId: string): Promise<QuestionRow> {
  const bid = await getBid(ctx, bidId);
  const id = asUuid(questionId, "Question");
  const [row] = await db
    .select()
    .from(bidQuestions)
    .where(and(eq(bidQuestions.id, id), eq(bidQuestions.bidId, bid.id), eq(bidQuestions.organizationId, ctx.organization.id)));
  if (!row) throw new NotFoundError("Question not found.");
  return row;
}

const optionalNumber = (min: number, max: number) =>
  z.preprocess((value) => (value === "" || value === undefined ? null : typeof value === "string" ? Number(value) : value), z.number().min(min).max(max).nullable());

const questionSchema = z.object({
  ref: z.string().trim().max(40).default(""),
  title: z.string().trim().max(300).nullable().optional(),
  text: z.string().trim().min(3, "Enter the question.").max(8000),
  section: z.string().trim().max(120).nullable().optional(),
  weighting: optionalNumber(0, 100).optional(),
  maxScore: optionalNumber(0, 100000).optional(),
  wordLimit: optionalNumber(1, 100000).optional(),
  pageLimit: optionalNumber(0.5, 500).optional(),
  guidance: z.string().trim().max(8000).nullable().optional(),
});

export async function addQuestion(ctx: Scope, bidId: string, input: unknown): Promise<QuestionRow> {
  const bid = await getBid(ctx, bidId);
  assertEditable(bid);
  const data = parse(questionSchema, input);
  const [last] = await db
    .select({ max: sql<number>`coalesce(max(${bidQuestions.sortOrder}), 0)::int` })
    .from(bidQuestions)
    .where(and(eq(bidQuestions.bidId, bid.id), eq(bidQuestions.organizationId, ctx.organization.id)));
  const [row] = await db
    .insert(bidQuestions)
    .values({
      organizationId: ctx.organization.id,
      bidId: bid.id,
      ref: data.ref,
      title: data.title || null,
      text: data.text,
      section: data.section || null,
      weighting: data.weighting ?? null,
      maxScore: data.maxScore ?? null,
      wordLimit: data.wordLimit !== null && data.wordLimit !== undefined ? Math.round(data.wordLimit) : null,
      pageLimit: data.pageLimit ?? null,
      limitText: data.wordLimit ? `${Math.round(data.wordLimit)} words` : data.pageLimit ? `${data.pageLimit} pages` : null,
      guidance: data.guidance || null,
      scored: data.weighting !== null && data.weighting !== undefined ? "scored_weighted" : "unclear",
      citation: null,
      userEdited: true,
      source: "user",
      sortOrder: (last?.max ?? 0) + 10,
    })
    .returning();
  return row!;
}

export async function updateQuestion(ctx: Scope, bidId: string, questionId: string, input: unknown): Promise<QuestionRow> {
  const bid = await getBid(ctx, bidId);
  assertEditable(bid);
  const current = await getQuestion(ctx, bid.id, questionId);
  const data = parse(questionSchema.partial(), input);
  const [row] = await db
    .update(bidQuestions)
    .set({
      ...(data.ref !== undefined ? { ref: data.ref } : {}),
      ...(data.title !== undefined ? { title: data.title || null } : {}),
      ...(data.text !== undefined ? { text: data.text } : {}),
      ...(data.section !== undefined ? { section: data.section || null } : {}),
      ...(data.weighting !== undefined ? { weighting: data.weighting } : {}),
      ...(data.maxScore !== undefined ? { maxScore: data.maxScore } : {}),
      ...(data.wordLimit !== undefined ? { wordLimit: data.wordLimit === null ? null : Math.round(data.wordLimit), limitText: data.wordLimit ? `${Math.round(data.wordLimit)} words` : current.limitText } : {}),
      ...(data.pageLimit !== undefined ? { pageLimit: data.pageLimit } : {}),
      ...(data.guidance !== undefined ? { guidance: data.guidance || null } : {}),
      userEdited: true,
      updatedAt: new Date(),
    })
    .where(and(eq(bidQuestions.id, current.id), eq(bidQuestions.organizationId, ctx.organization.id)))
    .returning();
  return row!;
}

export async function setQuestionStatus(ctx: Scope, bidId: string, questionId: string, status: unknown): Promise<QuestionRow> {
  const bid = await getBid(ctx, bidId);
  assertEditable(bid);
  const current = await getQuestion(ctx, bid.id, questionId);
  const next = parse(z.enum(QUESTION_STATUSES), status);
  if (next !== "not_started" && !current.draftText?.trim()) throw new ValidationError("Write or generate an answer first.");
  const [row] = await db
    .update(bidQuestions)
    .set({ status: next, updatedAt: new Date() })
    .where(and(eq(bidQuestions.id, current.id), eq(bidQuestions.organizationId, ctx.organization.id)))
    .returning();
  return row!;
}

export async function deleteQuestion(ctx: Scope, bidId: string, questionId: string): Promise<void> {
  const bid = await getBid(ctx, bidId);
  assertEditable(bid);
  const current = await getQuestion(ctx, bid.id, questionId);
  await db.delete(bidQuestions).where(and(eq(bidQuestions.id, current.id), eq(bidQuestions.organizationId, ctx.organization.id)));
}
