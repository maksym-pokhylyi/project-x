import mammoth from "mammoth";
import { cleanText, splitIntoSections } from "./text";
import { ExtractionError, type ExtractedDocument } from "./types";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) return String.fromCodePoint(parseInt(entity.slice(2), 16) || 32);
    if (entity.startsWith("#")) return String.fromCodePoint(Number(entity.slice(1)) || 32);
    return ENTITIES[entity] ?? whole;
  });
}

const HEADING_PREFIX = "⁣"; // invisible marker so sections can break at headings

/**
 * Converts mammoth's small HTML vocabulary (p, h1–h6, ul/ol/li, table/tr/td/th, br, inline
 * tags) to plain text that keeps what matters for citing: headings on their own line,
 * list numbering for ordered lists, and table rows as "cell | cell".
 */
export function htmlToText(html: string): string {
  const out: string[] = [];
  const listStack: Array<{ ordered: boolean; index: number }> = [];
  let tableDepth = 0;
  let row: string[] | null = null;
  let cell: string | null = null;
  let line = "";

  const pushText = (text: string) => {
    if (cell !== null) cell += text;
    else line += text;
  };
  const endBlock = (gap = true) => {
    if (cell !== null) {
      // Block boundaries inside a table cell become " / " so the row stays on one line.
      if (cell.trim() && !cell.trimEnd().endsWith("/")) cell = `${cell.trimEnd()} / `;
      return;
    }
    if (line.trim()) out.push(line.trim());
    if (gap && out.length && out[out.length - 1] !== "") out.push("");
    line = "";
  };

  const tokens = html.split(/(<[^>]+>)/g);
  for (const token of tokens) {
    if (!token) continue;
    if (!token.startsWith("<")) {
      pushText(decodeEntities(token).replace(/\s+/g, " "));
      continue;
    }
    const match = /^<\s*(\/)?\s*([a-zA-Z0-9]+)/.exec(token);
    if (!match) continue;
    const closing = Boolean(match[1]);
    const tag = match[2]!.toLowerCase();
    switch (tag) {
      case "p":
        endBlock(tableDepth === 0 && listStack.length === 0);
        break;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        endBlock();
        if (!closing && cell === null) line = HEADING_PREFIX;
        break;
      case "br":
        if (cell !== null) cell += " / ";
        else {
          if (line.trim()) out.push(line.trim());
          line = "";
        }
        break;
      case "ul":
      case "ol":
        endBlock(false);
        if (closing) {
          listStack.pop();
          if (listStack.length === 0 && cell === null && out[out.length - 1] !== "") out.push("");
        } else listStack.push({ ordered: tag === "ol", index: 0 });
        break;
      case "li": {
        endBlock(false);
        if (!closing) {
          const top = listStack[listStack.length - 1];
          if (top) top.index += 1;
          const indent = "  ".repeat(Math.max(0, listStack.length - 1));
          const numbering = listStack
            .filter((entry) => entry.ordered)
            .map((entry) => entry.index)
            .join(".");
          pushText(`${indent}${top?.ordered ? `${numbering}.` : "-"} `);
        }
        break;
      }
      case "table":
        endBlock();
        tableDepth += closing ? -1 : 1;
        break;
      case "tr":
        if (closing) {
          if (row && row.some((value) => value.trim())) out.push(row.map((value) => value.trim().replace(/\s*\/\s*$/, "")).join(" | "));
          row = null;
        } else if (tableDepth > 0) row = [];
        break;
      case "td":
      case "th":
        if (closing) {
          if (row && cell !== null) row.push(cell.replace(/\s+/g, " "));
          cell = null;
        } else if (row) cell = "";
        break;
      default:
        break; // inline formatting, images, anchors: keep the text only
    }
  }
  endBlock();
  return cleanText(out.join("\n"));
}

/** Text of a .docx file, split into citable sections ("s1", "s2", …). */
export async function extractDocx(bytes: Uint8Array): Promise<ExtractedDocument> {
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new ExtractionError("This is not a .docx file. Old .doc files must be saved as .docx or PDF first.");
  }
  let html: string;
  try {
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) }, { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) });
    html = result.value;
  } catch {
    throw new ExtractionError("This Word document could not be read. Try saving it again as .docx or PDF.");
  }
  const marked = htmlToText(html);
  const units = splitIntoSections(marked, (firstLine) => firstLine.startsWith(HEADING_PREFIX)).map((unit) => ({
    ...unit,
    text: unit.text.replaceAll(HEADING_PREFIX, ""),
  }));
  return { kind: "docx", units, pages: units.length, lowTextPages: [], warnings: [] };
}
