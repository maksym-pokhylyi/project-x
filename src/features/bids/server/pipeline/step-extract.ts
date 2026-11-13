import "server-only";
import { errorReason } from "@/lib/describe-error";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bidFiles, bids } from "@/db/schema";
import {
  estimateTokens,
  FILE_KIND_MIME,
  fileExtension,
  MAX_BID_BYTES,
  MAX_BID_FILES,
  MAX_TRANSCRIBE_FILE_BYTES,
  MAX_TRANSCRIBED_PAGES_PER_BID,
  type FileKind,
} from "@/features/bids/constants";
import type { PackStats } from "@/features/bids/types";
import { AiBudgetExceededError } from "@/lib/ai";
import { log } from "@/lib/logger";
import { storage } from "@/lib/storage";
import { addUsage, callText, ZERO_USAGE, type AiUsage } from "../ai/call";
import { expandZip, ExtractionError, extractDocument, type ExtractedDocument, type TextUnit } from "../extract";
import { nonSpaceLength } from "../extract/text";
import { bidSourceKey, bidTextKey, deleteKeys, readBytes, readText, writeText } from "../store";
import { buildPack } from "./pack";
import { TRANSCRIBE_SYSTEM, transcribeTask } from "./prompts";
import { PermanentPipelineError, touchBid, type BidRow } from "./state";

type FileRow = typeof bidFiles.$inferSelect;

/** Most pages of one PDF sent for transcription in a single model call. */
const MAX_TRANSCRIBE_PAGES_PER_CALL = 20;
/** PDFs longer than this are not sent to the model at all (provider page limits). */
const MAX_TRANSCRIBE_PDF_PAGES = 100;

async function listFiles(bidId: string): Promise<FileRow[]> {
  return db.select().from(bidFiles).where(eq(bidFiles.bidId, bidId)).orderBy(asc(bidFiles.sortOrder), asc(bidFiles.createdAt));
}

/** Expands one uploaded ZIP into member rows. Safe to run again after a crash. */
async function expandArchive(bid: BidRow, zip: FileRow, siblings: FileRow[]): Promise<void> {
  // Remove members left behind by an interrupted expansion.
  const stale = siblings.filter((file) => file.parentFileId === zip.id);
  if (stale.length > 0) {
    await deleteKeys(stale.flatMap((file) => [file.storageKey, file.textStorageKey]));
    await db.delete(bidFiles).where(inArray(bidFiles.id, stale.map((file) => file.id)));
  }
  const bytes = await readBytes(zip.storageKey);
  if (!bytes) {
    await db.update(bidFiles).set({ extractionStatus: "failed", error: "The uploaded file could not be found. Upload it again.", updatedAt: new Date() }).where(eq(bidFiles.id, zip.id));
    return;
  }
  const others = siblings.filter((file) => file.id !== zip.id && file.parentFileId !== zip.id && file.kind !== "zip");
  const usedBytes = others.reduce((sum, file) => sum + file.size, 0);
  try {
    const { members, skipped } = expandZip(bytes, {
      remainingBytes: Math.max(0, MAX_BID_BYTES - usedBytes),
      remainingFiles: Math.max(0, MAX_BID_FILES - others.length),
    });
    let order = zip.sortOrder;
    for (const member of members) {
      const id = randomUUID();
      const key = bidSourceKey(bid.organizationId, bid.id, id, member.kind);
      await storage.put(key, member.bytes, { contentType: FILE_KIND_MIME[member.kind] });
      await db.insert(bidFiles).values({
        id,
        organizationId: bid.organizationId,
        bidId: bid.id,
        parentFileId: zip.id,
        storageKey: key,
        name: `${zip.name}/${member.path}`,
        mime: FILE_KIND_MIME[member.kind],
        kind: member.kind,
        size: member.bytes.byteLength,
        sortOrder: (order += 1),
      });
    }
    for (const skip of skipped) {
      const id = randomUUID();
      await db.insert(bidFiles).values({
        id,
        organizationId: bid.organizationId,
        bidId: bid.id,
        parentFileId: zip.id,
        // Nothing is stored for a skipped member; the key only keeps the column unique.
        storageKey: bidSourceKey(bid.organizationId, bid.id, id, "skipped"),
        name: `${zip.name}/${skip.path}`,
        mime: "application/octet-stream",
        kind: fileExtension(skip.path) || "other",
        size: 0,
        extractionStatus: "skipped",
        error: skip.reason,
        sortOrder: (order += 1),
      });
    }
    const note = members.length === 0 ? "No supported documents were found in this ZIP." : null;
    await db
      .update(bidFiles)
      .set({ extractionStatus: members.length === 0 ? "failed" : "expanded", pages: members.length, error: note, updatedAt: new Date() })
      .where(eq(bidFiles.id, zip.id));
  } catch (error) {
    const message = error instanceof ExtractionError ? error.message : "This ZIP archive could not be opened.";
    await db.update(bidFiles).set({ extractionStatus: "failed", error: message, updatedAt: new Date() }).where(eq(bidFiles.id, zip.id));
  }
}

function parseTranscription(text: string): Map<number, string> {
  const pages = new Map<number, string>();
  const pattern = /<<<PAGE\s+(\d+)>>>\s*\n?([\s\S]*?)(?=<<<PAGE\s+\d+>>>|$)/g;
  for (const match of text.matchAll(pattern)) {
    const body = match[2]!.trim();
    if (body && body !== "[blank]") pages.set(Number(match[1]), body);
  }
  return pages;
}

/**
 * Sends the pages without a text layer to the model as native PDF input and returns their
 * transcription. Capped per call and per bid; anything over the cap stays unread and is
 * reported as a warning (never silently).
 */
async function transcribe(bid: BidRow, file: FileRow, bytes: Uint8Array, pages: number[], totalPages: number): Promise<{ texts: Map<number, string>; usage: AiUsage; model: string | null }> {
  const texts = new Map<number, string>();
  let usage = ZERO_USAGE;
  let model: string | null = null;
  for (let offset = 0; offset < pages.length; offset += MAX_TRANSCRIBE_PAGES_PER_CALL) {
    const batch = pages.slice(offset, offset + MAX_TRANSCRIBE_PAGES_PER_CALL);
    const result = await callText({
      organizationId: bid.organizationId,
      userId: bid.createdBy,
      feature: "bids.transcribe",
      step: "transcribe",
      system: TRANSCRIBE_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "file", data: bytes, mediaType: "application/pdf", filename: file.name.split("/").pop() ?? "document.pdf" },
            { type: "text", text: transcribeTask(batch) },
          ],
        },
      ],
      maxOutputTokens: Math.min(32_000, 2_000 + batch.length * 1_500),
      timeoutMs: 170_000,
      // The whole file is attached each time, so every page is reserved, not only this batch.
      filePages: totalPages,
    });
    usage = addUsage(usage, result.usage);
    model = result.model;
    for (const [page, text] of parseTranscription(result.text)) if (batch.includes(page)) texts.set(page, text);
    await touchBid(bid.id);
  }
  return { texts, usage, model };
}

export type ExtractOutcome = { done: boolean; usage: AiUsage; model: string | null };

/**
 * Step 1 — "Reading files". Expands ZIPs, extracts text unit by unit, transcribes scanned
 * pages, stores the text next to the source and records per-file results. Processes files
 * until `deadline`; returns `done: false` when files remain so the job re-enqueues itself.
 * Every file is committed individually, so a crash never loses finished files.
 */
export async function stepExtract(bid: BidRow, deadline: number): Promise<ExtractOutcome> {
  let usage = ZERO_USAGE;
  let model: string | null = null;
  let files = await listFiles(bid.id);

  for (const zip of files.filter((file) => file.kind === "zip" && (file.extractionStatus === "pending" || file.extractionStatus === "processing"))) {
    await db.update(bidFiles).set({ extractionStatus: "processing", updatedAt: new Date() }).where(eq(bidFiles.id, zip.id));
    await expandArchive(bid, zip, files);
    files = await listFiles(bid.id);
    await touchBid(bid.id);
  }

  let transcribedSoFar = files.reduce((sum, file) => sum + file.transcribedPages, 0);
  for (const file of files) {
    if (file.kind === "zip" || (file.extractionStatus !== "pending" && file.extractionStatus !== "processing")) continue;
    if (Date.now() > deadline) return { done: false, usage, model };
    await db.update(bidFiles).set({ extractionStatus: "processing", updatedAt: new Date() }).where(eq(bidFiles.id, file.id));

    try {
      const bytes = await readBytes(file.storageKey);
      if (!bytes) throw new ExtractionError("The uploaded file could not be found. Upload it again.");
      const document: ExtractedDocument = await extractDocument(file.kind as Exclude<FileKind, "zip">, bytes);
      const warnings = [...document.warnings];
      let units: TextUnit[] = document.units;
      let transcribedPages = 0;
      const scanned = document.kind === "pdf" && document.lowTextPages.length >= Math.max(1, Math.ceil(document.pages * 0.3));

      if (scanned) {
        const budget = Math.max(0, MAX_TRANSCRIBED_PAGES_PER_BID - transcribedSoFar);
        const wanted = document.lowTextPages.slice(0, budget);
        if (bytes.byteLength > MAX_TRANSCRIBE_FILE_BYTES || document.pages > MAX_TRANSCRIBE_PDF_PAGES) {
          warnings.push("This looks like a scanned document and is too large to transcribe. Upload a version with selectable text.");
        } else if (wanted.length === 0) {
          warnings.push(`This looks like a scanned document. The limit of ${MAX_TRANSCRIBED_PAGES_PER_BID} transcribed pages per bid was reached, so it was not read.`);
        } else {
          try {
            const result = await transcribe(bid, file, bytes, wanted, document.pages);
            usage = addUsage(usage, result.usage);
            model = result.model ?? model;
            units = units.map((unit) => {
              const page = Number(/^p(\d+)$/.exec(unit.loc)?.[1] ?? 0);
              const text = result.texts.get(page);
              return text ? { loc: unit.loc, text, transcribed: true } : unit;
            });
            transcribedPages = result.texts.size;
            transcribedSoFar += transcribedPages;
            const unread = document.lowTextPages.length - transcribedPages;
            warnings.push(
              `Scanned document: ${transcribedPages} page${transcribedPages === 1 ? " was" : "s were"} transcribed by AI — check quotes against the original.` +
                (unread > 0 ? ` ${unread} scanned page${unread === 1 ? " was" : "s were"} not read.` : ""),
            );
          } catch (error) {
            if (error instanceof AiBudgetExceededError) throw error;
            log.warn("bids: transcription failed", { bidId: bid.id, fileId: file.id, reason: errorReason(error) });
            warnings.push("This looks like a scanned document and could not be transcribed. Upload a version with selectable text.");
          }
        }
      } else if (document.lowTextPages.length > 0 && document.kind === "pdf") {
        const blank = document.lowTextPages.length;
        if (blank >= 3) warnings.push(`${blank} pages have no selectable text (blank pages, drawings or scans) and were not read.`);
      }

      const text = units.map((unit) => unit.text).join("\n");
      const hasText = nonSpaceLength(text) >= 20;
      const textKey = bidTextKey(bid.organizationId, bid.id, file.id);
      await writeText(textKey, units);
      await db
        .update(bidFiles)
        .set({
          extractionStatus: hasText ? "done" : "failed",
          textStorageKey: textKey,
          pages: document.pages,
          lowText: scanned,
          transcribedPages,
          charCount: text.length,
          tokenCount: estimateTokens(text),
          error: hasText ? (warnings.join(" ") || null) : warnings.join(" ") || "No readable text was found in this file.",
          updatedAt: new Date(),
        })
        .where(eq(bidFiles.id, file.id));
    } catch (error) {
      if (error instanceof AiBudgetExceededError) throw error;
      const message = error instanceof ExtractionError ? error.message : "This file could not be read.";
      if (!(error instanceof ExtractionError)) log.warn("bids: extraction failed", { bidId: bid.id, fileId: file.id, reason: errorReason(error) });
      await db.update(bidFiles).set({ extractionStatus: "failed", error: message, updatedAt: new Date() }).where(eq(bidFiles.id, file.id));
    }
    await touchBid(bid.id);
  }

  await finishExtraction(bid);
  return { done: true, usage, model };
}

/** Decides which files go into the analysis and records pack statistics and warnings. */
async function finishExtraction(bid: BidRow): Promise<void> {
  const files = await listFiles(bid.id);
  const readable = files.filter((file) => file.extractionStatus === "done");
  if (readable.length === 0) {
    const reasons = files
      .filter((file) => file.error)
      .slice(0, 3)
      .map((file) => `${file.name}: ${file.error}`);
    throw new PermanentPipelineError(`None of the uploaded files could be read. ${reasons.join(" ")}`.trim());
  }
  const sources = await Promise.all(readable.map(async (file) => ({ id: file.id, name: file.name, units: await readText(file.textStorageKey) })));
  const pack = buildPack(sources);
  const excluded = new Set(pack.excludedFileIds);
  await db.update(bidFiles).set({ includedInAnalysis: true }).where(eq(bidFiles.bidId, bid.id));
  if (excluded.size > 0) await db.update(bidFiles).set({ includedInAnalysis: false }).where(and(eq(bidFiles.bidId, bid.id), inArray(bidFiles.id, [...excluded])));

  const warnings: string[] = [];
  const excludedNames = readable.filter((file) => excluded.has(file.id)).map((file) => file.name);
  if (excludedNames.length > 0) warnings.push(`The pack is very large. These files were NOT analysed: ${excludedNames.join(", ")}. Check them yourself.`);
  if (pack.truncatedFileId) {
    const name = readable.find((file) => file.id === pack.truncatedFileId)?.name;
    warnings.push(`${name ?? "One file"} is very long: only its first part was analysed.`);
  }
  const failed = files.filter((file) => file.extractionStatus === "failed" || file.extractionStatus === "skipped");
  if (failed.length > 0) warnings.push(`${failed.length} file${failed.length === 1 ? " was" : "s were"} not read: ${failed.map((file) => file.name).slice(0, 6).join(", ")}.`);
  const lowText = readable.filter((file) => file.lowText);
  if (lowText.length > 0) warnings.push(`${lowText.length} scanned file${lowText.length === 1 ? "" : "s"}: text was transcribed by AI and may contain reading errors.`);

  const stats: PackStats = {
    files: readable.length,
    pages: readable.reduce((sum, file) => sum + (file.pages ?? 0), 0),
    chars: readable.reduce((sum, file) => sum + file.charCount, 0),
    tokens: pack.tokens,
    transcribedPages: readable.reduce((sum, file) => sum + file.transcribedPages, 0),
    lowTextFiles: lowText.map((file) => file.name),
    excludedFiles: excludedNames,
    failedFiles: failed.map((file) => file.name),
    warnings,
    usage: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    models: {},
    durationSeconds: null,
    citations: { total: 0, verified: 0 },
  };
  await db.update(bids).set({ packStats: stats, updatedAt: sql`now()` }).where(eq(bids.id, bid.id));
}
