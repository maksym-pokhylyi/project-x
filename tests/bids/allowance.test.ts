import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PLANS } from "@/config/plans";
import { db } from "@/db";
import { bidCredits, bids, subscriptions } from "@/db/schema";
import { consumeBidAllowance, consumeFullBid, getBidAccess, grantBidPass, revokeBidPass, TRIAL_FULL_BIDS } from "@/features/bids/access";
import { addMonthsUtc, allowanceWindow, carriedOver, monthLabel, windowAt } from "@/features/bids/allowance";
import * as bidsApi from "@/features/bids/server/bids";
import { createTestUser, type TestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/db";
import { scopeOf, type Scope } from "./helpers";

const utc = (iso: string) => new Date(`${iso}Z`);
const day = (date: Date) => date.toISOString().slice(0, 10);
const span = (window: { start: Date; end: Date }) => `${day(window.start)} → ${day(window.end)}`;

describe("allowance windows (pure)", () => {
  it("uses UTC calendar months when there is no subscription with period dates", () => {
    expect(span(allowanceWindow(null, utc("2026-11-13T10:00:00")))).toBe("2026-11-01 → 2026-12-01");
    expect(span(allowanceWindow({ currentPeriodStart: null, currentPeriodEnd: null }, utc("2026-12-31T23:59:59")))).toBe("2026-12-01 → 2027-01-01");
    expect(span(windowAt(null, utc("2027-01-05T00:00:00"), -1))).toBe("2026-12-01 → 2027-01-01");
  });

  it("is the billing period itself on a monthly plan, to the second", () => {
    const subscription = { billingInterval: "month", currentPeriodStart: utc("2026-10-14T09:30:00"), currentPeriodEnd: utc("2026-11-14T09:30:00") };
    const window = allowanceWindow(subscription, utc("2026-11-13T10:00:00"));
    expect(window).toEqual({ start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd });
    // The renewal event is late: the next window has begun all the same.
    expect(allowanceWindow(subscription, utc("2026-11-14T09:30:00"))).toEqual({ start: utc("2026-11-14T09:30:00"), end: utc("2026-12-14T09:30:00") });
    expect(span(windowAt(subscription, utc("2026-11-13T10:00:00"), -1))).toBe("2026-09-14 → 2026-10-14");
  });

  it("is the trial itself during a trial", () => {
    const trial = { billingInterval: "month", currentPeriodStart: utc("2026-11-10T08:00:00"), currentPeriodEnd: utc("2026-11-24T08:00:00") };
    expect(allowanceWindow(trial, utc("2026-11-20T00:00:00"))).toEqual({ start: trial.currentPeriodStart, end: trial.currentPeriodEnd });
  });

  it("follows the monthly anniversaries of the start on an annual plan", () => {
    const annual = { billingInterval: "year", currentPeriodStart: utc("2026-03-15T12:00:00"), currentPeriodEnd: utc("2027-03-15T12:00:00") };
    expect(span(allowanceWindow(annual, utc("2026-03-15T12:00:00")))).toBe("2026-03-15 → 2026-04-15");
    expect(span(allowanceWindow(annual, utc("2026-11-13T10:00:00")))).toBe("2026-10-15 → 2026-11-15");
    expect(span(allowanceWindow(annual, utc("2026-11-15T11:59:59")))).toBe("2026-10-15 → 2026-11-15");
    expect(span(allowanceWindow(annual, utc("2026-11-15T12:00:00")))).toBe("2026-11-15 → 2026-12-15");
    expect(span(allowanceWindow(annual, utc("2027-01-20T00:00:00")))).toBe("2027-01-15 → 2027-02-15");
    expect(span(windowAt(annual, utc("2026-03-20T00:00:00"), -1))).toBe("2026-02-15 → 2026-03-15");
  });

  it("keeps an anchor on the 29th, 30th or 31st through shorter months without drifting", () => {
    const from = (start: string) => ({ billingInterval: "year", currentPeriodStart: utc(`${start}T00:00:00`), currentPeriodEnd: utc(`${Number(start.slice(0, 4)) + 1}${start.slice(4)}T00:00:00`) });
    const on31 = from("2026-01-31");
    expect(span(allowanceWindow(on31, utc("2026-02-10T00:00:00")))).toBe("2026-01-31 → 2026-02-28");
    expect(span(allowanceWindow(on31, utc("2026-02-28T00:00:00")))).toBe("2026-02-28 → 2026-03-31");
    expect(span(allowanceWindow(on31, utc("2026-03-31T00:00:00")))).toBe("2026-03-31 → 2026-04-30");
    expect(span(allowanceWindow(on31, utc("2026-12-31T00:00:00")))).toBe("2026-12-31 → 2027-01-31");
    expect(span(allowanceWindow(from("2026-01-30"), utc("2026-03-01T00:00:00")))).toBe("2026-02-28 → 2026-03-30");
    expect(span(allowanceWindow(from("2026-01-29"), utc("2026-02-28T00:00:00")))).toBe("2026-02-28 → 2026-03-29");
    // 2028 is a leap year.
    expect(span(allowanceWindow(from("2028-01-31"), utc("2028-02-10T00:00:00")))).toBe("2028-01-31 → 2028-02-29");
    expect(span(allowanceWindow(from("2028-01-29"), utc("2028-02-10T00:00:00")))).toBe("2028-01-29 → 2028-02-29");
    expect(day(addMonthsUtc(utc("2026-08-31T00:00:00"), 1))).toBe("2026-09-30");
    expect(day(addMonthsUtc(utc("2026-03-31T00:00:00"), -1))).toBe("2026-02-28");
    // Every window is at least 28 days and they never overlap or leave a gap.
    let cursor = utc("2026-01-31T00:00:00");
    for (let month = 0; month < 30; month += 1) {
      const window = allowanceWindow(on31, cursor);
      expect(window.start.getTime()).toBe(cursor.getTime());
      expect((window.end.getTime() - window.start.getTime()) / 86_400_000).toBeGreaterThanOrEqual(28);
      cursor = window.end;
    }
  });

  it("carries only a window's own unused allowance, once", () => {
    expect(carriedOver(3, [])).toBe(0);
    expect(carriedOver(3, [1])).toBe(2);
    expect(carriedOver(3, [3])).toBe(0);
    expect(carriedOver(3, [0, 0, 0])).toBe(3); // never more than one plan limit
    expect(carriedOver(3, [1, 5])).toBe(0); // 2 carried in + all 3 of its own used
    expect(carriedOver(3, [0, 2])).toBe(3); // the 2 came out of the 3 carried in; the third lapsed, the window's own 3 move on
    expect(carriedOver(3, [0, 4])).toBe(2); // 3 carried in used first, then 1 of its own
    expect(carriedOver(10, [7])).toBe(3);
    expect(monthLabel(utc("2026-10-14T09:30:00"))).toBe("October");
  });
});

describe("allowance windows, carry-over, trial and passes (database)", () => {
  let user: TestUser;
  let scope: Scope;
  const limits = PLANS.pro.limits as unknown as Record<string, unknown>;
  const features = PLANS.pro.features as unknown as Record<string, unknown>;
  const starter = PLANS.starter.limits as unknown as Record<string, unknown>;
  const DAY = 86_400_000;
  const now = new Date();
  /** A monthly period that began ten days ago. */
  const periodStart = new Date(now.getTime() - 10 * DAY);
  const periodEnd = addMonthsUtc(periodStart, 1);
  const before = (windows: number) => addMonthsUtc(periodStart, -windows);

  beforeAll(() => {
    // The product's plans are not in src/config/plans.ts yet: give two of the placeholders the bid desk keys.
    limits["bids.monthly"] = 3;
    features["bids.drafting"] = true;
    starter["briefs.monthly"] = 1;
  });
  afterAll(() => {
    delete limits["bids.monthly"];
    delete features["bids.drafting"];
    delete starter["briefs.monthly"];
  });
  beforeEach(async () => {
    await resetDatabase();
    user = await createTestUser();
    scope = scopeOf(user);
  });
  afterEach(() => {
    delete process.env.BIDS_SIMULATE_PLAN;
  });

  const subscribe = (values: Partial<typeof subscriptions.$inferInsert> = {}) =>
    db.insert(subscriptions).values({
      organizationId: user.organizationId,
      status: "active",
      planKey: "pro",
      paddleSubscriptionId: `sub_${user.organizationId}`,
      billingInterval: "month",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      createdAt: before(6),
      ...values,
    });
  /** Bids already taken from the plan in the window that started at `stamp`. */
  const taken = async (count: number, stamp: Date) => {
    for (let index = 0; index < count; index += 1) {
      const bid = await bidsApi.createBid(scope, {});
      await db.update(bids).set({ accessLevel: "full", accessSource: "plan_bid", allowancePeriodStart: stamp }).where(eq(bids.id, bid.id));
    }
  };
  const start = async (kind: "any" | "full" = "any") => {
    const bid = await bidsApi.createBid(scope, {});
    return kind === "full" ? consumeFullBid(user.organizationId, bid.id) : consumeBidAllowance(user.organizationId, bid.id);
  };

  it("renews on the billing date and carries last window's unused full bids, which are used first", async () => {
    await subscribe({ createdAt: before(1) }); // subscribed one window ago
    await taken(1, before(1)); // 1 of 3 used in that window: 2 carry over

    let access = await getBidAccess(user.organizationId);
    expect(access.fullBids).toEqual({ limit: 3, used: 0, remaining: 5, rolledOver: { count: 2, fromLabel: monthLabel(before(1)), useBy: periodEnd }, renewsAt: periodEnd, trial: false });

    expect(await start()).toEqual({ ok: true, level: "full", source: "plan_bid" });
    access = await getBidAccess(user.organizationId);
    expect(access.fullBids).toMatchObject({ used: 1, remaining: 4, rolledOver: { count: 1 } });
    // The stamp is the start of the billing period, not the 1st of the month.
    const [stamped] = await db.select().from(bids).where(eq(bids.organizationId, user.organizationId)).orderBy(bids.createdAt).offset(1).limit(1);
    expect(stamped!.allowancePeriodStart).toEqual(periodStart);

    await start();
    access = await getBidAccess(user.organizationId);
    expect(access.fullBids).toMatchObject({ used: 2, remaining: 3, rolledOver: null }); // the carried bids went first
    for (let index = 0; index < 3; index += 1) expect(await start("full")).toMatchObject({ ok: true, source: "plan_bid" });
    expect((await getBidAccess(user.organizationId)).fullBids).toMatchObject({ used: 5, remaining: 0, rolledOver: null });
    expect(await start("full")).toEqual({ ok: false, reason: "none_left" });
  });

  it("lets carried bids lapse at the end of the window and never carries more than one plan limit", async () => {
    await subscribe();
    // Nothing used for two windows: 3 carry over, not 6.
    expect((await getBidAccess(user.organizationId)).fullBids).toMatchObject({ remaining: 6, rolledOver: { count: 3 } });
    // Last window 2 were used — out of the 3 carried into it — so its own 3 carry over; the
    // third carried bid lapsed with that window instead of being carried a second time.
    await taken(2, before(1));
    expect((await getBidAccess(user.organizationId)).fullBids).toMatchObject({ remaining: 6, rolledOver: { count: 3 } });
    // Two more in the last window (4 in all): the 3 carried and 1 of its own, so 2 carry over.
    await taken(2, before(1));
    expect((await getBidAccess(user.organizationId)).fullBids).toMatchObject({ remaining: 5, rolledOver: { count: 2 } });
    // A busy window two back changes nothing: what it left unused was last window's to use or lose.
    await taken(3, before(2));
    expect((await getBidAccess(user.organizationId)).fullBids).toMatchObject({ remaining: 5, rolledOver: { count: 2 } });
  });

  it("carries nothing into the first paid window, from a trial, or without a subscription", async () => {
    // Subscribed ten days ago: there was no window before this one.
    await subscribe({ createdAt: periodStart });
    expect((await getBidAccess(user.organizationId)).fullBids).toMatchObject({ limit: 3, remaining: 3, rolledOver: null });

    // First paid period after a trial whose single bid was never used.
    await db.update(subscriptions).set({ createdAt: new Date(periodStart.getTime() - 14 * DAY), trialEnd: periodStart }).where(eq(subscriptions.organizationId, user.organizationId));
    expect((await getBidAccess(user.organizationId)).fullBids).toMatchObject({ limit: 3, remaining: 3, rolledOver: null, trial: false });

    // A simulated plan has no billing date: calendar months, no carry-over.
    await db.delete(subscriptions).where(eq(subscriptions.organizationId, user.organizationId));
    process.env.BIDS_SIMULATE_PLAN = "bid_desk";
    const simulated = await getBidAccess(user.organizationId);
    expect(simulated.fullBids).toMatchObject({ limit: 3, remaining: 3, rolledOver: null });
    expect(simulated.fullBids.renewsAt).toEqual(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));
  });

  it("includes one full bid in the whole trial", async () => {
    const trialStart = new Date(now.getTime() - 3 * DAY);
    const trialEnd = new Date(trialStart.getTime() + 14 * DAY);
    await subscribe({ status: "trialing", currentPeriodStart: trialStart, currentPeriodEnd: trialEnd, trialEnd, createdAt: trialStart });
    expect(TRIAL_FULL_BIDS).toBe(1);
    expect((await getBidAccess(user.organizationId)).fullBids).toEqual({ limit: 1, used: 0, remaining: 1, rolledOver: null, renewsAt: trialEnd, trial: true });

    expect(await start()).toEqual({ ok: true, level: "full", source: "plan_bid" });
    expect((await getBidAccess(user.organizationId)).fullBids).toMatchObject({ used: 1, remaining: 0 });
    expect(await start("full")).toEqual({ ok: false, reason: "none_left" });
    // What is left for a new bid is the workspace's free check, not a second trial bid.
    expect((await getBidAccess(user.organizationId)).next).toEqual({ source: "free_brief", level: "brief" });
  });

  it("uses monthly anniversaries on an annual plan", async () => {
    const yearStart = new Date(now.getTime() - 70 * DAY);
    await subscribe({ billingInterval: "year", currentPeriodStart: yearStart, currentPeriodEnd: addMonthsUtc(yearStart, 12), createdAt: yearStart });
    const expected = allowanceWindow({ currentPeriodStart: yearStart, currentPeriodEnd: addMonthsUtc(yearStart, 12) }, new Date());
    expect(expected.start.getTime()).toBeGreaterThan(yearStart.getTime());
    expect((expected.end.getTime() - expected.start.getTime()) / DAY).toBeLessThanOrEqual(31);
    // Four in the month before: the 3 carried into it and 1 of its own, so 2 carry over.
    await taken(4, windowAt({ currentPeriodStart: yearStart, currentPeriodEnd: addMonthsUtc(yearStart, 12) }, new Date(), -1).start);
    const access = await getBidAccess(user.organizationId);
    expect(access.fullBids).toMatchObject({ limit: 3, used: 0, remaining: 5, renewsAt: expected.end, rolledOver: { count: 2, useBy: expected.end } });
    await start();
    const stamps = await db.select({ stamp: bids.allowancePeriodStart }).from(bids).where(eq(bids.organizationId, user.organizationId));
    expect(stamps.filter((row) => row.stamp?.getTime() === expected.start.getTime())).toHaveLength(1);
  });

  it("anchors the monthly cited check on the billing date too, without carry-over", async () => {
    await subscribe({ planKey: "starter" });
    let access = await getBidAccess(user.organizationId);
    expect(access.checks).toEqual({ limit: 1, used: 0, remaining: 1, renewsAt: periodEnd });
    expect(access.fullBids).toMatchObject({ limit: 0, remaining: 0, rolledOver: null });
    expect(await start()).toEqual({ ok: true, level: "brief", source: "plan_brief" });
    access = await getBidAccess(user.organizationId);
    expect(access.checks).toMatchObject({ used: 1, remaining: 0 });
    // A check taken in the window before does not count now, and an unused one did not carry.
    await db.update(bids).set({ allowancePeriodStart: before(1) }).where(eq(bids.organizationId, user.organizationId));
    expect((await getBidAccess(user.organizationId)).checks).toMatchObject({ used: 0, remaining: 1 });
  });

  it("revokes an unused Bid Pass after a refund, for good, and leaves a used one with its bid", async () => {
    expect(await grantBidPass(user.organizationId, { source: "paddle", externalRef: "txn_refunded" })).toBe(true);
    expect(await grantBidPass(user.organizationId, { source: "paddle", externalRef: "txn_used" })).toBe(true);
    const [fresh] = await db.select().from(bidCredits).where(eq(bidCredits.externalRef, "txn_refunded"));
    expect(fresh!.expiresAt).toBeNull(); // a purchased pass does not expire
    expect((await getBidAccess(user.organizationId)).bidPasses).toBe(2);

    expect(await revokeBidPass(user.organizationId, "txn_refunded")).toBe("revoked");
    expect((await getBidAccess(user.organizationId)).bidPasses).toBe(1);
    // A replay of the purchase event cannot bring it back; revoking twice is harmless.
    expect(await grantBidPass(user.organizationId, { source: "paddle", externalRef: "txn_refunded" })).toBe(false);
    expect(await revokeBidPass(user.organizationId, "txn_refunded")).toBe("revoked");
    expect((await getBidAccess(user.organizationId)).bidPasses).toBe(1);

    expect(await start("full")).toEqual({ ok: true, level: "full", source: "credit" });
    expect(await revokeBidPass(user.organizationId, "txn_used")).toBe("already_used");
    const [used] = await db.select().from(bidCredits).where(eq(bidCredits.externalRef, "txn_used"));
    expect(used!.consumedAt).not.toBeNull();
    expect(used!.expiresAt).toBeNull();

    expect(await revokeBidPass(user.organizationId, "txn_unknown")).toBe("not_found");
    const stranger = await createTestUser();
    expect(await revokeBidPass(stranger.organizationId, "txn_used")).toBe("not_found");
    // Inside a transaction, as the webhook calls it.
    await grantBidPass(user.organizationId, { source: "paddle", externalRef: "txn_tx" });
    expect(await db.transaction((tx) => revokeBidPass(user.organizationId, "txn_tx", tx))).toBe("revoked");
  });
});
