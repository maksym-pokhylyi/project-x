import { estimateTokens, MAX_PACK_TOKENS } from "@/features/bids/constants";
import { unitMarker } from "../extract";
import type { TextUnit } from "../extract/types";
import type { PackFile } from "./quote-verify";

export type PackSource = { id: string; name: string; units: TextUnit[] };

export type BuiltPack = {
  /** Text sent to the model: every unit preceded by its <<<FILE | LOC>>> marker. */
  text: string;
  tokens: number;
  /** Files in the text (for citation verification). */
  files: PackFile[];
  /** Ids of files left out because the pack exceeded the size cap. */
  excludedFileIds: string[];
  /** File that had to be cut to fit, if any. */
  truncatedFileId: string | null;
};

const HIGH_PRIORITY = /itt|invitation|tender|instruction|specification|\bspec\b|requirement|question|response|quality|evaluat|criteria|clarif|q\s?&\s?a|\bqa\b|psq|\bsq\b|selection|scope|brief|rfq|quot|award|method|pricing|price|schedule|form/i;
const LOW_PRIORITY = /terms|conditions|t&c|contract|drawing|layout|\bplan\b|\bmap\b|policy|standing.orders|privacy|brochure|photo|moodboard/i;

/** 2 = core tender documents, 1 = unknown, 0 = boilerplate that is dropped first. */
export function filePriority(name: string): number {
  const base = name.split("/").pop() ?? name;
  if (HIGH_PRIORITY.test(base) && !/terms.and.conditions|standard.terms/i.test(base)) return 2;
  if (LOW_PRIORITY.test(base)) return 0;
  return 1;
}

function renderFile(file: PackSource, units: TextUnit[]): string {
  return units
    .filter((unit) => unit.text.trim())
    .map((unit) => `${unitMarker(file.name, unit.loc)}\n${unit.text}`)
    .join("\n\n");
}

/**
 * Builds the pack text for the model, in upload order. When the pack is larger than
 * `maxTokens`, whole files are left out, least relevant and largest first; if a single
 * file is still too large its tail is cut. Nothing is dropped silently: the caller turns
 * `excludedFileIds` / `truncatedFileId` into warnings on the brief.
 */
export function buildPack(sources: PackSource[], maxTokens: number = MAX_PACK_TOKENS): BuiltPack {
  const sized = sources.map((file) => ({ file, tokens: estimateTokens(renderFile(file, file.units)) }));
  let total = sized.reduce((sum, entry) => sum + entry.tokens, 0);
  const excluded = new Set<string>();
  if (total > maxTokens) {
    const droppable = [...sized].sort((a, b) => filePriority(a.file.name) - filePriority(b.file.name) || b.tokens - a.tokens);
    for (const entry of droppable) {
      if (total <= maxTokens) break;
      if (sized.length - excluded.size <= 1) break; // always keep at least one file
      excluded.add(entry.file.id);
      total -= entry.tokens;
    }
  }

  let truncatedFileId: string | null = null;
  const included = sized.filter((entry) => !excluded.has(entry.file.id));
  const parts: string[] = [];
  const files: PackFile[] = [];
  for (const entry of included) {
    let units = entry.file.units;
    if (total > maxTokens) {
      // Still too large (one enormous file): keep as many leading units as fit.
      const allowance = Math.max(0, entry.tokens - (total - maxTokens));
      const kept: TextUnit[] = [];
      let used = 0;
      for (const unit of units) {
        const cost = estimateTokens(unit.text) + 20;
        if (used + cost > allowance && kept.length > 0) break;
        kept.push(unit);
        used += cost;
      }
      if (kept.length < units.length) {
        total -= entry.tokens - used;
        truncatedFileId = entry.file.id;
        units = kept;
      }
    }
    const rendered = renderFile(entry.file, units);
    if (rendered) parts.push(rendered);
    files.push({ id: entry.file.id, name: entry.file.name, units });
  }
  const text = parts.join("\n\n");
  return { text, tokens: estimateTokens(text), files, excludedFileIds: [...excluded], truncatedFileId };
}
