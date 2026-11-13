import readXlsxFile from "read-excel-file/node";
import { MAX_SHEET_CHARS, MAX_SHEET_ROWS, MAX_SHEETS } from "@/features/bids/constants";
import { cleanText, decodeText, splitIntoSections } from "./text";
import { ExtractionError, type ExtractedDocument, type TextUnit } from "./types";

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Math.round(value * 1e6) / 1e6);
  return String(value)
    .replace(/\r\n?|\n/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Renders rows as "A1: value | B1: value" lines (empty cells skipped), with caps. */
export function rowsToText(rows: unknown[][]): { text: string; truncatedRows: number } {
  const lines: string[] = [];
  let chars = 0;
  let nonEmptyRows = 0;
  let truncatedRows = 0;
  rows.forEach((row, rowIndex) => {
    const cells: string[] = [];
    row.forEach((value, columnIndex) => {
      const text = cellText(value);
      if (text) cells.push(`${columnLetter(columnIndex)}${rowIndex + 1}: ${text}`);
    });
    if (cells.length === 0) return;
    nonEmptyRows += 1;
    if (nonEmptyRows > MAX_SHEET_ROWS || chars > MAX_SHEET_CHARS) {
      truncatedRows += 1;
      return;
    }
    const line = cells.join(" | ");
    chars += line.length;
    lines.push(line);
  });
  if (truncatedRows > 0) lines.push(`[SHEET TRUNCATED: ${truncatedRows} further non-empty rows not shown]`);
  return { text: lines.join("\n"), truncatedRows };
}

/** Sanitises a sheet name for use in a location marker. */
function sheetLoc(name: string): string {
  return `sheet:${name.replace(/[<>|\n\r]/g, " ").trim() || "Sheet"}`;
}

/** Text of an .xlsx workbook, one unit per sheet ("sheet:Pricing"). */
export async function extractXlsx(bytes: Uint8Array): Promise<ExtractedDocument> {
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new ExtractionError("This is not an .xlsx file. Old .xls files must be saved as .xlsx first.");
  }
  let sheets: Awaited<ReturnType<typeof readXlsxFile>>;
  try {
    sheets = await readXlsxFile(Buffer.from(bytes));
  } catch {
    throw new ExtractionError("This spreadsheet could not be read. Try saving it again as .xlsx.");
  }
  const units: TextUnit[] = [];
  const warnings: string[] = [];
  const used = new Set<string>();
  for (const sheet of sheets.slice(0, MAX_SHEETS)) {
    const { text, truncatedRows } = rowsToText(sheet.data as unknown[][]);
    let loc = sheetLoc(sheet.sheet);
    for (let suffix = 2; used.has(loc); suffix += 1) loc = `${sheetLoc(sheet.sheet)} (${suffix})`;
    used.add(loc);
    if (truncatedRows > 0) warnings.push(`Sheet “${sheet.sheet}” is long: ${truncatedRows} rows were not read.`);
    units.push({ loc, text: cleanText(text) });
  }
  if (sheets.length > MAX_SHEETS) warnings.push(`Only the first ${MAX_SHEETS} of ${sheets.length} sheets were read.`);
  return { kind: "xlsx", units, pages: sheets.length, lowTextPages: [], warnings };
}

/** Minimal RFC 4180 CSV parser (quoted fields, embedded newlines, "" escapes). */
export function parseCsv(text: string, maxRows = MAX_SHEET_ROWS * 4): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : firstLine.split("\t").length > firstLine.split(",").length ? "\t" : ",";
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (rows.length >= maxRows) return rows;
    } else field += char;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** A CSV file as one "sheet" unit. */
export function extractCsv(bytes: Uint8Array): ExtractedDocument {
  const rows = parseCsv(decodeText(bytes).replace(/^﻿/, ""));
  const { text, truncatedRows } = rowsToText(rows);
  const warnings = truncatedRows > 0 ? [`This CSV is long: ${truncatedRows} rows were not read.`] : [];
  return { kind: "csv", units: [{ loc: "sheet:CSV", text: cleanText(text) }], pages: 1, lowTextPages: [], warnings };
}

/** A plain-text file, split into sections. */
export function extractTxt(bytes: Uint8Array): ExtractedDocument {
  const units = splitIntoSections(decodeText(bytes).replace(/^﻿/, ""));
  return { kind: "txt", units, pages: units.length, lowTextPages: [], warnings: [] };
}
