import { site } from "@/config/site";
import type { FooterModel } from "./parts";

/**
 * Plain-text versions (PURE). Written by hand from the same model as the HTML — not derived
 * from it — so the text part reads as a letter: one fact per line, every link written out.
 */

/** Blocks separated by one empty line; empty blocks are dropped. */
export function textBlocks(blocks: Array<string | null | undefined | false>): string {
  return blocks
    .filter((block): block is string => typeof block === "string" && block.trim().length > 0)
    .map((block) => block.trimEnd())
    .join("\n\n");
}

export function textLines(lines: Array<string | null | undefined | false>): string {
  return lines.filter((line): line is string => typeof line === "string" && line.length > 0).join("\n");
}

export function textHeading(title: string, note?: string | null): string {
  return textLines([title, "-".repeat(title.length), note]);
}

export function textFooter(footer: FooterModel): string {
  return textBlocks([
    "--",
    `${footer.reason} ${footer.signOff}`,
    textLines(footer.links.map((link) => `${link.label}: ${link.url}`)),
    footer.identity.map((part) => part.text).join(""),
  ]);
}

export function textDocument(body: Array<string | null | undefined | false>, footer: FooterModel): string {
  return `${textBlocks([site.name, ...body, textFooter(footer)])}\n`;
}
