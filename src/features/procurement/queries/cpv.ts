import "server-only";
import { sql } from "drizzle-orm";
import { CPV_DIVISIONS, isCpvCode } from "../domain/cpv";
import { db, getCpvLabels, queryRows } from "./shared";

export type TradeOption = { code: string; label: string };

/** The 45 CPV divisions with plain-English names, as whole-division codes ("45000000"). */
export function commonTrades(): TradeOption[] {
  return Object.entries(CPV_DIVISIONS)
    .map(([division, label]) => ({ code: `${division}000000`, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Trade picker search: plain-English division names first, then official CPV labels seen
 * in notices (substring or trigram match, shorter and broader codes first).
 */
export async function searchTrades(query: string, limit = 30): Promise<TradeOption[]> {
  const term = query.trim().toLowerCase().slice(0, 80);
  if (term.length < 2) return commonTrades();
  const divisions = commonTrades().filter((option) => option.label.toLowerCase().includes(term));
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await queryRows<{ code: string; label: string }>(
    db,
    sql`
      select code, label from cpv_codes
      where lower(label) like ${pattern} or ${term} <% lower(label)
      order by (lower(label) like ${pattern}) desc, (right(code, 4) = '0000') desc, length(label) asc, code asc
      limit ${limit}
    `,
  );
  const seen = new Set(divisions.map((option) => option.code));
  return [...divisions, ...rows.filter((row) => isCpvCode(row.code) && !seen.has(row.code))].slice(0, limit);
}

/** Labels for stored codes (edit form): the plain-English name for whole divisions, the official label otherwise. */
export async function labelTrades(codes: readonly string[]): Promise<TradeOption[]> {
  const labels = await getCpvLabels(codes);
  return codes.filter(isCpvCode).map((code) => ({
    code,
    label: /^\d{2}000000$/.test(code) ? (CPV_DIVISIONS[code.slice(0, 2)] ?? labels.get(code) ?? code) : (labels.get(code) ?? CPV_DIVISIONS[code.slice(0, 2)] ?? code),
  }));
}
