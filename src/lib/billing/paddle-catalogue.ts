import {
  BID_PASS,
  BID_PASS_PRICE_ENV_VAR,
  BILLING_INTERVALS,
  PAID_PLAN_KEYS,
  PLANS,
  PLAN_CURRENCY,
  paddlePriceEnvVar,
  type BillingInterval,
  type PaidPlanKey,
} from "@/config/plans";
import { site } from "@/config/site";

/**
 * PURE planning logic behind `pnpm paddle:setup` (no network, no env): given the plan
 * catalogue and what already exists in Paddle, decide what to create/update/archive.
 * Unit-tested in tests/paddle-catalogue.test.ts; executed by scripts/paddle-setup.ts.
 *
 * What is synced, all of it from src/config/plans.ts:
 *   - one product per paid plan, with a monthly and an annual price in PLAN_CURRENCY;
 *     a plan with `trialDays` gets that trial on both prices (card required);
 *   - one product for the Bid Pass, with a single one-off price (no billing cycle).
 *
 * Paddle objects are matched through `custom_data` written by this tool, never by name:
 *   product: { app: <APP_TAG>, plan: "starter" }
 *   price:   { app: <APP_TAG>, plan: "starter", interval: "month" }
 *   the Bid Pass: plan "bid_pass", interval "once"
 * (single lowercase words as keys on purpose: they survive the SDK's camelCase/snake_case conversion).
 */
export const APP_TAG = "saas-foundation";

/** Something sold through Paddle: a paid plan, or the one-off Bid Pass. */
export type CatalogueKey = PaidPlanKey | typeof BID_PASS.key;
/** How a price bills: every month, every year, or once. */
export type PriceInterval = BillingInterval | "once";

export const CATALOGUE_KEYS: CatalogueKey[] = [...PAID_PLAN_KEYS, BID_PASS.key];

export type RemoteProduct = { id: string; name: string; description: string | null; status: string; customData: Record<string, unknown> | null };
export type RemotePrice = {
  id: string;
  productId: string;
  status: string;
  amount: string;
  currencyCode: string;
  /** Billing cycle; null for a one-off price. */
  interval: string | null;
  frequency: number | null;
  /** Trial before the first payment; null when the price has none. */
  trial: { interval: string; frequency: number } | null;
  customData: Record<string, unknown> | null;
};

export type DesiredProduct = { plan: CatalogueKey; name: string; description: string; customData: Record<string, string> };
export type DesiredPrice = {
  plan: CatalogueKey;
  interval: PriceInterval;
  /** Minor units as a string, the format the Paddle API expects ("2900" = £29.00). */
  amount: string;
  currencyCode: typeof PLAN_CURRENCY;
  /** Days of trial before the first payment; null for none. */
  trialDays: number | null;
  name: string;
  description: string;
  customData: Record<string, string>;
};

export function desiredProducts(): DesiredProduct[] {
  return [
    ...PAID_PLAN_KEYS.map((plan) => ({
      plan,
      name: `${site.name} ${PLANS[plan].name}`,
      description: PLANS[plan].description,
      customData: { app: APP_TAG, plan },
    })),
    {
      plan: BID_PASS.key,
      name: `${site.name} ${BID_PASS.name}`,
      description: BID_PASS.description,
      customData: { app: APP_TAG, plan: BID_PASS.key },
    },
  ];
}

export function desiredPrices(): DesiredPrice[] {
  const subscriptions = PAID_PLAN_KEYS.flatMap((plan) =>
    BILLING_INTERVALS.map((interval): DesiredPrice => {
      const prices = PLANS[plan].prices;
      if (!prices) throw new Error(`Paid plan "${plan}" has no prices in src/config/plans.ts`);
      return {
        plan,
        interval,
        amount: String(prices[interval]),
        currencyCode: PLAN_CURRENCY,
        trialDays: PLANS[plan].trialDays ?? null,
        name: interval === "month" ? "Monthly" : "Annual",
        description: `${PLANS[plan].name} — ${interval === "month" ? "monthly" : "annual"}`,
        customData: { app: APP_TAG, plan, interval },
      };
    }),
  );
  const bidPass: DesiredPrice = {
    plan: BID_PASS.key,
    interval: "once",
    amount: String(BID_PASS.price),
    currencyCode: PLAN_CURRENCY,
    trialDays: null,
    name: "One-off",
    description: `${BID_PASS.name} — one full bid, paid once`,
    customData: { app: APP_TAG, plan: BID_PASS.key, interval: "once" },
  };
  return [...subscriptions, bidPass];
}

function isOurs(customData: Record<string, unknown> | null): boolean {
  return customData?.app === APP_TAG;
}

export function findProduct(products: RemoteProduct[], plan: CatalogueKey): RemoteProduct | undefined {
  return products.find((product) => product.status === "active" && isOurs(product.customData) && product.customData?.plan === plan);
}

export type ProductAction =
  | { type: "create"; desired: DesiredProduct }
  | { type: "update"; id: string; desired: DesiredProduct }
  | { type: "keep"; id: string; desired: DesiredProduct };

export function planProductActions(existing: RemoteProduct[]): ProductAction[] {
  return desiredProducts().map((desired) => {
    const match = findProduct(existing, desired.plan);
    if (!match) return { type: "create", desired };
    const changed = match.name !== desired.name || (match.description ?? "") !== desired.description;
    return changed ? { type: "update", id: match.id, desired } : { type: "keep", id: match.id, desired };
  });
}

export type PriceAction =
  | { type: "create"; desired: DesiredPrice }
  | { type: "keep"; id: string; desired: DesiredPrice }
  /** Amount, currency, cycle or trial changed: create a new price and archive the old one. */
  | { type: "replace"; archiveId: string; desired: DesiredPrice };

function sameCycle(match: RemotePrice, desired: DesiredPrice): boolean {
  if (desired.interval === "once") return match.interval === null;
  return match.interval === desired.interval && (match.frequency ?? 1) === 1;
}

function sameTrial(match: RemotePrice, desired: DesiredPrice): boolean {
  if (desired.trialDays === null) return match.trial === null;
  return match.trial?.interval === "day" && match.trial.frequency === desired.trialDays;
}

/** Decides what to do for the prices of ONE product (pass only that product's prices). */
export function planPriceActions(plan: CatalogueKey, existing: RemotePrice[]): PriceAction[] {
  return desiredPrices()
    .filter((desired) => desired.plan === plan)
    .map((desired) => {
      const match = existing.find(
        (price) => price.status === "active" && isOurs(price.customData) && price.customData?.plan === plan && price.customData?.interval === desired.interval,
      );
      if (!match) return { type: "create", desired };
      const same = match.amount === desired.amount && match.currencyCode === desired.currencyCode && sameCycle(match, desired) && sameTrial(match, desired);
      return same ? { type: "keep", id: match.id, desired } : { type: "replace", archiveId: match.id, desired };
    });
}

/** Name of the env var that holds the Paddle id of a catalogue price. */
export function priceEnvVar(plan: CatalogueKey, interval: PriceInterval): string {
  return plan === BID_PASS.key || interval === "once" ? BID_PASS_PRICE_ENV_VAR : paddlePriceEnvVar(plan, interval);
}

/** The lines to paste into .env / Vercel after setup, in catalogue order. */
export function formatEnvLines(priceIds: Array<{ plan: CatalogueKey; interval: PriceInterval; id: string }>): string[] {
  return desiredPrices().map((desired) => {
    const match = priceIds.find((entry) => entry.plan === desired.plan && entry.interval === desired.interval);
    return `${priceEnvVar(desired.plan, desired.interval)}=${match?.id ?? ""}`;
  });
}
