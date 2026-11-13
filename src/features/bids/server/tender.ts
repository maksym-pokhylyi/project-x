import "server-only";
import { getTender } from "@/features/procurement/queries/notices";
import { errorReason } from "@/lib/describe-error";
import { log } from "@/lib/logger";
import type { TenderSummary } from "../tender-lookup";

/**
 * The one place the bid desk asks the Radar about a tender notice. `reference` is an ocid
 * or a Find a Tender notice id. Null when the notice is not in our data (or the lookup
 * fails): the page then shows the reference only — never an invented title or deadline.
 */
export async function lookupTender(
  reference: string,
): Promise<TenderSummary | null> {
  try {
    const tender = await getTender(reference);
    if (!tender) return null;
    return {
      id: tender.ocid,
      title: tender.title,
      buyerName: tender.buyerName,
      reference: tender.releaseId,
      closesAt: tender.deadlineAt ? new Date(tender.deadlineAt) : null,
      url: tender.noticeUrl,
    };
  } catch (error) {
    log.warn("bids: tender lookup failed", { reason: errorReason(error) });
    return null;
  }
}
