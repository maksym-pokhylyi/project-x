import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));
vi.mock("next/navigation", async () => (await import("./outreach/mocks/next")).navigation);

import AdminOrganizationPage from "@/app/admin/organizations/[id]/page";
import { PLAN_CURRENCY, PLANS } from "@/config/plans";
import { db } from "@/db";
import { aiUsage, subscriptions } from "@/db/schema";
import { actAs, createTestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";

/**
 * /admin/organizations/<id>: the workspace's MRR is a catalogue price, and those are in
 * pounds; the AI spend next to it is an estimate in US dollars. Each in its own currency.
 */
const founderEmail = "founder@example.com"; // ADMIN_EMAILS in vitest.config.ts

const text = (html: string) =>
  html
    .replace(/<!--.*?-->/gs, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

async function pageFor(subscription: { planKey: string; billingInterval: string; status?: string; quantity?: number }): Promise<string> {
  const customer = await createTestUser({ email: "owner@customer.example" });
  await db.insert(subscriptions).values({ organizationId: customer.organizationId, status: subscription.status ?? "active", planKey: subscription.planKey, billingInterval: subscription.billingInterval, quantity: subscription.quantity ?? 1, paddleSubscriptionId: "sub_test_org_page" });
  await db.insert(aiUsage).values({ organizationId: customer.organizationId, feature: "bid.brief", model: "test-model", costUsd: 1.5 });
  actAs(await createTestUser({ email: founderEmail, name: "Fay Founder" }));
  return text(renderToStaticMarkup(await AdminOrganizationPage({ params: Promise.resolve({ id: customer.organizationId }) })));
}

describe("admin: one organization", () => {
  beforeEach(resetDatabase);

  it("shows MRR in the currency of the price list, and AI spend in dollars", async () => {
    expect(PLAN_CURRENCY).toBe("GBP");
    expect(PLANS.pro.prices).toEqual({ month: 14900, year: 149000 });

    const page = await pageFor({ planKey: "pro", billingInterval: "month" });
    expect(page).toContain("pro · month · MRR £149 ");
    expect(page).not.toContain("MRR $");
    expect(page).toContain("AI spend this month: $1.50");
  });

  it("an annual plan is a twelfth of its price a month, to the penny; seats multiply", async () => {
    expect(await pageFor({ planKey: "pro", billingInterval: "year" })).toContain("pro · year · MRR £124.17 ");
    await resetDatabase();
    expect(await pageFor({ planKey: "starter", billingInterval: "month", quantity: 3 })).toContain("starter · month · MRR £87 ");
    await resetDatabase();
    // Nothing is earned from a subscription that is not active.
    expect(await pageFor({ planKey: "pro", billingInterval: "month", status: "canceled" })).toContain("pro · month · MRR £0 ");
  });
});
