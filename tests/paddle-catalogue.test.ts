import { describe, expect, it } from "vitest";
import { PAID_PLAN_KEYS, PLANS, paddlePriceEnvVar } from "@/config/plans";
import {
  APP_TAG,
  desiredPrices,
  desiredProducts,
  formatEnvLines,
  planPriceActions,
  planProductActions,
  type RemotePrice,
  type RemoteProduct,
} from "@/lib/billing/paddle-catalogue";

const product = (plan: string, overrides: Partial<RemoteProduct> = {}): RemoteProduct => {
  const desired = desiredProducts().find((entry) => entry.plan === plan)!;
  return { id: `pro_${plan}`, name: desired.name, description: desired.description, status: "active", customData: { app: APP_TAG, plan }, ...overrides };
};

const price = (plan: string, interval: "month" | "year", overrides: Partial<RemotePrice> = {}): RemotePrice => {
  const desired = desiredPrices().find((entry) => entry.plan === plan && entry.interval === interval)!;
  return {
    id: `pri_${plan}_${interval}`,
    productId: `pro_${plan}`,
    status: "active",
    amount: desired.amount,
    currencyCode: "USD",
    interval,
    frequency: 1,
    customData: { app: APP_TAG, plan, interval },
    ...overrides,
  };
};

describe("paddle:setup planning (pure)", () => {
  it("derives products and prices from the plan catalogue", () => {
    expect(desiredProducts().map((entry) => entry.plan)).toEqual(PAID_PLAN_KEYS);
    const prices = desiredPrices();
    expect(prices).toHaveLength(PAID_PLAN_KEYS.length * 2);
    expect(prices.find((entry) => entry.plan === "starter" && entry.interval === "month")).toMatchObject({
      amount: String(PLANS.starter.prices!.month),
      currencyCode: "USD",
      customData: { app: APP_TAG, plan: "starter", interval: "month" },
    });
    expect(prices.every((entry) => /^\d+$/.test(entry.amount))).toBe(true);
  });

  it("creates everything in an empty account", () => {
    expect(planProductActions([]).map((action) => action.type)).toEqual(["create", "create", "create"]);
    expect(planPriceActions("pro", []).map((action) => `${action.type}:${action.desired.interval}`)).toEqual(["create:month", "create:year"]);
  });

  it("is idempotent: a second run keeps everything", () => {
    const products = PAID_PLAN_KEYS.map((plan) => product(plan));
    expect(planProductActions(products).every((action) => action.type === "keep")).toBe(true);
    for (const plan of PAID_PLAN_KEYS) {
      const actions = planPriceActions(plan, [price(plan, "month"), price(plan, "year")]);
      expect(actions).toEqual([
        expect.objectContaining({ type: "keep", id: `pri_${plan}_month` }),
        expect.objectContaining({ type: "keep", id: `pri_${plan}_year` }),
      ]);
    }
  });

  it("updates a product whose name or description drifted", () => {
    const actions = planProductActions([product("starter", { name: "Old name" }), product("pro"), product("business", { description: null })]);
    expect(actions.map((action) => action.type)).toEqual(["update", "keep", "update"]);
  });

  it("replaces a price when the amount changed instead of mutating it", () => {
    const actions = planPriceActions("pro", [price("pro", "month", { amount: "4900" }), price("pro", "year")]);
    expect(actions[0]).toMatchObject({ type: "replace", archiveId: "pri_pro_month", desired: { amount: String(PLANS.pro.prices!.month) } });
    expect(actions[1]).toMatchObject({ type: "keep" });
  });

  it("ignores archived objects and objects created by someone else", () => {
    const foreign = product("pro", { id: "pro_foreign", customData: { plan: "pro" } });
    const archived = product("pro", { id: "pro_archived", status: "archived" });
    expect(planProductActions([foreign, archived]).find((action) => action.desired.plan === "pro")?.type).toBe("create");
    const actions = planPriceActions("pro", [price("pro", "month", { status: "archived" }), price("pro", "year", { customData: null })]);
    expect(actions.map((action) => action.type)).toEqual(["create", "create"]);
  });

  it("prints one env line per plan and interval", () => {
    const lines = formatEnvLines([
      { plan: "starter", interval: "month", id: "pri_1" },
      { plan: "starter", interval: "year", id: "pri_2" },
      { plan: "pro", interval: "month", id: "pri_3" },
    ]);
    expect(lines).toEqual([
      "PADDLE_PRICE_STARTER_MONTHLY=pri_1",
      "PADDLE_PRICE_STARTER_ANNUAL=pri_2",
      "PADDLE_PRICE_PRO_MONTHLY=pri_3",
      "PADDLE_PRICE_PRO_ANNUAL=",
      "PADDLE_PRICE_BUSINESS_MONTHLY=",
      "PADDLE_PRICE_BUSINESS_ANNUAL=",
    ]);
    expect(paddlePriceEnvVar("business", "year")).toBe("PADDLE_PRICE_BUSINESS_ANNUAL");
  });
});
