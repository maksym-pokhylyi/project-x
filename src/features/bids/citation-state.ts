import type { Citation } from "@/features/bids/types";

/**
 * What our own check found for a citation — shown on every source chip:
 *   verified    the quote is in the extracted text of the pack, word for word
 *   check       most of the quote matches, or the quote is there but the stated figure is not
 *   unverified  the quote could not be found (or the item came without one)
 *
 * Plain functions in a plain module: server components call them too, which they could not
 * if these lived in the client component file that draws the chip.
 */
export type VerificationState = "verified" | "check" | "unverified";

export function verificationState(citation: Citation): VerificationState {
  if (citation.issue === "figure_not_in_source") return "check";
  if (!citation.verified) return "unverified";
  return citation.match === "fuzzy" ? "check" : "verified";
}

export const VERIFICATION_LABELS: Record<VerificationState, string> = { verified: "Verified", check: "Check", unverified: "Unverified" };
