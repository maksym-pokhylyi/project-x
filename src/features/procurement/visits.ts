import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { db } from "@/db";
import { pageVisits } from "@/db/schema";
import { track } from "@/lib/analytics";
import { errorReason } from "@/lib/describe-error";
import { log } from "@/lib/logger";

/**
 * Page-visit measurement for public data pages.
 *
 * It is a server-side log of the request and nothing else: page type, entity id and the
 * optional `?r=` outreach code. No pixel, no script, no cookie, no IP address, no user
 * agent, no fingerprint (docs/research/round2/P2 §1.2: tracking pixels fall under PECR's
 * storage/access rules; counting a page request on the server does not).
 *
 * THE CODE STAYS FIRST-PARTY. One code belongs to one prospect — one company's mailbox —
 * so it is personal data whenever that mailbox is a person's (P2 §1.2). It is written to
 * `page_visits`, which the outreach results read, and to nothing else: the analytics event
 * says only whether the visit came through an outreach link (`track()` may forward events
 * to PostHog), and a failure is logged without its bound values.
 */

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|curl|wget|python-requests|httpclient|facebookexternalhit|whatsapp|telegram/i;
const REF_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

/** A usable outreach reference code, or null. */
export function cleanRefCode(value: string | string[] | undefined | null): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && REF_PATTERN.test(raw) ? raw : null;
}

export type PageVisitInput = { pageType: "supplier" | "buyer" | "tender"; entityId: string; refCode: string | null };

/**
 * Records the visit after the response has been sent. Prefetches are ignored; declared
 * crawlers are flagged (from the user agent, which is read here and not stored).
 * Call from a page's server component.
 */
export async function recordPageVisit(input: PageVisitInput): Promise<void> {
  const requestHeaders = await headers();
  const purpose = `${requestHeaders.get("purpose") ?? ""} ${requestHeaders.get("sec-purpose") ?? ""}`;
  if (requestHeaders.get("next-router-prefetch") || /prefetch|prerender/i.test(purpose)) return;
  const isBot = BOT_PATTERN.test(requestHeaders.get("user-agent") ?? "") || !requestHeaders.get("user-agent");
  after(async () => {
    try {
      await db.insert(pageVisits).values({ pageType: input.pageType, entityId: input.entityId, refCode: input.refCode, isBot });
      if (!isBot && input.pageType === "supplier") {
        await track("supplier_page_viewed", {}, { supplier: input.entityId, via: input.refCode ? "outreach" : "direct" });
      }
    } catch (error) {
      // Never `error.message`: a failed insert quotes its parameters, the code among them.
      log.warn("page visit not recorded", { pageType: input.pageType, reason: errorReason(error) });
    }
  });
}
