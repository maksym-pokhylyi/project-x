import "server-only";
import { radarAccess } from "@/features/procurement/access";
import type { RadarSpec } from "@/features/procurement/domain/profile";
import { getEndingSoonForSpec, type EndingSoonItem } from "@/features/procurement/queries/contracts";
import { getMatchesForSpec, type MatchItem } from "@/features/procurement/queries/matches";
import { specForSource, type RadarSource } from "@/features/procurement/radar/data";
import type { OrgContext } from "@/server/session";
import { notificationsConfig } from "../config";
import { contractFirstSeen, endingKey, tenderFirstSeen } from "./radar";

/**
 * WHICH TENDERS AN E-MAIL MAY MENTION — decided here and nowhere else.
 *
 * `selectDigestMatches()` is the only call into the radar's match query from this module.
 * It answers one question for one radar source of a workspace: "which matching tenders are
 * good enough to write to someone about, visible on their plan, and new since `since`?"
 *
 * ── INTERIM, TO BE REPLACED AT MERGE ────────────────────────────────────────────────────
 * The radar lists every tender above its minimum score, which for a supplier with a single
 * framework award can be several hundred. Only STRONG matches belong in an e-mail. The
 * query layer is getting match tiers (`{ tier: "strong" | "all" }`); until it has them,
 * `isStrongMatch()` below applies a conservative rule to the score breakdown the query
 * already returns. When the tier option exists: pass `tier: "strong"` in the one query
 * call marked below and delete `isStrongMatch` — nothing else changes.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The plan's cap is applied to the STRONG list in the radar's order (best first): a capped
 * plan is e-mailed about its ten strongest matches, and `locked` counts the strong ones
 * beyond them ("4 more matches are waiting on your radar").
 */

/** Interim definition of a strong match (measured on real data: a median of 2 open strong matches per supplier, 19 at the 90th percentile). */
export const STRONG_MATCH = {
  /** Overall score: trade (CPV) overlap, wording, region and size together. The radar's own floor is 0.30. */
  minScore: 0.55,
  /** How far down the ranked list to look. Matches arrive best first, so the strong ones are at the top. */
  scanLimit: 200,
} as const;

/**
 * A match worth an e-mail: a high overall score, in a place the supplier works. A tender in
 * a region the profile has never worked in, or of unknown place while the profile names its
 * regions, is left to the radar.
 */
export function isStrongMatch(item: Pick<MatchItem, "score" | "breakdown">, spec: Pick<RadarSpec, "regions">): boolean {
  if (item.score < STRONG_MATCH.minScore) return false;
  const region = item.breakdown.regionMatch;
  if (region === "local" || region === "nationwide") return true;
  // A radar without a regional preference ("anywhere in the UK") has no place to be wrong about.
  return region === "unknown" && spec.regions.length === 0;
}

/** True when something we first saw at `firstSeen` is news relative to `since` (which starts `overlapMs` early, see config.overlapMinutes). */
export function seenAfter(firstSeen: Date | undefined, since: Date, overlapMs: number = notificationsConfig.overlapMinutes * 60_000): boolean {
  return firstSeen !== undefined && firstSeen.getTime() > since.getTime() - overlapMs;
}

/** The same instant a number of calendar months later (day clamped to the month's length), as Postgres adds an interval. */
export function addMonths(date: Date, months: number): Date {
  const moved = new Date(date.getTime());
  const day = moved.getUTCDate();
  moved.setUTCDate(1);
  moved.setUTCMonth(moved.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(moved.getUTCFullYear(), moved.getUTCMonth() + 1, 0)).getUTCDate();
  moved.setUTCDate(Math.min(day, lastDay));
  return moved;
}

/**
 * True when a contract's end date has come inside the "ending soon" window since `since`:
 * it ends later than the window reached back then.
 */
export function enteredWindow(contractEnd: string | null, since: Date, months: number, overlapMs: number = notificationsConfig.overlapMinutes * 60_000): boolean {
  if (!contractEnd) return false;
  return Date.parse(contractEnd) > addMonths(new Date(since.getTime() - overlapMs), months).getTime();
}

export type SelectOptions = {
  now: Date;
  /** Procurements the workspace dismissed: never mentioned. */
  excludeOcids?: readonly string[];
  overlapMs?: number;
};

export type DigestMatches = {
  /** Strong matches the plan shows that are new since `since`, in the radar's order (best first). */
  fresh: MatchItem[];
  /** Strong matches beyond the plan's cap. 0 on plans without a cap. */
  locked: number;
};

export async function selectDigestMatches(ctx: OrgContext, source: RadarSource, since: Date, options: SelectOptions): Promise<DigestMatches> {
  const spec = await specForSource(source);
  if (!spec) return { fresh: [], locked: 0 };
  const cap = radarAccess(ctx.entitlements).matchLimit;

  // ↓ The one query call. At merge: add `tier: "strong"` here and drop the filter after it.
  const result = await getMatchesForSpec(spec, { limit: STRONG_MATCH.scanLimit, excludeOcids: options.excludeOcids, now: options.now });
  const strong = result.items.filter((item) => isStrongMatch(item, spec));

  const visible = cap === null ? strong : strong.slice(0, cap);
  const firstSeen = await tenderFirstSeen(visible.map((item) => item.ocid));
  return {
    fresh: visible.filter((item) => seenAfter(firstSeen.get(item.ocid), since, options.overlapMs)),
    locked: strong.length - visible.length,
  };
}

/**
 * Rival contracts in the source's trade that are new to "ending soon" since `since`: first
 * seen after it, or with an end date that has since come inside the window. The radar's
 * order is kept (closest to the member's trade and region first); a capped plan sees as
 * many as its Ending soon tab shows.
 */
export async function selectEndingSoon(ctx: OrgContext, source: RadarSource, since: Date, options: SelectOptions): Promise<EndingSoonItem[]> {
  const spec = await specForSource(source);
  if (!spec) return [];
  const cap = radarAccess(ctx.entitlements).matchLimit;
  const months = notificationsConfig.digest.endingSoonMonths;
  const result = await getEndingSoonForSpec(spec, months, { limit: cap ?? notificationsConfig.digest.endingSoonScanLimit, now: options.now });
  const firstSeen = await contractFirstSeen(result.items);
  return result.items.filter((item) => seenAfter(firstSeen.get(endingKey(item)), since, options.overlapMs) || enteredWindow(item.contractEnd, since, months, options.overlapMs));
}
