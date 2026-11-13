import {
  BILLING_INTERVALS,
  PAID_PLAN_KEYS,
  PLANS,
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
 * Paddle objects are matched through `custom_data` written by this tool, never by name:
 *   product: { app: <APP_TAG>, plan: "starter" }
 *   price:   { app: <APP_TAG>, plan: "starter", interval: "month" }
 * (single lowercase words on purpose: they survive the SDK's camelCase/snake_case conversion).
 */
export const APP_TAG = "saas-foundation";

export type RemoteProduct = { id: string; name: string; description: string | null; status: string; customData: Record<string, unknown> | null };
export type RemotePrice = {
  id: string;
  productId: string;
  status: string;
  amount: string;
  currencyCode: string;
  interval: string | null;
  frequency: number | null;
  customData: Record<string, unknown> | null;
};

export type DesiredProduct = { plan: PaidPlanKey; name: string; description: string; customData: Record<string, string> };
export type DesiredPrice = {
  plan: PaidPlanKey;
  interval: BillingInterval;
  /** Minor units as a string, the format the Paddle API expects ("2900" = $29.00). */
  amount: string;
  currencyCode: "USD";
  name: string;
  description: string;
  customData: Record<string, string>;
};

export function desiredProducts(): DesiredProduct[] {
  return PAID_PLAN_KEYS.map((plan) => ({
    plan,
    name: `${site.name} ${PLANS[plan].name}`,
    description: PLANS[plan].description,
    customData: { app: APP_TAG, plan },
  }));
}

export function desiredPrices(): DesiredPrice[] {
  return PAID_PLAN_KEYS.flatMap((plan) =>
    BILLING_INTERVALS.map((interval) => {
      const prices = PLANS[plan].prices;
      if (!prices) throw new Error(`Paid plan "${plan}" has no prices in src/config/plans.ts`);
      return {
        plan,
        interval,
        amount: String(prices[interval]),
        currencyCode: "USD" as const,
        name: interval === "month" ? "Monthly" : "Annual",
        description: `${PLANS[plan].name} — ${interval === "month" ? "monthly" : "annual"}`,
        customData: { app: APP_TAG, plan, interval },
      };
    }),
  );
}

function isOurs(customData: Record<string, unknown> | null): boolean {
  return customData?.app === APP_TAG;
}

export function findProduct(products: RemoteProduct[], plan: PaidPlanKey): RemoteProduct | undefined {
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
  /** Amount or cycle changed: create a new price and archive the old one. */
  | { type: "replace"; archiveId: string; desired: DesiredPrice };

/** Decides what to do for the prices of ONE product (pass only that product's prices). */
export function planPriceActions(plan: PaidPlanKey, existing: RemotePrice[]): PriceAction[] {
  return desiredPrices()
    .filter((desired) => desired.plan === plan)
    .map((desired) => {
      const match = existing.find(
        (price) => price.status === "active" && isOurs(price.customData) && price.customData?.plan === plan && price.customData?.interval === desired.interval,
      );
      if (!match) return { type: "create", desired };
      const same =
        match.amount === desired.amount &&
        match.currencyCode === desired.currencyCode &&
        match.interval === desired.interval &&
        (match.frequency ?? 1) === 1;
      return same ? { type: "keep", id: match.id, desired } : { type: "replace", archiveId: match.id, desired };
    });
}

/** The lines to paste into .env / Vercel after setup, in catalogue order. */
export function formatEnvLines(priceIds: Array<{ plan: PaidPlanKey; interval: BillingInterval; id: string }>): string[] {
  return desiredPrices().map((desired) => {
    const match = priceIds.find((entry) => entry.plan === desired.plan && entry.interval === desired.interval);
    return `${paddlePriceEnvVar(desired.plan, desired.interval)}=${match?.id ?? ""}`;
  });
}
