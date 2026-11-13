import "server-only";
import { appUrl } from "@/env";
import type { EmailTemplate } from "@/lib/email/templates";
import { notificationsConfig, type ScheduledKind } from "./config";
import type { RadarEmailContent } from "./content/digest";
import type { ReminderContent } from "./content/reminders";
import type { RenewalContent } from "./content/renewal";
import {
  capLine,
  greeting,
  identityParts,
  previewLine,
  PORTAL_NOTE,
  radarClosing,
  radarIntro,
  radarReason,
  REMINDER_REASON,
  reminderHeadline,
  RENEWAL_BODY,
  RENEWAL_REASON,
  renewalHeadline,
  SECTION_NOTES,
  SIGN_OFF,
} from "./emails/copy";
import type { EmailLink, FooterModel } from "./emails/parts";
import { billingUrl, notificationSettingsUrl, pricingUrl, radarUrl, tenderUrl, unsubscribeLinks } from "./links";
import { londonDaysBetween } from "./time";
import { alertSubject, closesIn, digestSubject, firstName, reminderSubject, renewalSubject } from "./wording";

/**
 * From "what to say" (content/*) to a message: sentences, addresses, subject line and the
 * unsubscribe headers. The e-mail templates only lay the result out.
 */
export type ComposeContext = {
  /** `email`: the address the message goes to; it ties the unsubscribe link to that address. */
  recipient: { userId: string; organizationId: string; name: string | null; email?: string | null };
  /** notification_log id: marks the tender links (`?d=`). Null for previews. */
  notificationId: string | null;
  /**
   * A preview for the founder: no unsubscribe token is minted (the footer links lead to
   * Settings), no List-Unsubscribe headers, and the subject says so.
   */
  preview?: boolean;
  now: Date;
};

export type ComposedEmail = { template: EmailTemplate; headers?: Record<string, string> };

const brand = () => ({ markUrl: `${appUrl}/email/mark.png`, markDarkUrl: `${appUrl}/email/mark-dark.png` });

const UNSUBSCRIBE = "Unsubscribe";
const SETTINGS = "Change what you get";

/**
 * The footer and the List-Unsubscribe headers of one kind of e-mail. Every scheduled e-mail
 * carries the one-click headers; which links the footer shows follows the artboards: the
 * digest and the alert offer "Unsubscribe" and "Change what you get", the deadline reminder
 * "Change what you get", the renewal notice — a billing notice — neither.
 */
function footerFor(kind: ScheduledKind, reason: string, context: ComposeContext): { footer: FooterModel; headers?: Record<string, string> } {
  const settings: EmailLink = { label: SETTINGS, url: notificationSettingsUrl() };
  const base = { reason, signOff: SIGN_OFF, identity: identityParts() };
  if (context.preview) {
    const links = kind === "renewal" ? [] : kind === "reminder" ? [settings] : [{ label: UNSUBSCRIBE, url: notificationSettingsUrl() }, settings];
    return { footer: { ...base, links } };
  }
  const { userId, organizationId, email } = context.recipient;
  const unsubscribe = unsubscribeLinks({ userId, organizationId, kind, email });
  const links = kind === "renewal" ? [] : kind === "reminder" ? [settings] : [{ label: UNSUBSCRIBE, url: unsubscribe.pageUrl }, settings];
  return { footer: { ...base, links }, headers: unsubscribe.headers };
}

const subjectFor = (subject: string, context: ComposeContext) => (context.preview ? `[Preview] ${subject}`.slice(0, 120) : subject);

/** "Closes 26 Nov 2026" inside a sentence: "closes 26 Nov 2026" (the month keeps its capital). */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function composeRadarEmail(content: RadarEmailContent, context: ComposeContext): ComposedEmail {
  const company = content.company.short;
  const { footer, headers } = footerFor(content.kind, radarReason(content.kind, content.company), context);
  const link = (ocid: string) => tenderUrl(ocid, context.notificationId);
  const firstMatch = content.matches.shown[0];
  const firstContract = content.ending.shown[0];
  const copy = { kind: content.kind, since: content.since, now: context.now, firstLookbackDays: notificationsConfig.digest.firstLookbackDays };

  const props = {
    kind: content.kind,
    subject: subjectFor(
      content.kind === "digest" ? digestSubject({ company, matches: content.matches.total, ending: content.ending.total }) : alertSubject({ company, matches: content.matches.total }),
      context,
    ),
    preview: previewLine([
      firstMatch ? `${firstMatch.title}: ${lowerFirst(firstMatch.closes)}` : null,
      !firstMatch && firstContract ? `${firstContract.title}: ${lowerFirst(firstContract.ends)}` : null,
      content.matches.total > 1 ? `and ${content.matches.total - 1} more` : null,
    ]),
    greeting: greeting(firstName(context.recipient.name)),
    intro: radarIntro({ ...copy, company, matches: content.matches.total, ending: content.ending.total }),
    matches: content.matches.shown.length > 0 ? { note: SECTION_NOTES.matches, items: content.matches.shown.map((item) => ({ ...item, url: link(item.ocid) })) } : null,
    // A capped plan: one plain line, nothing else.
    cap: content.locked > 0 ? { text: capLine(content.locked), linkLabel: "See plans", url: pricingUrl() } : null,
    ending: content.ending.shown.length > 0 ? { note: SECTION_NOTES.ending, items: content.ending.shown.map((item) => ({ ...item, url: link(item.ocid) })) } : null,
    saved: content.saved.shown.length > 0 ? { note: SECTION_NOTES.saved, items: content.saved.shown.map((item) => ({ ...item, url: link(item.ocid) })) } : null,
    closing: radarClosing({ ...copy, moreMatches: content.matches.total - content.matches.shown.length, moreEnding: content.ending.total - content.ending.shown.length }),
    radarUrl: radarUrl(),
    ...brand(),
    footer,
  };
  return { template: { name: content.kind === "digest" ? "radar-digest" : "radar-alert", props }, headers };
}

export function composeReminderEmail(content: ReminderContent, context: ComposeContext): ComposedEmail {
  const first = content.items[0]!;
  const single = content.items.length === 1;
  const { footer, headers } = footerFor("reminder", REMINDER_REASON, context);
  const props = {
    subject: subjectFor(reminderSubject({ daysLeft: first.daysLeft, title: first.title, more: content.items.length - 1 }), context),
    preview: previewLine([`${closesIn(first.daysLeft)}: ${first.moment}`, single ? null : `and ${content.items.length - 1} more`]),
    greeting: greeting(firstName(context.recipient.name)),
    headline: reminderHeadline(content.items),
    items: content.items.map((item) => ({
      key: item.key,
      title: item.title,
      buyer: item.buyer,
      // One tender: the sentence above says when; several: each line carries its own count.
      closes: single ? `Closes ${item.moment}` : `${closesIn(item.daysLeft)}: ${item.moment}`,
      progress: item.progress,
      links: [
        { label: item.openLabel ?? "Open on Bidfolio", url: item.url ? new URL(item.url, appUrl).toString() : tenderUrl(item.ocid ?? item.key, context.notificationId) },
        ...(item.noticeUrl ? [{ label: "Notice on Find a Tender", url: item.noticeUrl }] : []),
      ],
    })),
    note: PORTAL_NOTE,
    ...brand(),
    footer,
  };
  return { template: { name: "deadline-reminder", props }, headers };
}

export function composeRenewalEmail(content: RenewalContent, context: ComposeContext): ComposedEmail {
  const { footer, headers } = footerFor("renewal", RENEWAL_REASON, context);
  const daysLeft = londonDaysBetween(context.now, content.renewsAt);
  const props = {
    subject: subjectFor(renewalSubject({ planName: content.planName, daysLeft }), context),
    preview: `Renews on ${content.renewsOn}. Nothing to do if you want to carry on; pause or cancel in two clicks from Billing.`,
    greeting: greeting(firstName(context.recipient.name)),
    headline: renewalHeadline(content),
    facts: [
      { label: "Plan", value: `${content.planName}, annual` },
      ...(content.price ? [{ label: "Price", value: `${content.price} a year, excluding VAT. VAT is added where it applies.` }] : []),
      { label: "Renews on", value: content.renewsOn },
      ...(content.paidWith ? [{ label: "Paid with", value: content.paidWith }] : []),
      // Which plan this is about, for someone who owns more than one workspace.
      ...(content.personalWorkspace ? [] : [{ label: "Workspace", value: content.workspace }]),
    ],
    body: RENEWAL_BODY,
    billingUrl: billingUrl(),
    ...brand(),
    footer,
  };
  return { template: { name: "renewal-reminder", props }, headers };
}
