/**
 * The one place the bid desk asks the Radar about a tender notice.
 *
 * `/app/bids/new?tender=<notice id or slug>` (the Radar's "Start a bid check" button) and a
 * pasted Find a Tender link both end up here. The procurement feature is not part of this
 * branch, so the lookup returns null and the page shows the reference only — no invented
 * title, buyer or deadline. AT MERGE, wire it in this file and nowhere else:
 *
 *   import { getTender } from "@/features/procurement";
 *   const tender = await getTender(reference);
 *   return tender ? { id: tender.id, title: tender.title, buyerName: tender.buyerName, reference: tender.noticeIdentifier, closesAt: tender.deadline, url: tender.url } : null;
 */
export type TenderSummary = {
  id: string;
  title: string;
  buyerName: string | null;
  /** The notice identifier as the portal prints it, e.g. "2026/S 000-048213". */
  reference: string | null;
  closesAt: Date | null;
  url: string | null;
};

const NOTICE_REFERENCE = /^[A-Za-z0-9._:\-/]{1,200}$/;

/** A notice id or slug that is safe to store and to put in a URL, or null. */
export function cleanTenderReference(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed && NOTICE_REFERENCE.test(trimmed) ? trimmed : null;
}

/**
 * The notice id in a pasted Find a Tender link ("https://www.find-tender.service.gov.uk/Notice/048213-2026"),
 * or the value itself when it already is a bare notice id. Null for anything else.
 */
export function tenderReferenceFromInput(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!/(^|\.)find-tender\.service\.gov\.uk$/i.test(url.hostname)) return null;
    const match = /\/notice\/([A-Za-z0-9-]{4,60})/i.exec(url.pathname);
    return match ? cleanTenderReference(match[1]) : null;
  } catch {
    return /^\d{6}-\d{4}$/.test(value) ? value : null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the parameter documents the contract until the Radar is merged
export async function lookupTender(reference: string): Promise<TenderSummary | null> {
  return null;
}
