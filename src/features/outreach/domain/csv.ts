/**
 * CSV for files the founder opens in a spreadsheet (PURE).
 *
 *  - RFC 4180: every field quoted, quotes doubled, records end with CRLF, line breaks inside
 *    a field are CRLF too (a letter body is one multi-line field).
 *  - UTF-8 with a byte-order mark, so Excel does not read "–" and "£" as mojibake.
 *  - Formula injection: a cell that starts with = + - @, a tab or a carriage return is
 *    executed as a formula by Excel, LibreOffice and Google Sheets. Company names and
 *    contract titles come from notices anyone can publish, so such a cell gets a leading
 *    apostrophe, which spreadsheets show as text.
 */
export const CSV_BOM = "﻿";

const FORMULA_START = /^[=+\-@\t\r]/;

/** The text of one cell, made safe to open in a spreadsheet (before quoting). */
export function guardCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value).replace(/\u0000/g, "");
  return FORMULA_START.test(text) ? `'${text}` : text;
}

/** One quoted field. */
export function csvField(value: string | number | null | undefined): string {
  const text = guardCell(value)
    .replace(/\r\n|\r|\n/g, "\r\n")
    .replace(/"/g, '""');
  return `"${text}"`;
}

/** A whole file: BOM, header row, records. */
export function toCsv(header: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  const lines = [header, ...rows].map((row) => row.map(csvField).join(","));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}

/**
 * Reads CSV text back into rows (quoted fields, doubled quotes, line breaks inside fields,
 * optional BOM). Used by the bounce-list import and by tests of the export.
 */
export function parseCsv(text: string): string[][] {
  const input = text.startsWith(CSV_BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field === "") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += char;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
