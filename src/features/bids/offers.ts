/**
 * What the upgrade panels offer. Prices are the owner-approved ones on the artboards (GBP,
 * excluding VAT) and live here only, so billing can take them over in one place. The
 * buttons go to the billing page with a query parameter; the checkout itself is wired there.
 */
export const OFFERS = {
  bidPass: { name: "Bid Pass", price: "£99", cadence: "one-off", action: "Buy a Bid Pass", href: "/app/settings/billing?buy=bid_pass" },
  trial: { name: "Bid Desk, 14-day trial", price: "£149", cadence: "a month after the trial", action: "Start the 14-day trial", href: "/app/settings/billing?plan=pro" },
  plus: { name: "Bid Desk Plus", price: "£349", cadence: "a month", action: "Move to Bid Desk Plus", href: "/app/settings/billing?plan=business" },
} as const;

export const PLANS_URL = "/pricing";
/** A plan with at least this many full bids a window is the top plan: there is nothing to move up to. */
export const TOP_PLAN_FULL_BIDS = 10;
