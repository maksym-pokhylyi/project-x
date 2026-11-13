import "server-only";
import { orgFileKey, storage } from "@/lib/storage";
import type { StoredText, TextUnit } from "./extract/types";

/**
 * Storage layout of the bid desk and library (all under the workspace's namespace, which
 * is what /api/files and our own routes authorise against):
 *
 *   org/<org>/bids/<bid>/src/<fileId>.<ext>     uploaded pack files (and ZIP members)
 *   org/<org>/bids/<bid>/text/<fileId>.json     extracted text units
 *   org/<org>/bids/<bid>/work/<pass>.json       the models' intermediate readings
 *   org/<org>/library/src/<docId>.<ext>         library documents
 *   org/<org>/library/text/<docId>.json         their extracted text
 */
/** Everything stored for one bid: uploads, extracted text and working files. */
export function bidFolder(organizationId: string, bidId: string): string {
  return orgFileKey(organizationId, "bids", bidId);
}

/** The models' intermediate readings of a pack (kept so a retry does not pay twice). */
export function bidWorkFolder(organizationId: string, bidId: string): string {
  return orgFileKey(organizationId, "bids", bidId, "work");
}

export function bidSourceKey(organizationId: string, bidId: string, fileId: string, extension: string): string {
  return orgFileKey(organizationId, "bids", bidId, "src", `${fileId}.${extension}`);
}

export function bidSourcePrefix(organizationId: string, bidId: string): string {
  return `${orgFileKey(organizationId, "bids", bidId, "src", "x").slice(0, -1)}`;
}

export function bidTextKey(organizationId: string, bidId: string, fileId: string): string {
  return orgFileKey(organizationId, "bids", bidId, "text", `${fileId}.json`);
}

export function librarySourceKey(organizationId: string, docId: string, extension: string): string {
  return orgFileKey(organizationId, "library", "src", `${docId}.${extension}`);
}

export function librarySourcePrefix(organizationId: string): string {
  return `${orgFileKey(organizationId, "library", "src", "x").slice(0, -1)}`;
}

export function libraryTextKey(organizationId: string, docId: string): string {
  return orgFileKey(organizationId, "library", "text", `${docId}.json`);
}

/** Reads a stored object fully into memory; null when it does not exist. */
export async function readBytes(key: string): Promise<Uint8Array | null> {
  const file = await storage.get(key);
  if (!file) return null;
  return new Uint8Array(await new Response(file.body).arrayBuffer());
}

export async function writeText(key: string, units: TextUnit[]): Promise<void> {
  const payload: StoredText = { version: 1, units };
  await storage.put(key, new TextEncoder().encode(JSON.stringify(payload)), { contentType: "application/json" });
}

export async function readText(key: string | null | undefined): Promise<TextUnit[]> {
  if (!key) return [];
  const bytes = await readBytes(key);
  if (!bytes) return [];
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<StoredText>;
    return Array.isArray(parsed.units) ? parsed.units.filter((unit) => typeof unit?.loc === "string" && typeof unit?.text === "string") : [];
  } catch {
    return [];
  }
}

/** Best-effort removal of stored objects (never throws). */
export async function deleteKeys(keys: Array<string | null | undefined>): Promise<void> {
  await Promise.all(keys.filter((key): key is string => Boolean(key)).map((key) => storage.delete(key).catch(() => undefined)));
}
