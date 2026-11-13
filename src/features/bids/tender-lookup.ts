/**
 * Tender references as the bid desk handles them: `/app/bids/new?tender=<ocid or notice id>`
 * (the Radar's "Start a bid" button sends `?notice=<ocid>`) and a pasted Find a Tender link.
 * Pure helpers, safe for client components; the lookup itself is in ./server/tender.ts.
 */
export type TenderSummary = {
  id: string;
  title: string;
  buyerName: string | null;
  /** The notice identifier as Find a Tender prints it, e.g. "048213-2026". */
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
