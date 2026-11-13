import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The budgets of the production environment (the test environment's global day is far smaller). */
const PRODUCTION = vi.hoisted(() => ({ AI_DAILY_BUDGET_USD: 30, AI_FREE_DAILY_BUDGET_USD: 10 }));
vi.mock("@/env", async (original) => {
  const actual = await original<typeof import("@/env")>();
  return { ...actual, env: { ...actual.env, ...PRODUCTION } };
});

import { AI_BUDGET_POLICY } from "@/config/ai";
import { PLANS } from "@/config/plans";
import { db } from "@/db";
import { aiUsage, subscriptions } from "@/db/schema";
import { MAX_PACK_TOKENS } from "@/features/bids/constants";
import { largestCheckReservationUsd, plannedCheckReservations } from "@/features/bids/server/ai/budget";
import { aiBudgetLimits, reserveAiBudget, settleAiReservation, type AiBudgetExceededError } from "@/lib/ai";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { createTestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/db";

/**
 * The plan budgets are sized to the bid allowances. This states the promise directly, with
 * the real models' list prices and the pipeline's own call sizes: the wrapper reserves the
 * worst case of every call, so a check must fit a workspace's ceilings even before any of
 * its calls has settled to what it really cost.
 */
describe("AI budgets are sized to the bid allowances", () => {
  beforeEach(resetDatabase);

  const reserveAll = async (organizationId: string) => {
    const admitted: string[] = [];
    for (const planned of plannedCheckReservations()) {
      const reservation = await reserveAiBudget({ organizationId, feature: planned.feature, model: planned.model, reserveUsd: planned.reserveUsd });
      admitted.push(reservation.id);
    }
    return admitted;
  };
  /** Settles every reservation of a workspace at `share` of what was reserved. */
  const settle = async (organizationId: string, share: number) => {
    for (const row of await db.select().from(aiUsage).where(eq(aiUsage.organizationId, organizationId))) {
      await settleAiReservation(row.id, { status: "ok", inputTokens: 0, outputTokens: 0, costUsd: (row.reservedUsd ?? 0) * share, latencyMs: 1 });
    }
  };

  it("a Free workspace can reserve the largest allowed check; a second one the same day is refused by its own daily ceiling", async () => {
    const user = await createTestUser();
    const limits = aiBudgetLimits(await getOrgEntitlements(user.organizationId));
    const check = largestCheckReservationUsd(MAX_PACK_TOKENS);
    // The numbers this rests on, from the catalogue and the policy — not restated here.
    expect(limits.organizationMonthlyUsd).toBe(PLANS.free.limits.aiMonthlyBudgetUsd);
    expect(limits.organizationDailyUsd).toBe(PLANS.free.limits.aiMonthlyBudgetUsd * AI_BUDGET_POLICY.dailyShareOfMonthly.free);
    expect(limits.freePoolDailyUsd).toBe(PRODUCTION.AI_FREE_DAILY_BUDGET_USD);
    expect(check).toBeGreaterThan(1); // a real constraint, not a rounding error
    expect(check).toBeLessThanOrEqual(limits.organizationDailyUsd);

    // Every call of the largest check is admitted, all at once, with nothing settled yet.
    const planned = plannedCheckReservations();
    expect(await reserveAll(user.organizationId)).toHaveLength(planned.length);

    // The check settles at half of what was held (measured: half or less). A second largest
    // check on the same day starts, and is stopped by the WORKSPACE's day — not by the
    // month, the global day or the pool that all Free workspaces share.
    await settle(user.organizationId, 0.5);
    const second = await reserveAll(user.organizationId).then(
      () => null,
      (error: unknown) => error as AiBudgetExceededError,
    );
    expect(second).toMatchObject({ code: "AI_ORG_BUDGET_EXCEEDED", scope: "organization", details: { period: "day", limitUsd: limits.organizationDailyUsd } });
    // Tomorrow the day is fresh, and the month still has room for it.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (tomorrow.getUTCMonth() === new Date().getUTCMonth()) {
      await expect(reserveAiBudget({ organizationId: user.organizationId, feature: planned[0]!.feature, model: planned[0]!.model, reserveUsd: planned[0]!.reserveUsd, now: tomorrow })).resolves.toBeTruthy();
    }
  });

  it("the shared free pool has room for several largest checks at once, and paid plans for their whole allowance", async () => {
    const check = largestCheckReservationUsd(MAX_PACK_TOKENS);
    expect(Math.floor(PRODUCTION.AI_FREE_DAILY_BUDGET_USD / check)).toBeGreaterThanOrEqual(3);

    // Bid Desk: 3 full bids a window plus 3 carried over; Plus: 10 plus 10. The month must hold
    // every check at its worst case, and a day at least two of them.
    for (const [planKey, fullBids] of [
      ["pro", 3],
      ["business", 10],
    ] as const) {
      const user = await createTestUser();
      await db.insert(subscriptions).values({ organizationId: user.organizationId, status: "active", planKey, paddleSubscriptionId: `sub_${user.organizationId}` });
      const limits = aiBudgetLimits(await getOrgEntitlements(user.organizationId));
      expect(limits.organizationMonthlyUsd, planKey).toBeGreaterThanOrEqual(fullBids * 2 * check);
      expect(limits.organizationDailyUsd, planKey).toBeGreaterThanOrEqual(2 * check);
      expect(await reserveAll(user.organizationId)).toHaveLength(plannedCheckReservations().length);
    }
  });
});
