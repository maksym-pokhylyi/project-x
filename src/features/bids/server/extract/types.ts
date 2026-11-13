import type { FileKind } from "@/features/bids/constants";

/**
 * One citable chunk of a document: a PDF page ("p3"), a section of a Word/text file ("s2")
 * or a spreadsheet sheet ("sheet:Pricing").
 */
export type TextUnit = {
  loc: string;
  text: string;
  /** True when the text was transcribed by the model from a page without a text layer. */
  transcribed?: boolean;
};

export type ExtractedDocument = {
  kind: Exclude<FileKind, "zip">;
  units: TextUnit[];
  /** Pages (PDF), sections (Word/text/CSV) or sheets (Excel) in the source. */
  pages: number;
  /** 1-based PDF pages with (almost) no text layer. */
  lowTextPages: number[];
  /** Things the user should know (truncated, pages skipped…). */
  warnings: string[];
};

/** What is stored next to the source file (JSON) once it has been read. */
export type StoredText = {
  version: 1;
  units: TextUnit[];
};

/** A user-facing extraction failure ("password-protected", "not a real PDF"…). */
export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}
