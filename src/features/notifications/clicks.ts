import "server-only";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import { db } from "@/db";
import { notificationLog } from "@/db/schema";
import { track } from "@/lib/analytics";
import { errorReason } from "@/lib/describe-error";
import { log } from "@/lib/logger";

/**
 * "Opened from an e-mail": the only measurement scheduled e-mails have.
 *
 * Tender links in an e-mail end in `?d=<notification_log id>`. When the tender page is
 * requested with it, the SERVER notes — once per tender per e-mail — that the link was
 * followed, and records `digest_clicked`. No pixel, no redirect service, no script, no
 * cookie; whether an e-mail was opened is never known. The sibling of recordPageVisit()
 * in src/features/procurement/visits.ts.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Declared crawlers and link checkers: their requests are not a person following a link. */
const BOT_PATTERN = /bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|curl|wget|python-requests|httpclient|facebookexternalhit|whatsapp|telegram|scan|safelinks|proofpoint|barracuda|mimecast/i;

/** A usable `d` parameter, or null. */
export function cleanNotificationId(value: string | string[] | undefined | null): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && UUID.test(raw) ? raw.toLowerCase() : null;
}

export type RegisteredClick = { kind: string; userId: string; organizationId: string };

/**
 * Marks `ocid` as opened from notification `id` — if that e-mail was sent, listed the
 * tender, and the tender was not marked before. One atomic statement, so two requests at
 * once count one click. Returns whose e-mail it was, or null when nothing was recorded.
 */
export async function registerClick(id: string, ocid: string): Promise<RegisteredClick | null> {
  const listed = JSON.stringify([{ ref: ocid }]);
  const rows = await db
    .update(notificationLog)
    .set({
      clicked: sql`${notificationLog.clicked} || ${JSON.stringify([ocid])}::jsonb`,
      firstClickedAt: sql`coalesce(${notificationLog.firstClickedAt}, now())`,
    })
    .where(sql`${notificationLog.id} = ${id} and ${notificationLog.status} = 'sent' and ${notificationLog.items} @> ${listed}::jsonb and not (${notificationLog.clicked} @> ${JSON.stringify([ocid])}::jsonb)`)
    .returning({ kind: notificationLog.kind, userId: notificationLog.userId, organizationId: notificationLog.organizationId });
  return rows[0] ?? null;
}

/**
 * Call from the tender page's server component: `await recordDigestClick({ ocid, notification: query.d })`.
 * Does nothing without a well-formed `d`; the work happens after the response has been sent.
 * Prefetches and declared crawlers are ignored (the user agent is read here and not stored).
 */
export async function recordDigestClick(input: { ocid: string; notification: string | string[] | undefined | null }): Promise<void> {
  const id = cleanNotificationId(input.notification);
  if (!id) return;
  const requestHeaders = await headers();
  const purpose = `${requestHeaders.get("purpose") ?? ""} ${requestHeaders.get("sec-purpose") ?? ""}`;
  if (requestHeaders.get("next-router-prefetch") || /prefetch|prerender/i.test(purpose)) return;
  const userAgent = requestHeaders.get("user-agent");
  if (!userAgent || BOT_PATTERN.test(userAgent)) return;
  after(async () => {
    try {
      const click = await registerClick(id, input.ocid);
      if (click) await track("digest_clicked", { organizationId: click.organizationId, userId: click.userId }, { kind: click.kind, ocid: input.ocid });
    } catch (error) {
      log.warn("notifications: click not recorded", { reason: errorReason(error) });
    }
  });
}
