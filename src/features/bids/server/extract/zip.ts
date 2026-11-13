import { unzipSync, type UnzipFileInfo } from "fflate";
import {
  fileKindFromName,
  MAX_FILE_BYTES,
  MAX_ZIP_ENTRIES,
  MAX_ZIP_EXPANDED_BYTES,
  unsupportedFileReason,
  type FileKind,
} from "@/features/bids/constants";
import { ExtractionError } from "./types";

export type ZipMember = {
  /** Path inside the archive, normalised ("folder/name.pdf"). */
  path: string;
  kind: Exclude<FileKind, "zip">;
  bytes: Uint8Array;
};

export type ZipSkip = { path: string; reason: string };

export type ZipExpansion = { members: ZipMember[]; skipped: ZipSkip[] };

/** Normalises an archive path; returns null for directories, junk and unsafe paths. */
export function normaliseZipPath(name: string): string | null {
  const unified = name.replace(/\\/g, "/");
  if (!unified || unified.endsWith("/")) return null;
  const parts = unified.split("/").filter((part) => part && part !== ".");
  if (parts.length === 0 || parts.includes("..")) return null;
  if (parts[0] === "__MACOSX") return null;
  const base = parts[parts.length - 1]!;
  if (base.startsWith(".") || base === "Thumbs.db" || base === "desktop.ini" || base.startsWith("~$")) return null;
  return parts.join("/");
}

/**
 * Expands a ZIP archive in memory. Only supported document types are inflated; everything
 * else is reported in `skipped` with a reason the user can act on. Nested archives are not
 * expanded. Guards: entry count, per-file size and total expanded size.
 */
export function expandZip(bytes: Uint8Array, options: { remainingBytes?: number; remainingFiles?: number } = {}): ZipExpansion {
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new ExtractionError("This is not a valid ZIP archive.");
  const skipped: ZipSkip[] = [];
  const wanted = new Map<string, { path: string; kind: Exclude<FileKind, "zip"> }>();
  let budget = Math.min(MAX_ZIP_EXPANDED_BYTES, options.remainingBytes ?? MAX_ZIP_EXPANDED_BYTES);
  let slots = Math.min(MAX_ZIP_ENTRIES, options.remainingFiles ?? MAX_ZIP_ENTRIES);

  const filter = (file: UnzipFileInfo): boolean => {
    const path = normaliseZipPath(file.name);
    if (!path) return false;
    const kind = fileKindFromName(path);
    if (!kind) {
      skipped.push({ path, reason: unsupportedFileReason(path) ?? "This file type is not supported." });
      return false;
    }
    if (kind === "zip") {
      skipped.push({ path, reason: "ZIP files inside a ZIP are not expanded. Upload it separately." });
      return false;
    }
    if (file.originalSize > MAX_FILE_BYTES) {
      skipped.push({ path, reason: "Larger than 50 MB." });
      return false;
    }
    if (slots <= 0) {
      skipped.push({ path, reason: "Too many files in this bid." });
      return false;
    }
    if (file.originalSize > budget) {
      skipped.push({ path, reason: "The bid would exceed 200 MB." });
      return false;
    }
    slots -= 1;
    budget -= file.originalSize;
    wanted.set(file.name, { path, kind });
    return true;
  };

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter });
  } catch {
    throw new ExtractionError("This ZIP archive could not be opened. It may be damaged or password-protected.");
  }
  const members: ZipMember[] = [];
  for (const [name, data] of Object.entries(entries)) {
    const info = wanted.get(name);
    if (!info) continue;
    if (data.byteLength === 0) {
      skipped.push({ path: info.path, reason: "Empty file." });
      continue;
    }
    members.push({ path: info.path, kind: info.kind, bytes: data });
  }
  members.sort((a, b) => a.path.localeCompare(b.path, "en", { numeric: true }));
  return { members, skipped };
}
