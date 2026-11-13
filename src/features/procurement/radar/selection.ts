import { isCpvCode } from "../domain/cpv";
import { UK_REGIONS } from "../domain/regions";
import { broadTrade } from "../domain/trades";

/**
 * A radar somebody has described but not yet saved: the company name, the ticked trades
 * and regions. It travels in the address of the set-up page —
 *
 *   /app/radar/setup?name=Tidewell+Roofing+Ltd&trade=roofing&trade=building-repairs&region=UKE
 *
 * — so that a visitor who fills in the form on the Find page can sign up, confirm their
 * e-mail and land on the same choices. Reading the address NEVER creates anything: the
 * set-up page shows the selection and one button saves it. PURE and client-safe.
 */
export type RadarSelection = {
  name: string;
  /** Keys of the short trade list (domain/trades.ts). */
  trades: string[];
  /** Other trades, as 8-digit CPV codes. */
  cpv: string[];
  /** Top-level region codes, e.g. "UKE". */
  regions: string[];
};

export const EMPTY_SELECTION: RadarSelection = { name: "", trades: [], cpv: [], regions: [] };

function list(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Keeps only what the form itself could have produced. */
export function cleanSelection(selection: RadarSelection): RadarSelection {
  return {
    name: selection.name.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80),
    trades: [...new Set(selection.trades.filter((key) => broadTrade(key) !== null))],
    cpv: [...new Set(selection.cpv.filter(isCpvCode))].slice(0, 30),
    regions: [...new Set(selection.regions.filter((region) => region in UK_REGIONS))],
  };
}

export function parseSelection(params: Record<string, string | string[] | undefined>): RadarSelection {
  return cleanSelection({ name: list(params.name)[0] ?? "", trades: list(params.trade), cpv: list(params.cpv), regions: list(params.region) });
}

export function hasSelection(selection: RadarSelection): boolean {
  return selection.name.length > 0 || selection.trades.length > 0 || selection.cpv.length > 0 || selection.regions.length > 0;
}

/** Address of the set-up page with the selection filled in. */
export function setupHref(selection: RadarSelection): string {
  const clean = cleanSelection(selection);
  const params = new URLSearchParams();
  if (clean.name) params.set("name", clean.name);
  for (const key of clean.trades) params.append("trade", key);
  for (const code of clean.cpv) params.append("cpv", code);
  for (const region of clean.regions) params.append("region", region);
  const query = params.toString();
  return query ? `/app/radar/setup?${query}` : "/app/radar/setup";
}
