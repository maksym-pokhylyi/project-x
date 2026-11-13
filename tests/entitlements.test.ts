import { describe, expect, it } from "vitest";
import { PLANS } from "@/config/plans";
import { remaining, resolveEntitlements } from "@/lib/billing/entitlements";

const now = new Date("2026-11-13T12:00:00Z");
const options = { graceDays: 7, now };
const sub = (status: string, planKey = "pro", pastDueSince: Date | null = null) => ({ status, planKey, pastDueSince });

describe("resolveEntitlements", () => {
  it("gives the free plan when there is no subscription", () => {
    const result = resolveEntitlements(null, options);
    expect(result.planKey).toBe("free");
    expect(result.source).toBe("no_subscription");
    expect(result.isPaid).toBe(false);
    expect(result.limits).toEqual(PLANS.free.limits);
    expect(result.subscribedPlanKey).toBeNull();
  });

  it.each(["active", "trialing"] as const)("honours the subscribed plan when %s", (status) => {
    const result = resolveEntitlements(sub(status, "business"), options);
    expect(result.planKey).toBe("business");
    expect(result.source).toBe(status);
    expect(result.isPaid).toBe(true);
    expect(result.limits).toEqual(PLANS.business.limits);
    expect(result.features).toEqual(PLANS.business.features);
  });

  it("keeps the paid plan while past_due is inside the grace period", () => {
    const pastDueSince = new Date("2026-11-10T12:00:00Z"); // 3 days ago
    const result = resolveEntitlements(sub("past_due", "pro", pastDueSince), options);
    expect(result.planKey).toBe("pro");
    expect(result.source).toBe("past_due_grace");
    expect(result.graceEndsAt?.toISOString()).toBe("2026-11-17T12:00:00.000Z");
  });

  it("falls back to free once the grace period has elapsed", () => {
    const pastDueSince = new Date("2026-11-06T11:59:59Z"); // just over 7 days ago
    const result = resolveEntitlements(sub("past_due", "pro", pastDueSince), options);
    expect(result.planKey).toBe("free");
    expect(result.source).toBe("past_due_expired");
    expect(result.subscribedPlanKey).toBe("pro");
    expect(result.isPaid).toBe(false);
  });

  it("treats the grace boundary as expired exactly at the deadline", () => {
    const pastDueSince = new Date("2026-11-06T12:00:00Z"); // exactly 7 days ago
    expect(resolveEntitlements(sub("past_due", "pro", pastDueSince), options).source).toBe("past_due_expired");
  });

  it("respects a configurable grace period, including zero", () => {
    const pastDueSince = new Date("2026-11-13T11:00:00Z");
    expect(resolveEntitlements(sub("past_due", "pro", pastDueSince), { graceDays: 0, now }).planKey).toBe("free");
    expect(resolveEntitlements(sub("past_due", "pro", pastDueSince), { graceDays: 30, now }).planKey).toBe("pro");
  });

  it("fails closed when past_due has no recorded start", () => {
    expect(resolveEntitlements(sub("past_due", "pro", null), options).planKey).toBe("free");
  });

  it.each(["canceled", "paused"] as const)("gives free when %s", (status) => {
    const result = resolveEntitlements(sub(status, "starter"), options);
    expect(result.planKey).toBe("free");
    expect(result.source).toBe(status);
    expect(result.subscribedPlanKey).toBe("starter");
  });

  it("fails closed on an unknown plan key or status", () => {
    expect(resolveEntitlements(sub("active", "unknown"), options)).toMatchObject({ planKey: "free", source: "unknown_plan" });
    expect(resolveEntitlements(sub("something_new", "pro"), options)).toMatchObject({ planKey: "free", source: "unknown_status" });
  });

  it("computes remaining amounts", () => {
    expect(remaining(10, 3)).toBe(7);
    expect(remaining(10, 12)).toBe(0);
    expect(remaining(null, 1_000_000)).toBeNull();
  });
});
