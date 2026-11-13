import "server-only";
import { appUrl } from "@/env";
import type { NotificationKind } from "./config";
import { signUnsubscribeToken } from "./tokens";

/**
 * Every address a scheduled e-mail points to. Plain links to our own pages: no redirect
 * service, no tracking pixel. The only measurement is the `d` parameter on tender links,
 * which the tender page records on the server (see ./clicks.ts).
 */

/** The public tender page; `notificationId` (a notification_log id) marks the e-mail it was opened from. */
export function tenderUrl(ocid: string, notificationId: string | null): string {
  const base = `${appUrl}/tenders/${encodeURIComponent(ocid)}`;
  return notificationId ? `${base}?d=${encodeURIComponent(notificationId)}` : base;
}

export const radarUrl = () => `${appUrl}/app`;
export const notificationSettingsUrl = () => `${appUrl}/app/settings/notifications`;
export const pricingUrl = () => `${appUrl}/pricing`;
export const billingUrl = () => `${appUrl}/app/settings/billing`;

export type UnsubscribeLinks = {
  /** The confirmation page linked from the footer ("Unsubscribe"). Opening it changes nothing. */
  pageUrl: string;
  /** The RFC 8058 endpoint mail clients POST to. */
  oneClickUrl: string;
  /** `List-Unsubscribe` + `List-Unsubscribe-Post`, for sendEmail({ headers }). */
  headers: Record<string, string>;
};

/**
 * Unsubscribe links for one member, workspace and kind. Exported for other modules too: a
 * "your bid check is ready" e-mail passes kind "product" and gets the same footer links
 * and headers as the scheduled e-mails.
 *
 * `email` is the address the message is sent to. Pass it: the confirmation page then shows
 * that address and offers "Subscribe again" (see ./tokens.ts for why it is tied to it).
 */
export function unsubscribeLinks(subject: { userId: string; organizationId: string; kind: NotificationKind; email?: string | null }): UnsubscribeLinks {
  const token = encodeURIComponent(signUnsubscribeToken(subject));
  const oneClickUrl = `${appUrl}/api/notifications/unsubscribe?t=${token}`;
  return {
    pageUrl: `${appUrl}/unsubscribe?t=${token}`,
    oneClickUrl,
    headers: {
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
