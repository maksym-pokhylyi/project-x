import type { DbOrTx } from "@/db";

/**
 * STAND-IN for `@/features/bids/access` — the bids module is not in this branch.
 *
 * Same names, same signatures and same contract as the real functions, so connecting the
 * bids module is: change the ONE import in ./fulfilment.ts to "@/features/bids/access" and
 * delete this file. Nothing else in the billing code refers to it.
 *
 * Until then a pass exists only as the `billing_purchases` row: granting always "creates"
 * it, and nothing can have been used, so revoking always succeeds.
 */

/** Grants one Bid Pass. Idempotent on `externalRef`; true when a new credit was created. */
export async function grantBidPass(
  _organizationId: string,
  _grant: { source: string; externalRef?: string | null; expiresAt?: Date | null },
  _executor?: DbOrTx,
): Promise<boolean> {
  return true;
}

/** Takes one Bid Pass back unless it was spent: "revoked" | "already_used" | "not_found". */
export async function revokeBidPass(_organizationId: string, _externalRef: string, _executor?: DbOrTx): Promise<"revoked" | "already_used" | "not_found"> {
  return "revoked";
}
