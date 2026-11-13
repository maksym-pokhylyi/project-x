import "server-only";
import type { OrgContext } from "./session";

/**
 * What a workspace may still do with bids: the ONE adapter through which Billing, the trial
 * strip and the checkout confirmation read the bid numbers.
 *
 * The numbers belong to the bids module. When it is merged, this function delegates to its
 * `getBidAccess()` and maps the result onto the shape below; nothing else in the billing UI
 * has to change. Until then it returns null and every card renders its designed "not
 * counted yet" state, never an invented figure.
 */
export type BidAllowance = {
  fullBids: {
    /** Full bids the plan gives each billing period (0 on plans without them). */
    limit: number;
    used: number;
    remaining: number;
    /** Unused bids carried over from the previous period: "1 … rolled over from October: use it by 30 Nov 2026". */
    rolledOver: { count: number; fromLabel: string; useBy: Date } | null;
    /** When the allowance renews: the billing date. Null when it does not renew. */
    renewsAt: Date | null;
  };
  /** Cited bid checks on their own (a full bid includes its check). `limit` null = no limit. */
  checks: { limit: number | null; used: number; remaining: number | null; renewsAt: Date | null };
  /** Unused Bid Passes: each adds one full bid and does not expire while the account is open. */
  bidPasses: number;
  /** The one free cited bid check every workspace gets is still unused. */
  freeCheckAvailable: boolean;
};

/** The bid allowance of the active workspace, or null while the bids module is not connected. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the context is the contract: the real implementation reads the workspace from it
export async function getBidAllowance(ctx: OrgContext): Promise<BidAllowance | null> {
  return null;
}
