import { describe, expect, it } from "vitest";
import { BID_PASS, BID_PASS_PRICE_ENV_VAR, PAID_PLAN_KEYS, PLANS, PLAN_CURRENCY, paddlePriceEnvVar } from "@/config/plans";
import {
  APP_TAG,
  CATALOGUE_KEYS,
  desiredPrices,
  desiredProducts,
  formatEnvLines,
  planPriceActions,
  planProductActions,
  priceEnvVar,
  type PriceInterval,
  type RemotePrice,
  type RemoteProduct,
} from "@/lib/billing/paddle-catalogue";

const product = (plan: string, overrides: Partial<RemoteProduct> = {}): RemoteProduct => {
  const desired = desiredProducts().find((entry) => entry.plan === plan)!;
  return { id: `pro_${plan}`, name: desired.name, description: desired.description, status: "active", customData: { app: APP_TAG, plan }, ...overrides };
};

/** A price as Paddle would return it right after `paddle:setup` created it from the catalogue. */
const price = (plan: string, interval: PriceInterval, overrides: Partial<RemotePrice> = {}): RemotePrice => {
  const desired = desiredPrices().find((entry) => entry.plan === plan && entry.interval === interval)!;
  return {
    id: `pri_${plan}_${interval}`,
    productId: `pro_${plan}`,
    status: "active",
    amount: desired.amount,
    currencyCode: desired.currencyCode,
    interval: interval === "once" ? null : interval,
    frequency: interval === "once" ? null : 1,
    trial: desired.trialDays ? { interval: "day", frequency: desired.trialDays } : null,
    customData: { app: APP_TAG, plan, interval },
    ...overrides,
  };
};

describe("paddle:setup planning (pure)", () => {
  it("derives products and prices from the plan catalogue, in pounds", () => {
    expect(PLAN_CURRENCY).toBe("GBP");
    expect(desiredProducts().map((entry) => entry.plan)).toEqual([...PAID_PLAN_KEYS, "bid_pass"]);
    expect(CATALOGUE_KEYS).toEqual([...PAID_PLAN_KEYS, "bid_pass"]);
    const prices = desiredPrices();
    expect(prices).toHaveLength(PAID_PLAN_KEYS.length * 2 + 1);
    expect(prices.find((entry) => entry.plan === "starter" && entry.interval === "month")).toMatchObject({
      amount: String(PLANS.starter.prices!.month),
      currencyCode: "GBP",
      trialDays: null,
      customData: { app: APP_TAG, plan: "starter", interval: "month" },
    });
    expect(prices.every((entry) => entry.currencyCode === PLAN_CURRENCY && /^\d+$/.test(entry.amount))).toBe(true);
  });

  it("includes the Bid Pass as a one-off price of £99", () => {
    const pass = desiredPrices().filter((entry) => entry.plan === "bid_pass");
    expect(pass).toEqual([
      expect.objectContaining({ interval: "once", amount: "9900", currencyCode: "GBP", trialDays: null, customData: { app: APP_TAG, plan: "bid_pass", interval: "once" } }),
    ]);
    expect(BID_PASS.price).toBe(9900);
    expect(desiredProducts().find((entry) => entry.plan === "bid_pass")).toMatchObject({ name: "Bidfolio Bid Pass", description: BID_PASS.description });
  });

  it("gives the plan with a trial that trial on both of its prices, and no other", () => {
    const withTrial = desiredPrices().filter((entry) => entry.trialDays !== null);
    expect(withTrial.map((entry) => `${entry.plan}/${entry.interval}:${entry.trialDays}`)).toEqual([`pro/month:${PLANS.pro.trialDays}`, `pro/year:${PLANS.pro.trialDays}`]);
    expect(PLANS.pro.trialDays).toBe(14);
  });

  it("creates everything in an empty account", () => {
    expect(planProductActions([]).map((action) => action.type)).toEqual(["create", "create", "create", "create"]);
    expect(planPriceActions("pro", []).map((action) => `${action.type}:${action.desired.interval}`)).toEqual(["create:month", "create:year"]);
    expect(planPriceActions("bid_pass", []).map((action) => `${action.type}:${action.desired.interval}`)).toEqual(["create:once"]);
  });

  it("is idempotent: a second run keeps everything", () => {
    const products = CATALOGUE_KEYS.map((plan) => product(plan));
    expect(planProductActions(products).every((action) => action.type === "keep")).toBe(true);
    for (const plan of PAID_PLAN_KEYS) {
      const actions = planPriceActions(plan, [price(plan, "month"), price(plan, "year")]);
      expect(actions).toEqual([
        expect.objectContaining({ type: "keep", id: `pri_${plan}_month` }),
        expect.objectContaining({ type: "keep", id: `pri_${plan}_year` }),
      ]);
    }
    expect(planPriceActions("bid_pass", [price("bid_pass", "once")])).toEqual([expect.objectContaining({ type: "keep", id: "pri_bid_pass_once" })]);
  });

  it("updates a product whose name or description drifted", () => {
    const actions = planProductActions([product("starter", { name: "Old name" }), product("pro"), product("business", { description: null }), product("bid_pass")]);
    expect(actions.map((action) => action.type)).toEqual(["update", "keep", "update", "keep"]);
  });

  it("replaces a price when the amount changed instead of mutating it", () => {
    const actions = planPriceActions("pro", [price("pro", "month", { amount: "4900" }), price("pro", "year")]);
    expect(actions[0]).toMatchObject({ type: "replace", archiveId: "pri_pro_month", desired: { amount: String(PLANS.pro.prices!.month) } });
    expect(actions[1]).toMatchObject({ type: "keep" });
  });

  it("replaces prices left over in dollars, without a trial, or on the wrong cycle", () => {
    // The foundation created USD prices: the catalogue is in pounds now.
    expect(planPriceActions("starter", [price("starter", "month", { currencyCode: "USD" }), price("starter", "year")]).map((action) => action.type)).toEqual(["replace", "keep"]);
    // Bid Desk promises a 14-day trial: a price without it (or with another length) is replaced.
    expect(planPriceActions("pro", [price("pro", "month", { trial: null }), price("pro", "year", { trial: { interval: "day", frequency: 7 } })]).map((action) => action.type)).toEqual([
      "replace",
      "replace",
    ]);
    // A plan without a trial must not keep a price that has one.
    expect(planPriceActions("starter", [price("starter", "month", { trial: { interval: "day", frequency: 14 } }), price("starter", "year")]).map((action) => action.type)).toEqual([
      "replace",
      "keep",
    ]);
    // The Bid Pass is paid once: a recurring price in its place is replaced.
    expect(planPriceActions("bid_pass", [price("bid_pass", "once", { interval: "month", frequency: 1 })])[0]).toMatchObject({ type: "replace", archiveId: "pri_bid_pass_once" });
  });

  it("ignores archived objects and objects created by someone else", () => {
    const foreign = product("pro", { id: "pro_foreign", customData: { plan: "pro" } });
    const archived = product("pro", { id: "pro_archived", status: "archived" });
    expect(planProductActions([foreign, archived]).find((action) => action.desired.plan === "pro")?.type).toBe("create");
    const actions = planPriceActions("pro", [price("pro", "month", { status: "archived" }), price("pro", "year", { customData: null })]);
    expect(actions.map((action) => action.type)).toEqual(["create", "create"]);
  });

  it("prints one env line per plan and interval, and one for the Bid Pass", () => {
    const lines = formatEnvLines([
      { plan: "starter", interval: "month", id: "pri_1" },
      { plan: "starter", interval: "year", id: "pri_2" },
      { plan: "pro", interval: "month", id: "pri_3" },
      { plan: "bid_pass", interval: "once", id: "pri_9" },
    ]);
    expect(lines).toEqual([
      "PADDLE_PRICE_STARTER_MONTHLY=pri_1",
      "PADDLE_PRICE_STARTER_ANNUAL=pri_2",
      "PADDLE_PRICE_PRO_MONTHLY=pri_3",
      "PADDLE_PRICE_PRO_ANNUAL=",
      "PADDLE_PRICE_BUSINESS_MONTHLY=",
      "PADDLE_PRICE_BUSINESS_ANNUAL=",
      "PADDLE_PRICE_BID_PASS=pri_9",
    ]);
    expect(paddlePriceEnvVar("business", "year")).toBe("PADDLE_PRICE_BUSINESS_ANNUAL");
    expect(priceEnvVar("bid_pass", "once")).toBe(BID_PASS_PRICE_ENV_VAR);
    expect(BID_PASS_PRICE_ENV_VAR).toBe("PADDLE_PRICE_BID_PASS");
  });
});
