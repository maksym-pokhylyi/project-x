import "server-only";
import { getBidAccess } from "@/features/bids/access";
import { log } from "@/lib/logger";
import type { OrgContext } from "./session";

/**
 * What a workspace may still do with bids: the ONE adapter through which Billing, Usage and
 * the checkout confirmation read the bid numbers.
 *
 * The numbers belong to the bids module (src/features/bids/access.ts): it counts them from
 * the bids themselves, in windows that renew on the billing date. This function maps its
 * summary onto the shape below and nothing else in the billing UI knows where they come
 * from. It returns null when they cannot be read; every card then renders its designed
 * "not counted" state, never an invented figure.
 */
export type BidAllowance = {
  fullBids: {
    /** Full bids the plan gives each billing period (0 on plans without them; null = no limit). In a trial: for the whole trial. */
    limit: number | null;
    /** Taken from this period's own allowance. Carried-over bids are used first and are not counted here, so "used of limit" is true as written. */
    used: number;
    /** Left now, carried-over bids included. Null = no limit. */
    remaining: number | null;
    /** Unused bids carried over from the previous period: "1 … rolled over from October: use it by 30 Nov 2026". */
    rolledOver: { count: number; fromLabel: string; useBy: Date } | null;
    /** When the allowance renews: the billing date. Null when the plan gives no full bids, so nothing renews. */
    renewsAt: Date | null;
    /** True during the trial: `limit` is for the whole trial, and `renewsAt` is when it ends. */
    trial: boolean;
  };
  /** Cited bid checks on their own (a full bid includes its check). `limit` null = no limit. */
  checks: { limit: number | null; used: number; remaining: number | null; renewsAt: Date | null };
  /** Unused Bid Passes: each adds one full bid and does not expire while the account is open. */
  bidPasses: number;
  /** The one free cited bid check every workspace gets is still unused. */
  freeCheckAvailable: boolean;
};

/** The bid allowance of the active workspace, or null when it cannot be read. */
export async function getBidAllowance(ctx: OrgContext): Promise<BidAllowance | null> {
  try {
    const access = await getBidAccess(ctx.organization.id);
    const renews = (limit: number | null, at: Date) => (limit === 0 ? null : at);
    const { limit, remaining, rolledOver } = access.fullBids;
    // The module counts every bid taken in the window; what is left of the plan's own allowance is the rest minus the carry-over still unused.
    const usedOfPlan = limit === null || remaining === null ? access.fullBids.used : Math.min(limit, Math.max(0, limit - (remaining - (rolledOver?.count ?? 0))));
    return {
      fullBids: {
        limit,
        used: usedOfPlan,
        remaining: access.fullBids.remaining,
        rolledOver: access.fullBids.rolledOver,
        renewsAt: renews(access.fullBids.limit, access.fullBids.renewsAt),
        trial: access.fullBids.trial,
      },
      checks: {
        limit: access.checks.limit,
        used: access.checks.used,
        remaining: access.checks.remaining,
        renewsAt: renews(access.checks.limit, access.checks.renewsAt),
      },
      bidPasses: access.bidPasses,
      freeCheckAvailable: access.freeCheckAvailable,
    };
  } catch (error) {
    // Billing and Usage must still open when the count cannot be read.
    log.warn("bid allowance could not be read", { organizationId: ctx.organization.id, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
