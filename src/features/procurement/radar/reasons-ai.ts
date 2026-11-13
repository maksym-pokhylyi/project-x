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
import { isAcceptableReason } from "../domain/reasons";
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
 * Model: env AI_MODEL_MATCH_REASON (default openai/gpt-5-nano).
 */

const INSTRUCTIONS = `You write one-sentence reasons that explain why a public tender is relevant to a UK supplier.

Rules:
- Plain British English, second person ("your"), one sentence of at most 24 words.
- Anchor each reason to a fact given to you: one of the supplier's past awards (buyer, value, year, subject) or a specific term in the tender.
- Factual only. Never predict success, never say "perfect", "ideal", "guaranteed" or "you should bid".
- Do not invent buyers, values, dates or capabilities. If nothing specific links the two, say what they have in common in the same trade.
- No names of people, no e-mail addresses, no URLs.

Return ONLY a JSON array, one object per tender, in the same order: [{"i": 1, "reason": "..."}]`;

function buildPrompt(spec: RadarSpec, references: Awaited<ReturnType<typeof getReferenceAwards>>, items: MatchItem[]): string {
  const awards = references
    .slice(0, 8)
    .map((award) => `- ${award.title.slice(0, 110)} | ${award.buyerName ?? "buyer not stated"} | ${formatMoneyShort(award.valueAmount) ?? "value not published"} | ${award.date.slice(0, 4)}`)
    .join("\n");
  const tenders = items
    .map(
      (item, index) =>
        `${index + 1}. ${item.title.slice(0, 140)} | ${item.buyerName ?? "buyer not stated"} | ${formatMoneyShort(item.valueAmount, item.currency) ?? "value not published"} | ${regionsLabel(item.regions) ?? "region not stated"} | ${item.cpvLabel ?? "category not stated"} | rule-based reason: ${item.reason}`,
    )
    .join("\n");
  return [
    `Supplier: ${spec.label}`,
    spec.keywords.length > 0 ? `Keywords from its awards: ${spec.keywords.slice(0, 10).join(", ")}` : null,
    awards ? `Past awards (title | buyer | value | year):\n${awards}` : "The supplier has described its trade manually; there are no past awards.",
    `Open tenders (title | buyer | value | region | category | rule-based reason):\n${tenders}`,
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
    const references = spec.supplierId ? await getReferenceAwards(spec.supplierId, 8) : [];
    const result = await generateAiText({
      organizationId: payer.organizationId,
      userId: payer.userId ?? null,
      feature: "radar-match-reasons",
      model: procurementConfig.matchReasonModel,
      instructions: INSTRUCTIONS,
      prompt: buildPrompt(spec, references, items),
      // Small reasoning models spend part of the budget thinking before they answer.
      maxOutputTokens: 4000,
      abortSignal: AbortSignal.timeout(45_000),
    });
    const reasons = parseReasons(result.text, items.length);
    const rows = [...reasons].map(([index, reason]) => ({ profileKey: spec.key, ocid: items[index]!.ocid, reason, model: result.model }));
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
