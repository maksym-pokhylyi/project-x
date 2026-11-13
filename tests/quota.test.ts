import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { PLANS } from "@/config/plans";
import { db } from "@/db";
import { organizations, subscriptions, usageCounters } from "@/db/schema";
import { consumeQuota, getUsage, quotaPeriodStart, refundQuota } from "@/lib/billing/quota";
import { resetDatabase } from "./helpers/db";

async function createOrg(id: string, plan?: { planKey: string; status: string; pastDueSince?: Date }) {
  await db.insert(organizations).values({ id, name: id, slug: id, createdAt: new Date() });
  if (plan) {
    await db.insert(subscriptions).values({
      organizationId: id,
      status: plan.status,
      planKey: plan.planKey,
      pastDueSince: plan.pastDueSince ?? null,
      paddleSubscriptionId: `sub_${id}`,
      paddleCustomerId: `ctm_${id}`,
    });
  }
}

const FREE_LIMIT = PLANS.free.limits.units as number; // 50

describe("consumeQuota", () => {
  beforeEach(resetDatabase);

  it("consumes up to the plan limit and then refuses without consuming", async () => {
    await createOrg("org_a");
    const first = await consumeQuota("org_a", "units", 20);
    expect(first).toEqual({ ok: true, metric: "units", used: 20, limit: FREE_LIMIT, remaining: FREE_LIMIT - 20 });

    const second = await consumeQuota("org_a", "units", FREE_LIMIT - 20);
    expect(second).toMatchObject({ ok: true, used: FREE_LIMIT, remaining: 0 });

    const third = await consumeQuota("org_a", "units", 1);
    expect(third).toEqual({ ok: false, reason: "limit_exceeded", metric: "units", used: FREE_LIMIT, limit: FREE_LIMIT, remaining: 0 });
    expect(await getUsage("org_a", "units")).toBe(FREE_LIMIT);
  });

  it("rejects a request larger than what is left, all-or-nothing", async () => {
    await createOrg("org_a");
    await consumeQuota("org_a", "units", FREE_LIMIT - 5);
    const result = await consumeQuota("org_a", "units", 6);
    expect(result).toMatchObject({ ok: false, used: FREE_LIMIT - 5, remaining: 5 });
    expect(await getUsage("org_a", "units")).toBe(FREE_LIMIT - 5);
    expect((await consumeQuota("org_a", "units", 5)).ok).toBe(true);
  });

  it("never exceeds the limit under concurrent calls", async () => {
    await createOrg("org_a");
    const attempts = FREE_LIMIT + 30;
    const results = await Promise.all(Array.from({ length: attempts }, () => consumeQuota("org_a", "units", 1)));
    expect(results.filter((result) => result.ok)).toHaveLength(FREE_LIMIT);
    expect(results.filter((result) => !result.ok)).toHaveLength(30);
    expect(await getUsage("org_a", "units")).toBe(FREE_LIMIT);
    // Exactly one counter row exists for the period.
    const rows = await db.select().from(usageCounters).where(eq(usageCounters.organizationId, "org_a"));
    expect(rows).toHaveLength(1);
  });

  it("stays exact under concurrent calls with mixed sizes", async () => {
    await createOrg("org_a");
    const sizes = [7, 7, 7, 7, 7, 7, 7, 7, 7, 7]; // 70 requested, 50 allowed -> 7 calls fit (49)
    const results = await Promise.all(sizes.map((n) => consumeQuota("org_a", "units", n)));
    const accepted = results.filter((result) => result.ok).length;
    expect(accepted).toBe(7);
    expect(await getUsage("org_a", "units")).toBe(49);
  });

  it("uses the limits of the workspace's plan", async () => {
    await createOrg("org_pro", { planKey: "pro", status: "active" });
    const result = await consumeQuota("org_pro", "units", FREE_LIMIT + 1);
    expect(result).toMatchObject({ ok: true, limit: PLANS.pro.limits.units });
  });

  it("applies free limits when the subscription is canceled or past its grace period", async () => {
    await createOrg("org_canceled", { planKey: "pro", status: "canceled" });
    await createOrg("org_grace", { planKey: "pro", status: "past_due", pastDueSince: new Date() });
    await createOrg("org_expired", { planKey: "pro", status: "past_due", pastDueSince: new Date(Date.now() - 30 * 86_400_000) });
    expect((await consumeQuota("org_canceled", "units", FREE_LIMIT + 1)).ok).toBe(false);
    expect((await consumeQuota("org_grace", "units", FREE_LIMIT + 1)).ok).toBe(true);
    expect((await consumeQuota("org_expired", "units", FREE_LIMIT + 1)).ok).toBe(false);
  });

  it("keeps workspaces isolated from each other", async () => {
    await createOrg("org_a");
    await createOrg("org_b");
    await consumeQuota("org_a", "units", FREE_LIMIT);
    expect((await consumeQuota("org_a", "units", 1)).ok).toBe(false);
    expect(await consumeQuota("org_b", "units", 1)).toMatchObject({ ok: true, used: 1 });
  });

  it("starts a fresh counter each UTC month", async () => {
    await createOrg("org_a");
    const october = new Date("2026-10-31T23:59:59Z");
    const november = new Date("2026-11-01T00:00:00Z");
    await consumeQuota("org_a", "units", FREE_LIMIT, october);
    expect((await consumeQuota("org_a", "units", 1, october)).ok).toBe(false);
    expect(await consumeQuota("org_a", "units", 1, november)).toMatchObject({ ok: true, used: 1 });
    expect(quotaPeriodStart("units", november).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(await getUsage("org_a", "units", october)).toBe(FREE_LIMIT);
  });

  it("treats a null limit as unlimited", async () => {
    await createOrg("org_biz", { planKey: "business", status: "active" });
    const original = PLANS.business.limits.units;
    PLANS.business.limits.units = null;
    try {
      const result = await consumeQuota("org_biz", "units", 5_000_000);
      expect(result).toEqual({ ok: true, metric: "units", used: 5_000_000, limit: null, remaining: null });
    } finally {
      PLANS.business.limits.units = original;
    }
  });

  it("refunds without going below zero", async () => {
    await createOrg("org_a");
    await consumeQuota("org_a", "units", 10);
    await refundQuota("org_a", "units", 4);
    expect(await getUsage("org_a", "units")).toBe(6);
    await refundQuota("org_a", "units", 100);
    expect(await getUsage("org_a", "units")).toBe(0);
  });

  it("validates n", async () => {
    await createOrg("org_a");
    await expect(consumeQuota("org_a", "units", 0)).rejects.toThrow(RangeError);
    await expect(consumeQuota("org_a", "units", -1)).rejects.toThrow(RangeError);
    await expect(consumeQuota("org_a", "units", 1.5)).rejects.toThrow(RangeError);
    const rows = await db.select().from(usageCounters).where(and(eq(usageCounters.organizationId, "org_a")));
    expect(rows).toHaveLength(0);
  });
});
