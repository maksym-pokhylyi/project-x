import { getDocumentProxy } from "unpdf";
import { LOW_TEXT_CHARS, MAX_PAGES_PER_FILE } from "@/features/bids/constants";
import { cleanText, nonSpaceLength } from "./text";
import { ExtractionError, type ExtractedDocument, type TextUnit } from "./types";

type TextItem = { str?: string; hasEOL?: boolean; transform?: number[]; width?: number };

/**
 * Joins the text items of one PDF page in reading order. pdf.js already emits items in
 * content-stream order with end-of-line flags; we add a space between items on the same
 * line that are visibly apart (table cells), so "Public liability" and "£5,000,000" do not
 * run together.
 */
function pageText(items: TextItem[]): string {
  let out = "";
  let previous: TextItem | null = null;
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    if (previous && !previous.hasEOL && out && !out.endsWith(" ") && !out.endsWith("\n") && !item.str.startsWith(" ")) {
      const prevX = previous.transform?.[4];
      const prevWidth = previous.width ?? 0;
      const x = item.transform?.[4];
      const sameLine = previous.transform?.[5] !== undefined && item.transform?.[5] !== undefined && Math.abs(previous.transform[5] - item.transform[5]) < 2;
      if (!sameLine) out += "\n";
      else if (prevX !== undefined && x !== undefined && x - (prevX + prevWidth) > 1.5) out += " ";
    }
    out += item.str;
    if (item.hasEOL) out += "\n";
    previous = item;
  }
  return cleanText(out);
}

export function looksLikePdf(bytes: Uint8Array): boolean {
  // "%PDF-" within the first kilobyte (some generators prepend junk).
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  return head.includes("%PDF-");
}

/** Text of every page of a PDF, one unit per page ("p1", "p2", …). */
export async function extractPdf(bytes: Uint8Array): Promise<ExtractedDocument> {
  if (!looksLikePdf(bytes)) throw new ExtractionError("This file is not a valid PDF.");
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // pdf.js takes ownership of the buffer it is given: hand it a copy.
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : String(error);
    if (name === "PasswordException" || /password/i.test(message)) {
      throw new ExtractionError("This PDF is password-protected. Remove the password and upload it again.");
    }
    throw new ExtractionError("This PDF could not be opened. It may be damaged — try re-saving or re-downloading it.");
  }

  const totalPages = pdf.numPages;
  const readPages = Math.min(totalPages, MAX_PAGES_PER_FILE);
  const units: TextUnit[] = [];
  const lowTextPages: number[] = [];
  const warnings: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= readPages; pageNumber += 1) {
      let text = "";
      try {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        text = pageText(content.items as TextItem[]);
        page.cleanup();
      } catch {
        warnings.push(`Page ${pageNumber} could not be read.`);
      }
      if (nonSpaceLength(text) < LOW_TEXT_CHARS) lowTextPages.push(pageNumber);
      units.push({ loc: `p${pageNumber}`, text });
    }
  } finally {
    // Free pdf.js resources; the method set differs between pdf.js builds.
    const closable = pdf as unknown as { destroy?: () => Promise<void>; cleanup?: () => Promise<void> };
    await (closable.destroy?.() ?? closable.cleanup?.() ?? Promise.resolve()).catch(() => undefined);
  }
  if (totalPages > readPages) {
    warnings.push(`Only the first ${readPages} of ${totalPages} pages were read.`);
  }
  return { kind: "pdf", units, pages: totalPages, lowTextPages, warnings };
}
