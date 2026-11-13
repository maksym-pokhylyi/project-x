import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { libraryDocs } from "@/db/schema";
import { FILE_KIND_MIME, fileKindFromName, MAX_LIBRARY_FILE_BYTES, unsupportedFileReason, type FileKind } from "@/features/bids/constants";
import { deleteKeys, librarySourceKey, librarySourcePrefix, readBytes } from "@/features/bids/server/store";
import { LIBRARY_DOC_KINDS, type LibraryDocKind } from "@/features/bids/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { enqueueJob } from "@/lib/jobs/queue";
import { storage } from "@/lib/storage";
import type { OrgContext } from "@/server/session";

type Scope = Pick<OrgContext, "organization" | "user">;
export type LibraryDocRow = typeof libraryDocs.$inferSelect;

/** Most documents one workspace may keep in its library. */
export const MAX_LIBRARY_DOCS = 200;

export async function listLibraryDocs(ctx: Scope): Promise<LibraryDocRow[]> {
  return db.select().from(libraryDocs).where(eq(libraryDocs.organizationId, ctx.organization.id)).orderBy(desc(libraryDocs.createdAt));
}

export async function getLibraryDoc(ctx: Scope, docId: string): Promise<LibraryDocRow> {
  const parsed = z.uuid().safeParse(docId);
  if (!parsed.success) throw new NotFoundError("Document not found.");
  const [row] = await db.select().from(libraryDocs).where(and(eq(libraryDocs.id, parsed.data), eq(libraryDocs.organizationId, ctx.organization.id)));
  if (!row) throw new NotFoundError("Document not found.");
  return row;
}

export function guessDocKind(fileName: string): LibraryDocKind {
  const name = fileName.toLowerCase();
  if (/polic(y|ies)|statement|procedure|handbook/.test(name)) return "policy";
  if (/case.?stud|project.?sheet|testimonial|reference/.test(name)) return "case_study";
  if (/\bcv\b|curriculum|resume|profile/.test(name)) return "cv";
  if (/certificat|iso.?\d|accredit|insurance|schedule|licen[cs]e|cyber.?essentials/.test(name)) return "certificate";
  if (/tender|bid|itt|response|submission|proposal|method.?statement/.test(name)) return "past_bid";
  return "other";
}

export type LibraryUploadPlan = { docId: string; storageKey: string; kind: Exclude<FileKind, "zip">; contentType: string };

/** Validates a prospective library upload and reserves its id + storage key. */
export async function planLibraryUpload(ctx: Scope, input: { name: string; size: number }): Promise<LibraryUploadPlan> {
  const reason = unsupportedFileReason(input.name);
  if (reason) throw new ValidationError(reason);
  const kind = fileKindFromName(input.name);
  if (!kind || kind === "zip") throw new ValidationError("ZIP files cannot be added to the library. Upload the documents one by one.");
  if (!Number.isFinite(input.size) || input.size <= 0) throw new ValidationError("This file is empty.");
  if (input.size > MAX_LIBRARY_FILE_BYTES) throw new ValidationError("Library documents must be 20 MB or smaller.");
  const [count] = await db.select({ count: sql<number>`count(*)::int` }).from(libraryDocs).where(eq(libraryDocs.organizationId, ctx.organization.id));
  if ((count?.count ?? 0) >= MAX_LIBRARY_DOCS) throw new ValidationError(`The library holds at most ${MAX_LIBRARY_DOCS} documents. Delete some you no longer need.`);
  const docId = randomUUID();
  return { docId, storageKey: librarySourceKey(ctx.organization.id, docId, kind), kind, contentType: FILE_KIND_MIME[kind] };
}

const registerSchema = z.object({
  docId: z.uuid(),
  name: z.string().trim().min(1).max(255),
  kind: z.enum(LIBRARY_DOC_KINDS).optional(),
  title: z.string().trim().max(200).optional(),
});

/**
 * Records an uploaded library document (the bytes must already be in storage under this
 * workspace's library prefix) and queues text extraction + summarising.
 */
export async function registerLibraryDoc(ctx: Scope, input: unknown): Promise<LibraryDocRow> {
  const data = registerSchema.parse(input);
  const fileKind = fileKindFromName(data.name);
  if (!fileKind || fileKind === "zip") throw new ValidationError(unsupportedFileReason(data.name) ?? "This file type is not supported.");
  const storageKey = librarySourceKey(ctx.organization.id, data.docId, fileKind);
  if (!storageKey.startsWith(librarySourcePrefix(ctx.organization.id))) throw new ValidationError("Invalid upload.");
  const stored = await storage.get(storageKey);
  if (!stored) throw new ValidationError("The upload did not complete. Try again.");
  await stored.body.cancel().catch(() => undefined);
  const size = stored.size ?? 0;
  if (size > MAX_LIBRARY_FILE_BYTES) {
    await deleteKeys([storageKey]);
    throw new ValidationError("Library documents must be 20 MB or smaller.");
  }
  const title = data.title || data.name.replace(/\.[A-Za-z0-9]{1,8}$/, "").replace(/[_-]+/g, " ").trim().slice(0, 200) || data.name;
  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(libraryDocs)
      .values({
        id: data.docId,
        organizationId: ctx.organization.id,
        kind: data.kind ?? guessDocKind(data.name),
        title,
        storageKey,
        fileName: data.name,
        mime: FILE_KIND_MIME[fileKind],
        size,
        status: "processing",
        createdBy: ctx.user.id,
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted) throw new ValidationError("This document was already added.");
    await enqueueJob("library.process", { docId: inserted.id }, { dedupeKey: `library.process:${inserted.id}`, maxAttempts: 3 }, tx);
    return inserted;
  });
  return row;
}

const updateSchema = z.object({
  title: z.string().trim().min(1, "Give the document a title.").max(200).optional(),
  kind: z.enum(LIBRARY_DOC_KINDS).optional(),
  summary: z.string().trim().max(4000).nullable().optional(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function updateLibraryDoc(ctx: Scope, docId: string, input: unknown): Promise<LibraryDocRow> {
  const existing = await getLibraryDoc(ctx, docId);
  const data = updateSchema.parse(input);
  const [row] = await db
    .update(libraryDocs)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(libraryDocs.id, existing.id), eq(libraryDocs.organizationId, ctx.organization.id)))
    .returning();
  return row!;
}

export async function deleteLibraryDoc(ctx: Scope, docId: string): Promise<void> {
  const existing = await getLibraryDoc(ctx, docId);
  await db.delete(libraryDocs).where(and(eq(libraryDocs.id, existing.id), eq(libraryDocs.organizationId, ctx.organization.id)));
  await deleteKeys([existing.storageKey, existing.textStorageKey]);
}

export async function readLibrarySource(ctx: Scope, docId: string): Promise<{ doc: LibraryDocRow; bytes: Uint8Array }> {
  const doc = await getLibraryDoc(ctx, docId);
  const bytes = await readBytes(doc.storageKey);
  if (!bytes) throw new NotFoundError("The stored file is missing.");
  return { doc, bytes };
}
