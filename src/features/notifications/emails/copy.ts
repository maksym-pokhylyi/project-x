import { site } from "@/config/site";
import { INDEPENDENCE_STATEMENT, OGL_ATTRIBUTION } from "@/features/procurement/config";
import { describeSince, londonDaysBetween } from "../time";
import { capitalise, countOf, numberWord } from "../wording";
import type { IdentityPart } from "./parts";

/**
 * The sentences of the scheduled e-mails (PURE).
 * Voice (DESIGN.md §2): plain British English, second person, short sentences, numbers
 * before adjectives; "tender", "buyer", "contract". No urgency that is not a date, no
 * promise, nothing that implies a win.
 */

const isPlaceholder = (text: string) => text.includes("[[");

/**
 * The identity line under every e-mail, as in the artboard: who operates the service, how
 * to reach them, the UK representative, who takes payments, the licence of the data and
 * the independence statement. Names and addresses come from src/config/site.ts — still
 * placeholders there until the owner fills them in, and shown as such.
 */
export function identityParts(): IdentityPart[] {
  const { company, facts } = site;
  return [
    { text: `${site.name} is operated by ` },
    { text: company.legalName, placeholder: isPlaceholder(company.legalName) },
    { text: `, an independent sole trader based in ${facts.operatorCountry}. Contact: ${site.supportEmail} · UK representative: ` },
    { text: company.ukRepresentative, placeholder: isPlaceholder(company.ukRepresentative) },
    { text: ` · Payments are processed by Paddle. · ${OGL_ATTRIBUTION} · ${INDEPENDENCE_STATEMENT}` },
  ];
}

export const identityText = () => identityParts().map((part) => part.text).join("");

const agree = (count: number, singular: string, plural: string) => (count === 1 ? singular : plural);

type Since = { at: Date; first: boolean };

/** How the tenders are placed in time: "{tenders} match X this week" · "{tenders} from the last seven days match X" · "{tenders} since Friday match X". */
function placed(tenders: string, verb: string, company: string, since: Since, now: Date, firstLookbackDays: number): string {
  if (since.first) return `${tenders} from the last ${numberWord(firstLookbackDays)} days ${verb} ${company}`;
  const days = londonDaysBetween(since.at, now);
  if (days >= 6 && days <= 8) return `${tenders} ${verb} ${company} this week`;
  return `${tenders} since ${describeSince(since.at, now)} ${verb} ${company}`;
}

export type RadarCopyInput = {
  kind: "digest" | "alert";
  company: string;
  matches: number;
  ending: number;
  since: Since;
  now: Date;
  firstLookbackDays: number;
};

/**
 * Digest: "Three new tenders match Aldermoor & Pike this week, and two contracts held by
 * others are coming to an end."  Alert: "Since yesterday, two new tenders match Aldermoor & Pike."
 */
export function radarIntro(input: RadarCopyInput): string {
  const { company, matches, ending } = input;
  const verb = agree(matches, "matches", "match");
  const tenders = `${numberWord(matches)} new ${agree(matches, "tender", "tenders")}`;
  if (input.kind === "alert") return `Since ${describeSince(input.since.at, input.now)}, ${tenders} ${verb} ${company}.`;
  const contracts = `${numberWord(ending)} ${agree(ending, "contract held by others is", "contracts held by others are")} coming to an end`;
  const lead = (subject: string, itsVerb: string) => capitalise(placed(subject, itsVerb, company, input.since, input.now, input.firstLookbackDays));
  if (matches > 0 && ending > 0) return `${lead(tenders, verb)}, and ${contracts}.`;
  if (matches > 0) return `${lead(tenders, verb)}.`;
  return `${lead("no new tenders", "match")}, but ${contracts}.`;
}

/**
 * "That is everything new since last Monday." — or, when the lists were cut, what the radar
 * shows beyond them: "This email lists the first few. Your radar shows 7 more new tenders
 * and 4 more contracts ending soon." (Worded as what the radar SHOWS, so that it cannot be
 * taken for the capped plan's line about matches the plan does not show.)
 */
export function radarClosing(input: { since: Since; now: Date; firstLookbackDays: number; moreMatches: number; moreEnding: number; kind: "digest" | "alert" }): string {
  const more: string[] = [];
  if (input.moreMatches > 0) more.push(countOf(input.moreMatches, "more new tender"));
  if (input.moreEnding > 0) more.push(`${countOf(input.moreEnding, "more contract")} ending soon`);
  if (more.length > 0) return `This email lists the first few. Your radar shows ${more.join(" and ")}.`;
  if (input.since.first && input.kind === "digest") return `That is everything new in the last ${numberWord(input.firstLookbackDays)} days.`;
  return `That is everything new since ${describeSince(input.since.at, input.now)}.`;
}

/** The one line a capped plan gets: "4 more matches are waiting on your radar." */
export function capLine(locked: number): string {
  return `${countOf(locked, "more match", "more matches")} ${agree(locked, "is", "are")} waiting on your radar.`;
}

export const SECTION_NOTES = {
  matches: "Matched on category, buyer and region. Soonest closing date first.",
  ending: "Work like yours, held by someone else. A new tender usually comes before a contract ends.",
  saved: "Tenders you saved that close within 14 days.",
} as const;

/** Why the reader gets a digest or an alert. */
export function radarReason(kind: "digest" | "alert", company: { full: string; otherSources: number }): string {
  const radar = company.otherSources > 0 ? `${company.full} and ${countOf(company.otherSources, "other radar profile")}` : company.full;
  const how = kind === "digest" ? "once a week" : "on working days when there is something new";
  return `You get this ${how} because you have a ${site.name} radar for ${radar}${/[.!?]$/.test(radar) ? "" : "."}`;
}

export function greeting(name: string | null): string {
  return name ? `${name},` : "Hello,";
}

/** Replies reach a person, and every e-mail says so. */
export const SIGN_OFF = "Reply to this email if anything looks wrong.";

// ---------------------------------------------------------------------------
// Deadline reminder (docs/design/handoff/EmailDeadline-640.dc.html)
// ---------------------------------------------------------------------------

/** "in 2 days", "tomorrow", "today" */
const inDays = (days: number) => (days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);

/**
 * "This tender closes in 3 days." · "These two tenders close in 7 days." ·
 * "Three tenders are closing: one in 2 days and two in 7 days."
 */
export function reminderHeadline(items: ReadonlyArray<{ daysLeft: number }>): string {
  if (items.length === 1) return `This tender closes ${inDays(items[0]!.daysLeft)}.`;
  const groups = new Map<number, number>();
  for (const item of items) groups.set(item.daysLeft, (groups.get(item.daysLeft) ?? 0) + 1);
  if (groups.size === 1) return `These ${numberWord(items.length)} tenders close ${inDays(items[0]!.daysLeft)}.`;
  const parts = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([days, count]) => `${numberWord(count)} ${inDays(days)}`);
  return `${capitalise(numberWord(items.length))} tenders are closing: ${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}.`;
}

export const PORTAL_NOTE = "Bids go in through the buyer’s own portal. Leave time to upload.";

export const REMINDER_REASON = "You get deadline reminders for tenders you have saved and bids you are working on, 7 days and 2 days before each one closes.";

// ---------------------------------------------------------------------------
// Annual-renewal reminder (docs/design/handoff/EmailRenewal-640.dc.html)
// ---------------------------------------------------------------------------

/** "Your Bid Desk annual plan renews on 27 Nov 2027 for £1,490 (plus VAT where it applies)." The price only when we hold it. */
export function renewalHeadline(input: { planName: string; renewsOn: string; price: string | null }): string {
  const price = input.price ? ` for ${input.price} (plus VAT where it applies)` : "";
  return `Your ${input.planName} annual plan renews on ${input.renewsOn}${price}.`;
}

/** Deliberately no refund sentence: the 14-day refund covers a first subscription payment only. */
export const RENEWAL_BODY = "Nothing to do if you want to carry on. Pause or cancel in two clicks from Billing. You keep access until the end of the period you have paid for.";

export const RENEWAL_REASON = "We email this reminder seven days before an annual plan renews.";

/** Text for the preview line of a mail client: the soonest tender, or the first contract. */
export function previewLine(parts: Array<string | null | undefined>, max = 120): string {
  const text = parts.filter(Boolean).join(" · ");
  return text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}
