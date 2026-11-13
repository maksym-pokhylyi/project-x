import "server-only";
import type { NotificationItemRef } from "@/db/schema";
import { formatDate } from "@/features/procurement/domain/format";
import { regionsLabel } from "@/features/procurement/domain/regions";
import type { EndingSoonItem } from "@/features/procurement/queries/contracts";
import type { MatchItem } from "@/features/procurement/queries/matches";
import type { NoticeCard } from "@/features/procurement/queries/shared";
import type { OrgContext } from "@/server/session";
import { notificationsConfig } from "../config";
import { lastCutoff, listedSince } from "../log";
import { daysLeftLabel, previousSlot, shiftLondonDays } from "../time";
import { clipTitle, formatContractValue, formatEstimate } from "../wording";
import { selectDigestMatches, selectEndingSoon } from "./matches";
import { endingKey, loadRadarSnapshot, type RadarLabel } from "./radar";

/**
 * What a weekly digest or a daily alert says, for one member of one workspace.
 *
 * NEW means: on the member's radar now, and not there when their last e-mail was computed.
 *  - a matching tender is new when we first saw it after that moment (and it is a STRONG
 *    match the plan shows — ./matches.ts decides that);
 *  - a rival contract is new to "ending soon" when we first saw it after that moment OR its
 *    end date has since come inside the 12-month window;
 *  - nothing an earlier e-mail listed is listed again, and a tender the workspace has
 *    already saved is not announced to it as new.
 * Saved tenders that close within 14 days are a standing section: shown when the e-mail
 * goes out, but never the reason for sending one (the deadline reminders do that job).
 */

/** A tender as an e-mail shows it. Plain strings: the templates do no formatting of their own. */
export type TenderLine = {
  ocid: string;
  title: string;
  buyer: string | null;
  /** "est. £640,000"; null when no value was published. */
  value: string | null;
  /** "Closes 8 Jan 2027" */
  closes: string;
  /** "53 days left" */
  left: string | null;
  /** Why it matches, as one plain line. Null for saved tenders. */
  reason: string | null;
};

export type ContractLine = {
  ocid: string;
  supplierId: string;
  title: string;
  /** "Held by Greaves Hollin Contractors Ltd" */
  heldBy: string;
  buyer: string | null;
  /** "£2,100,000"; null when not published for this supplier alone. */
  value: string | null;
  /** "Ends 31 Mar 2027" */
  ends: string;
};

export type RadarEmailContent = {
  kind: "digest" | "alert";
  /** The instant the lists were read: stored with the log row, and the next e-mail starts here. */
  asOf: Date;
  company: RadarLabel;
  planName: string;
  /** What "new" was measured against. `first`: no earlier e-mail, so a fixed lookback. */
  since: { at: Date; first: boolean };
  matches: { shown: TenderLine[]; total: number };
  ending: { shown: ContractLine[]; total: number };
  saved: { shown: TenderLine[]; total: number };
  /** Strong matches beyond the plan's cap. 0 on plans without one. */
  locked: number;
  /** Everything this e-mail counts as new, plus the saved tenders it lists, as ids (stored in notification_log.items). */
  refs: NotificationItemRef[];
};

// ---------------------------------------------------------------------------
// The member's own filters (PURE)
// ---------------------------------------------------------------------------

export type ArrangeInput = {
  /** Fresh strong matches from every radar source of the workspace. */
  matches: MatchItem[];
  /** Fresh ending-soon contracts from every source, each source in the radar's order. */
  ending: EndingSoonItem[];
  /** Refs earlier e-mails to this member listed. */
  listed: { matches: ReadonlySet<string>; ending: ReadonlySet<string> };
  /** Tenders the workspace has saved: it knows them already. */
  savedOcids: ReadonlySet<string>;
};

/**
 * Drops what the member has already been told or has saved, and puts the rest in reading
 * order: tenders soonest closing first (a tender matched by two radars counts once, with its
 * better score); contracts stay in the radar's order, closest to the member's trade first.
 */
export function arrangeNew(input: ArrangeInput): { matches: MatchItem[]; ending: EndingSoonItem[] } {
  const best = new Map<string, MatchItem>();
  for (const item of input.matches) {
    if (input.listed.matches.has(item.ocid) || input.savedOcids.has(item.ocid)) continue;
    const known = best.get(item.ocid);
    if (!known || item.score > known.score) best.set(item.ocid, item);
  }
  const matches = [...best.values()].sort((a, b) => (a.deadlineAt ?? "9999").localeCompare(b.deadlineAt ?? "9999") || b.score - a.score || a.ocid.localeCompare(b.ocid));

  const seen = new Set<string>();
  const ending = input.ending.filter((item) => {
    const key = endingKey(item);
    if (seen.has(key) || input.listed.ending.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { matches, ending };
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

export function tenderLine(card: NoticeCard & { reason?: string }, now: Date): TenderLine {
  const deadline = card.deadlineAt ? new Date(card.deadlineAt) : null;
  const region = regionsLabel(card.regions);
  const reason = card.reason ? [card.reason, region].filter(Boolean).join(" · ") : null;
  return {
    ocid: card.ocid,
    title: clipTitle(card.title),
    buyer: card.buyerName,
    value: formatEstimate(card.valueAmount, card.currency),
    closes: deadline ? `Closes ${formatDate(deadline)}` : "Closing date not published",
    left: deadline ? daysLeftLabel(deadline, now) : null,
    reason,
  };
}

export function contractLine(item: EndingSoonItem): ContractLine {
  return {
    ocid: item.ocid,
    supplierId: item.supplierId,
    title: clipTitle(item.title),
    heldBy: `Held by ${item.supplierLabel}`,
    buyer: item.buyerName,
    value: formatContractValue(item.valueAmount),
    ends: `Ends ${formatDate(item.contractEnd)}`,
  };
}

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

/** Upper bound on the ids one log row keeps per section. */
const MAX_REFS = 300;

export type BuildOptions = {
  /** Previews: treat everything on the radar as new and ignore what earlier e-mails listed. */
  everything?: boolean;
};

async function build(kind: "digest" | "alert", ctx: OrgContext, now: Date, options: BuildOptions): Promise<RadarEmailContent | null> {
  const withEnding = kind === "digest";
  const snapshot = await loadRadarSnapshot(ctx, now);
  if (!snapshot.label) return null;
  const { digest, alert } = notificationsConfig;
  const userId = ctx.user.id;
  const organizationId = ctx.organization.id;

  // Matches: news since the member's last digest OR alert, so the two never repeat each
  // other. Contracts ending soon only appear in digests: news since the last digest.
  const firstDigestFrom = shiftLondonDays(now, -digest.firstLookbackDays);
  const firstFallback = kind === "digest" ? firstDigestFrom : (previousSlot("alert", now)?.scheduledFor ?? shiftLondonDays(now, -1));
  const [lastRadarEmail, lastDigest] = options.everything
    ? [null, null]
    : await Promise.all([lastCutoff(userId, organizationId, ["digest", "alert"], now), withEnding ? lastCutoff(userId, organizationId, ["digest"], now) : null]);
  const epoch = new Date(0);
  const matchesSince = options.everything ? epoch : (lastRadarEmail ?? firstFallback);
  const endingSince = options.everything ? epoch : (lastDigest ?? firstDigestFrom);
  const select = { now, excludeOcids: snapshot.dismissed, ...(options.everything ? { overlapMs: 0 } : {}) };

  const freshMatches: MatchItem[] = [];
  const freshEnding: EndingSoonItem[] = [];
  let locked = 0;
  for (const source of snapshot.sources) {
    const selected = await selectDigestMatches(ctx, source, matchesSince, select);
    freshMatches.push(...selected.fresh);
    locked += selected.locked;
    if (withEnding) freshEnding.push(...(await selectEndingSoon(ctx, source, endingSince, select)));
  }

  const earliest = new Date(Math.min(matchesSince.getTime(), endingSince.getTime()) - 86_400_000);
  const listed = options.everything ? [] : await listedSince(userId, organizationId, ["digest", "alert"], earliest);
  const selection = arrangeNew({
    matches: freshMatches,
    ending: freshEnding,
    listed: {
      matches: new Set(listed.filter((item) => item.t === "match").map((item) => item.ref)),
      ending: new Set(listed.filter((item) => item.t === "ending").map((item) => endingKey({ ocid: item.ref, supplierId: item.supplier ?? "" }))),
    },
    savedOcids: options.everything ? new Set() : snapshot.savedOcids,
  });
  if (selection.matches.length === 0 && selection.ending.length === 0) return null;

  const shownMatches = selection.matches.slice(0, kind === "digest" ? digest.maxMatches : alert.maxMatches);
  // The contracts closest to the member's trade are picked; they are then read soonest first.
  const shownEnding = selection.ending.slice(0, digest.maxEndingSoon).sort((a, b) => (a.contractEnd ?? "").localeCompare(b.contractEnd ?? "") || a.ocid.localeCompare(b.ocid));
  const savedClosing = kind === "digest" ? snapshot.savedClosing : [];
  const shownSaved = savedClosing.slice(0, digest.maxSavedClosing);

  return {
    kind,
    asOf: now,
    company: snapshot.label,
    planName: snapshot.access.planName,
    // Previews measure against nothing; they are worded like a first e-mail.
    since: { at: options.everything ? firstFallback : matchesSince, first: lastRadarEmail === null },
    matches: { shown: shownMatches.map((item) => tenderLine(item, now)), total: selection.matches.length },
    ending: { shown: shownEnding.map(contractLine), total: selection.ending.length },
    saved: { shown: shownSaved.map((card) => tenderLine(card, now)), total: savedClosing.length },
    locked,
    // Everything counted as new is recorded, shown or not: none of it is news a second time.
    refs: [
      ...selection.matches.slice(0, MAX_REFS).map((item): NotificationItemRef => ({ t: "match", ref: item.ocid })),
      ...selection.ending.slice(0, MAX_REFS).map((item): NotificationItemRef => ({ t: "ending", ref: item.ocid, supplier: item.supplierId })),
      ...shownSaved.map((card): NotificationItemRef => ({ t: "saved", ref: card.ocid })),
    ],
  };
}

/** The weekly digest for the member in `ctx`, or null when there is nothing new to say. */
export function buildDigest(ctx: OrgContext, now: Date, options: BuildOptions = {}): Promise<RadarEmailContent | null> {
  return build("digest", ctx, now, options);
}

/** The daily alert: new matches only. Null when there are none. */
export function buildAlert(ctx: OrgContext, now: Date, options: BuildOptions = {}): Promise<RadarEmailContent | null> {
  return build("alert", ctx, now, options);
}
