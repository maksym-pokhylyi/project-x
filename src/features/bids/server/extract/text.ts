import type { TextUnit } from "./types";

/** Tidies text extracted from a document without changing its words. */
export function cleanText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}

export function nonSpaceLength(text: string): number {
  return text.replace(/\s/g, "").length;
}

const SECTION_TARGET_CHARS = 3200;
const SECTION_MAX_CHARS = 4800;

/**
 * Splits a document that has no pages (Word, text, CSV) into citable sections "s1", "s2", …
 * of roughly a page each. Breaks fall on blank lines; a heading line (as marked by
 * `isHeading`) starts a new section once the current one is at least half full.
 */
export function splitIntoSections(text: string, isHeading: (line: string) => boolean = () => false): TextUnit[] {
  const blocks = cleanText(text)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const sections: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) sections.push(current.trim());
    current = "";
  };
  for (const block of blocks) {
    const firstLine = block.split("\n", 1)[0] ?? "";
    const startsWithHeading = isHeading(firstLine);
    if (current && ((startsWithHeading && current.length >= SECTION_TARGET_CHARS / 2) || current.length + block.length > SECTION_MAX_CHARS)) {
      flush();
    }
    if (block.length > SECTION_MAX_CHARS) {
      // A single huge block (e.g. a text file without blank lines): cut on line breaks.
      flush();
      let piece = "";
      for (const line of block.split("\n")) {
        if (piece && piece.length + line.length > SECTION_TARGET_CHARS) {
          sections.push(piece.trim());
          piece = "";
        }
        if (line.length > SECTION_MAX_CHARS) {
          for (let offset = 0; offset < line.length; offset += SECTION_TARGET_CHARS) sections.push(line.slice(offset, offset + SECTION_TARGET_CHARS));
        } else {
          piece += `${line}\n`;
        }
      }
      if (piece.trim()) sections.push(piece.trim());
      continue;
    }
    current += current ? `\n\n${block}` : block;
    if (current.length >= SECTION_TARGET_CHARS) flush();
  }
  flush();
  return sections.map((section, index) => ({ loc: `s${index + 1}`, text: section }));
}

/** Decodes a text file: UTF-8 (with or without BOM), UTF-16 with BOM, else Windows-1252. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
