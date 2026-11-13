import type { FileKind } from "@/features/bids/constants";
import { extractDocx } from "./docx";
import { extractPdf } from "./pdf";
import { extractCsv, extractTxt, extractXlsx } from "./sheet";
import { ExtractionError, type ExtractedDocument } from "./types";

export { expandZip } from "./zip";
export { ExtractionError } from "./types";
export type { ExtractedDocument, StoredText, TextUnit } from "./types";

/**
 * Reads one document into citable text units. Pure CPU work: no storage, no model calls.
 * Throws ExtractionError with a message that can be shown to the user.
 */
export async function extractDocument(kind: Exclude<FileKind, "zip">, bytes: Uint8Array): Promise<ExtractedDocument> {
  if (bytes.byteLength === 0) throw new ExtractionError("This file is empty.");
  switch (kind) {
    case "pdf":
      return extractPdf(bytes);
    case "docx":
      return extractDocx(bytes);
    case "xlsx":
      return extractXlsx(bytes);
    case "csv":
      return extractCsv(bytes);
    case "txt":
      return extractTxt(bytes);
  }
}

/** Marker placed before every unit of pack text sent to the model. */
export function unitMarker(fileName: string, loc: string): string {
  return `<<<FILE: ${fileName} | LOC: ${loc}>>>`;
}
