/** Client-safe limits and labels for the bid desk. */

export const MB = 1024 * 1024;

/** Largest single file accepted for a tender pack. */
export const MAX_FILE_BYTES = 50 * MB;
/** Largest total size of one bid's uploads. */
export const MAX_BID_BYTES = 200 * MB;
/** Most files one bid may hold (after ZIP expansion). */
export const MAX_BID_FILES = 60;
/** Largest library document. */
export const MAX_LIBRARY_FILE_BYTES = 20 * MB;

/** Pages read per PDF; later pages are skipped with a warning. */
export const MAX_PAGES_PER_FILE = 400;
/** Rows read per spreadsheet sheet. */
export const MAX_SHEET_ROWS = 400;
export const MAX_SHEET_CHARS = 60_000;
/** Sheets read per workbook. */
export const MAX_SHEETS = 30;

/** A PDF page with fewer non-space characters than this has no usable text layer. */
export const LOW_TEXT_CHARS = 40;
/** Scanned pages sent to the model for transcription, per bid. */
export const MAX_TRANSCRIBED_PAGES_PER_BID = 40;
/** A scanned PDF larger than this is not sent to the model at all. */
export const MAX_TRANSCRIBE_FILE_BYTES = 20 * MB;

/** ZIP expansion guards. */
export const MAX_ZIP_ENTRIES = 80;
export const MAX_ZIP_EXPANDED_BYTES = 200 * MB;

/**
 * Size of pack text sent to the model, in estimated tokens. Above it the least relevant
 * files (terms and conditions, drawings) are left out and listed in a warning.
 */
export const MAX_PACK_TOKENS = 300_000;

/** Rough token estimate for English text extracted from documents. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.6);
}

export type FileKind = "pdf" | "docx" | "xlsx" | "csv" | "txt" | "zip";

export const FILE_KIND_BY_EXTENSION: Record<string, FileKind> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  csv: "csv",
  txt: "txt",
  zip: "zip",
};

export const FILE_KIND_MIME: Record<FileKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
};

export const ACCEPTED_EXTENSIONS = Object.keys(FILE_KIND_BY_EXTENSION);
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((extension) => `.${extension}`).join(",");

export function fileExtension(name: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim());
  return match ? match[1]!.toLowerCase() : "";
}

export function fileKindFromName(name: string): FileKind | null {
  return FILE_KIND_BY_EXTENSION[fileExtension(name)] ?? null;
}

/** Why a file name cannot be uploaded, in the user's words; null when it is acceptable. */
export function unsupportedFileReason(name: string): string | null {
  const extension = fileExtension(name);
  if (FILE_KIND_BY_EXTENSION[extension]) return null;
  if (extension === "doc") return "Old Word format (.doc). Open it in Word, save it as .docx or PDF and upload that.";
  if (extension === "xls") return "Old Excel format (.xls). Save it as .xlsx and upload that.";
  if (extension === "odt" || extension === "ods" || extension === "rtf" || extension === "pages")
    return `.${extension} files are not supported yet. Save it as PDF or .docx/.xlsx and upload that.`;
  if (["png", "jpg", "jpeg", "tif", "tiff", "gif", "heic"].includes(extension))
    return "Images are not supported. Put scanned pages into a PDF and upload that.";
  if (["7z", "rar", "gz", "tar"].includes(extension)) return "Only .zip archives can be expanded. Unpack it and upload the files.";
  return `${extension ? `.${extension} files are` : "This file type is"} not supported. Upload PDF, Word (.docx), Excel (.xlsx), CSV, text or ZIP files.`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
}

export const STANDING_NOTICE = "AI-assisted analysis. Check against the tender documents — you remain responsible for your submission.";

/** Counts words the way buyers do: whitespace-separated tokens. Evidence markers are not words. */
export function countWords(text: string): number {
  // The marker goes together with the space before it, so "monthly [E2]." is one word, not two.
  const cleaned = text.replace(/\s*\[E\d+\]/g, "").trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).length;
}
