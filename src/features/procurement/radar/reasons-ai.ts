import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { matchReasons } from "@/db/schema";
import { generateAiText } from "@/lib/ai";
import { runInBackground } from "@/lib/background";
import { log } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { procurementConfig } from "../config";
import { formatMoneyShort } from "../domain/money";
import type { RadarSpec } from "../domain/profile";
import { closestReference, isAcceptableReason, isGroundedReason, type ReferenceAward } from "../domain/reasons";
import { regionsLabel } from "../domain/regions";
import { bulkUpsert } from "../ingest/sql";
import { getReferenceAwards, type MatchItem } from "../queries/matches";

/**
 * Optional upgrade of match reasons for the top matches: one model call writes a sentence
 * per notice, the result is validated and cached in `match_reasons` (profile + ocid), and
 * later page loads read the cache. The deterministic reason stays the fallback in every
 * failure mode: no gateway, budget exhausted, timeout, malformed or unacceptable output.
 *
 * Calls go through src/lib/ai.ts, so they are budgeted per workspace and logged in ai_usage.
 * Model: env AI_MODEL_MATCH_REASON (default google/gemini-2.5-flash-lite).
 */

const INSTRUCTIONS = `You explain, in one sentence each, why an open public tender is relevant to a UK supplier.

For every tender you are given the supplier's closest past award. Start with the work the tender asks for, in a few plain words, then link it to that award.

Rules:
- Plain British English, second person ("your"), ONE sentence of at most 24 words.
- Start with the work itself, not with "This". Do not repeat the tender title word for word.
- Use only facts given to you: the tender's subject, buyer and region; the past award's subject, buyer, value and year.
- State a £ value only when one is given for the past award, exactly as written. A year is never a value.
- Never predict success and never say "perfect", "ideal", "guaranteed" or "you should bid".
- Do not invent buyers, values, dates or capabilities. No names of people, no e-mail addresses, no URLs.

Examples:
"Grass cutting and tree works for a parish council, close to your £656k tree maintenance contract with the London Borough of Hillingdon."
"Pest control across council housing, the same service you deliver for West Kent Housing Association."

Return ONLY a JSON array, one object per tender, in the same order: [{"i": 1, "reason": "..."}]`;

type Prepared = { item: MatchItem; reference: ReferenceAward | null; line: string };

function prepare(items: MatchItem[], references: ReferenceAward[]): Prepared[] {
  return items.map((item, index) => {
    const reference = closestReference(item, references);
    const keyword = item.breakdown.keywordHits[0];
    const value = reference ? formatMoneyShort(reference.valueAmount) : null;
    const link = reference
      ? `closest past award: "${reference.title.slice(0, 100)}" for ${reference.buyerName ?? "a buyer not stated"}, ${value ? `value ${value}` : "value not published (do not state one)"}, awarded ${reference.date.slice(0, 4)}`
      : keyword
        ? `shares the term "${keyword}" with the supplier's work`
        : `same trade: ${item.cpvLabel ?? "see category"}`;
    const line = `${index + 1}. ${item.title.slice(0, 140)} | buyer: ${item.buyerName ?? "not stated"} | region: ${regionsLabel(item.regions) ?? "not stated"} | category: ${item.cpvLabel ?? "not stated"} | ${link}`;
    return { item, reference, line };
  });
}

function buildPrompt(spec: RadarSpec, prepared: Prepared[], hasAwards: boolean): string {
  return [
    `Supplier: ${spec.label}`,
    spec.keywords.length > 0 ? `Terms from its awards: ${spec.keywords.slice(0, 10).join(", ")}` : null,
    hasAwards ? null : "The supplier described its trade manually; it has no published awards.",
    `Open tenders:\n${prepared.map((entry) => entry.line).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Parses the model output; tolerant of code fences and surrounding prose. */
export function parseReasons(text: string, count: number): Map<number, string> {
  const out = new Map<number, string>();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return out;
  }
  if (!Array.isArray(parsed)) return out;
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const index = Number((entry as { i?: unknown }).i);
    const reason = (entry as { reason?: unknown }).reason;
    if (!Number.isInteger(index) || index < 1 || index > count || !isAcceptableReason(reason)) continue;
    out.set(index - 1, reason.trim().replace(/\s+/g, " "));
  }
  return out;
}

/**
 * Writes and caches reasons for the given matches that only have a rule-based reason.
 * Returns how many were cached. Never throws.
 */
export async function generateMatchReasons(payer: { organizationId: string; userId?: string | null }, spec: RadarSpec, matches: MatchItem[]): Promise<number> {
  const items = matches.filter((item) => item.reasonSource === "rule").slice(0, procurementConfig.aiReasonLimit);
  if (items.length === 0) return 0;
  try {
    const references = spec.supplierId ? await getReferenceAwards(spec.supplierId, 40) : [];
    const prepared = prepare(items, references);
    const result = await generateAiText({
      organizationId: payer.organizationId,
      userId: payer.userId ?? null,
      feature: "radar-match-reasons",
      model: procurementConfig.matchReasonModel,
      instructions: INSTRUCTIONS,
      prompt: buildPrompt(spec, prepared, references.length > 0),
      // 15 one-sentence reasons fit in well under 1,000 tokens. (Reasoning models such as gpt-5-nano spend
      // the whole allowance thinking and return nothing usable; the default model does not reason.)
      maxOutputTokens: 1500,
      abortSignal: AbortSignal.timeout(45_000),
    });
    const reasons = parseReasons(result.text, items.length);
    const rows = [...reasons]
      // Keep only sentences whose figures are the ones we supplied; the rule-based reason stays for the rest.
      .filter(([index, reason]) => {
        const reference = prepared[index]!.reference;
        return isGroundedReason(reason, { amounts: [reference ? formatMoneyShort(reference.valueAmount) : null], years: [reference?.date.slice(0, 4) ?? null] });
      })
      .map(([index, reason]) => ({ profileKey: spec.key, ocid: items[index]!.ocid, reason, model: result.model }));
    await bulkUpsert(db, matchReasons, rows, { columns: ["profileKey", "ocid", "reason", "model"], conflict: ["profileKey", "ocid"] });
    log.info("match reasons cached", { profile: spec.key, asked: items.length, cached: rows.length, model: result.model, costUsd: result.usage.costUsd });
    return rows.length;
  } catch (error) {
    log.warn("match reasons skipped", { profile: spec.key, reason: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return 0;
  }
}

/**
 * Fire-and-forget version for page renders: at most one attempt per profile every ten
 * minutes, after the response has been sent.
 */
export function scheduleMatchReasons(payer: { organizationId: string; userId?: string | null }, spec: RadarSpec, matches: MatchItem[]): void {
  if (!matches.some((item) => item.reasonSource === "rule")) return;
  runInBackground("radar.match-reasons", async () => {
    const gate = await rateLimit(`match-reasons:${spec.key}`, { limit: 1, windowSeconds: 600 });
    if (!gate.ok) return;
    await generateMatchReasons(payer, spec, matches);
  });
}

/** Drops cached reasons for procurements that are no longer live (housekeeping). */
export async function purgeStaleMatchReasons(): Promise<void> {
  await db.execute(sql`
    delete from match_reasons m
    where m.created_at < now() - interval '14 days'
      and not exists (select 1 from notices n where n.ocid = m.ocid and n.is_latest and n.stage = 'tender' and n.deadline_at > now())
  `);
}
