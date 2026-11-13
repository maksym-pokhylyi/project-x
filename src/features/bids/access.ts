import "server-only";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { QUOTA_METRICS, type QuotaMetric } from "@/config/plans";
import { db, type DbOrTx } from "@/db";
import { bidCredits, bids } from "@/db/schema";
import { consumeQuota, getUsage, refundQuota } from "@/lib/billing/quota";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { NotFoundError } from "@/lib/errors";

/**
 * Plan gating for the bid desk — the ONLY file that knows how plans, quotas and one-off
 * credits turn into "may this workspace do X".
 *
 * Entitlement keys read from the foundation (src/config/plans.ts), all optional:
 *   limits["bids.monthly"]    full bids per month (check + questions + drafting + export)
 *   limits["briefs.monthly"]  cited bid checks per month (no drafting)
 *   features["bids.drafting"] drafting / evaluation / answer export available on the plan
 * When a key is absent the Free behaviour applies: no monthly allowance, no drafting, and
 * ONE free cited bid check per workspace, ever. A Bid Pass (`bid_credits`) buys one full
 * bid on any plan.
 *
 * Metering: when the metric is registered in QUOTA_METRICS the foundation's atomic
 * `consumeQuota` is the counter (so rollover etc. live in the quota layer). Until then —
 * and whenever a plan is simulated locally — usage is counted from the bids themselves.
 *
 * Local development: BIDS_SIMULATE_PLAN=free|radar_pro|bid_desk|bid_desk_plus pretends the
 * workspace is on that plan. Ignored on a Vercel production deployment.
 */

export type AccessLevel = "brief" | "full";
export type AllowanceSource = "plan_bid" | "plan_brief" | "free_brief" | "credit";

export const UPGRADE_URL = "/app/settings/billing";

const FULL_BID_METRIC = "bids.monthly";
const CHECK_METRIC = "briefs.monthly";
const DRAFTING_FEATURE = "bids.drafting";

type PlanAccess = {
  planName: string;
  /** Null = unlimited. */
  fullBidsPerMonth: number | null;
  checksPerMonth: number | null;
  drafting: boolean;
  simulated: boolean;
};

const SIMULATED_PLANS: Record<string, Omit<PlanAccess, "simulated">> = {
  free: { planName: "Free", fullBidsPerMonth: 0, checksPerMonth: 0, drafting: false },
  radar_pro: { planName: "Radar Pro", fullBidsPerMonth: 0, checksPerMonth: 1, drafting: false },
  bid_desk: { planName: "Bid Desk", fullBidsPerMonth: 3, checksPerMonth: 0, drafting: true },
  bid_desk_plus: { planName: "Bid Desk Plus", fullBidsPerMonth: 10, checksPerMonth: 0, drafting: true },
};

function simulatedPlan(): PlanAccess | null {
  if (process.env.VERCEL_ENV === "production") return null;
  const key = process.env.BIDS_SIMULATE_PLAN?.trim().toLowerCase();
  const plan = key ? SIMULATED_PLANS[key] : undefined;
  return plan ? { ...plan, simulated: true } : null;
}

function numericLimit(value: unknown): number | null | undefined {
  if (value === null) return null; // unlimited
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

async function planAccess(organizationId: string, executor: DbOrTx = db): Promise<PlanAccess> {
  const simulated = simulatedPlan();
  if (simulated) return simulated;
  const entitlements = await getOrgEntitlements(organizationId, executor);
  const limits = entitlements.limits as unknown as Record<string, unknown>;
  const features = entitlements.features as unknown as Record<string, unknown>;
  const fullBids = numericLimit(limits[FULL_BID_METRIC]);
  const checks = numericLimit(limits[CHECK_METRIC]);
  return {
    planName: entitlements.plan.name,
    fullBidsPerMonth: fullBids === undefined ? 0 : fullBids,
    checksPerMonth: checks === undefined ? 0 : checks,
    drafting: features[DRAFTING_FEATURE] === true,
    simulated: false,
  };
}

function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** True when the foundation meters this key itself (registered in QUOTA_METRICS). */
function foundationMeters(metric: string, plan: PlanAccess): metric is QuotaMetric {
  return !plan.simulated && Object.prototype.hasOwnProperty.call(QUOTA_METRICS, metric);
}

async function usedThisMonth(organizationId: string, source: "plan_bid" | "plan_brief", plan: PlanAccess, executor: DbOrTx = db): Promise<number> {
  const metric = source === "plan_bid" ? FULL_BID_METRIC : CHECK_METRIC;
  if (foundationMeters(metric, plan)) return getUsage(organizationId, metric);
  const [row] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(bids)
    .where(and(eq(bids.organizationId, organizationId), eq(bids.accessSource, source), gte(bids.allowancePeriodStart, monthStart())));
  return row?.count ?? 0;
}

async function unusedCredits(organizationId: string, kind: "bid_pass" | "free_brief", executor: DbOrTx = db): Promise<number> {
  const [row] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(bidCredits)
    .where(
      and(
        eq(bidCredits.organizationId, organizationId),
        eq(bidCredits.kind, kind),
        isNull(bidCredits.consumedAt),
        sql`(${bidCredits.expiresAt} is null or ${bidCredits.expiresAt} > now())`,
      ),
    );
  return row?.count ?? 0;
}

/** Every workspace gets exactly one free check: the credit row is created on first look. */
async function ensureFreeCheck(organizationId: string, executor: DbOrTx = db): Promise<void> {
  await executor.insert(bidCredits).values({ organizationId, kind: "free_brief", source: "signup" }).onConflictDoNothing();
}

const remainingOf = (limit: number | null, used: number): number | null => (limit === null ? null : Math.max(0, limit - used));
const hasRoom = (limit: number | null, used: number): boolean => limit === null || used < limit;

export type BidAccessSummary = {
  planName: string;
  simulated: boolean;
  /** Plan includes drafting, evaluation and answer export. */
  drafting: boolean;
  fullBids: { limit: number | null; used: number; remaining: number | null };
  checks: { limit: number | null; used: number; remaining: number | null };
  /** Unused Bid Passes. */
  bidPasses: number;
  freeCheckAvailable: boolean;
  /** What starting a new bid now would use, or null when nothing is left. */
  next: { source: AllowanceSource; level: AccessLevel } | null;
};

function pickAllowance(input: {
  plan: PlanAccess;
  fullUsed: number;
  checksUsed: number;
  freeCheck: boolean;
  bidPasses: number;
}): BidAccessSummary["next"] {
  const { plan } = input;
  if (plan.drafting && hasRoom(plan.fullBidsPerMonth, input.fullUsed)) return { source: "plan_bid", level: "full" };
  if (hasRoom(plan.checksPerMonth, input.checksUsed)) return { source: "plan_brief", level: "brief" };
  // A check first, the pass only when it is the last thing left: nobody should spend a
  // Bid Pass to find out they are not eligible.
  if (input.freeCheck) return { source: "free_brief", level: "brief" };
  if (input.bidPasses > 0) return { source: "credit", level: "full" };
  return null;
}

/** What the workspace may do right now (for pages and upgrade notices). */
export async function getBidAccess(organizationId: string): Promise<BidAccessSummary> {
  await ensureFreeCheck(organizationId);
  const plan = await planAccess(organizationId);
  const [fullUsed, checksUsed, bidPasses, freeChecks] = await Promise.all([
    usedThisMonth(organizationId, "plan_bid", plan),
    usedThisMonth(organizationId, "plan_brief", plan),
    unusedCredits(organizationId, "bid_pass"),
    unusedCredits(organizationId, "free_brief"),
  ]);
  return {
    planName: plan.planName,
    simulated: plan.simulated,
    drafting: plan.drafting,
    fullBids: { limit: plan.fullBidsPerMonth, used: fullUsed, remaining: remainingOf(plan.fullBidsPerMonth, fullUsed) },
    checks: { limit: plan.checksPerMonth, used: checksUsed, remaining: remainingOf(plan.checksPerMonth, checksUsed) },
    bidPasses,
    freeCheckAvailable: freeChecks > 0,
    next: pickAllowance({ plan, fullUsed, checksUsed, freeCheck: freeChecks > 0, bidPasses }),
  };
}

/** Single seam for "may this workspace start (or unlock) a full bid now?". */
export async function canStartFullBid(organizationId: string): Promise<boolean> {
  const plan = await planAccess(organizationId);
  if (plan.drafting && hasRoom(plan.fullBidsPerMonth, await usedThisMonth(organizationId, "plan_bid", plan))) return true;
  return (await unusedCredits(organizationId, "bid_pass")) > 0;
}

async function consumeCredit(organizationId: string, kind: "bid_pass" | "free_brief", bidId: string, tx: DbOrTx): Promise<boolean> {
  const rows = await tx.execute<{ id: string }>(sql`
    update bid_credits
    set consumed_at = now(), consumed_bid_id = ${bidId}
    where id = (
      select id from bid_credits
      where organization_id = ${organizationId} and kind = ${kind} and consumed_at is null
        and (expires_at is null or expires_at > now())
      order by granted_at asc
      limit 1
      for update skip locked
    )
    returning id
  `);
  return rows.length > 0;
}

async function consumeMonthly(organizationId: string, source: "plan_bid" | "plan_brief", plan: PlanAccess, tx: DbOrTx): Promise<boolean> {
  const metric = source === "plan_bid" ? FULL_BID_METRIC : CHECK_METRIC;
  const limit = source === "plan_bid" ? plan.fullBidsPerMonth : plan.checksPerMonth;
  if (foundationMeters(metric, plan)) return (await consumeQuota(organizationId, metric)).ok;
  // Counted from the bids themselves; the caller holds the workspace's allowance lock.
  return hasRoom(limit, await usedThisMonth(organizationId, source, plan, tx));
}

export type ReserveResult = { ok: true; level: AccessLevel; source: AllowanceSource } | { ok: false; reason: "none_left" };

/**
 * Takes one allowance for `bidId` and stamps it on the bid, atomically per workspace.
 * `want: "full"` only accepts a full-bid allowance (plan bid or Bid Pass) — this is what
 * unlocking drafting on an existing check uses. Idempotent: a bid that already holds a
 * sufficient allowance is returned as is.
 */
async function reserve(organizationId: string, bidId: string, want: "any" | "full"): Promise<ReserveResult> {
  await ensureFreeCheck(organizationId);
  return db.transaction(async (tx) => {
    // One allowance decision at a time per workspace.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`bids-allowance:${organizationId}`}, 0))`);
    const [bid] = await tx.select().from(bids).where(and(eq(bids.id, bidId), eq(bids.organizationId, organizationId)));
    if (!bid) throw new NotFoundError("Bid not found.");
    if (bid.accessSource && (want === "any" || bid.accessLevel === "full")) {
      return { ok: true, level: bid.accessLevel as AccessLevel, source: bid.accessSource as AllowanceSource };
    }

    const plan = await planAccess(organizationId, tx);
    const stamp = async (source: AllowanceSource, level: AccessLevel): Promise<ReserveResult> => {
      await tx
        .update(bids)
        .set({ accessLevel: level, accessSource: source, allowancePeriodStart: monthStart(), updatedAt: new Date() })
        .where(and(eq(bids.id, bidId), eq(bids.organizationId, organizationId)));
      return { ok: true, level, source };
    };

    if (plan.drafting && (await consumeMonthly(organizationId, "plan_bid", plan, tx))) {
      try {
        return await stamp("plan_bid", "full");
      } catch (error) {
        if (foundationMeters(FULL_BID_METRIC, plan)) await refundQuota(organizationId, FULL_BID_METRIC).catch(() => undefined);
        throw error;
      }
    }
    if (want === "any") {
      if ((plan.checksPerMonth === null || plan.checksPerMonth > 0) && (await consumeMonthly(organizationId, "plan_brief", plan, tx))) {
        try {
          return await stamp("plan_brief", "brief");
        } catch (error) {
          if (foundationMeters(CHECK_METRIC, plan)) await refundQuota(organizationId, CHECK_METRIC).catch(() => undefined);
          throw error;
        }
      }
      if (await consumeCredit(organizationId, "free_brief", bidId, tx)) return stamp("free_brief", "brief");
    }
    if (await consumeCredit(organizationId, "bid_pass", bidId, tx)) return stamp("credit", "full");
    return { ok: false, reason: "none_left" };
  });
}

/** Takes the best available allowance for a new bid (see `getBidAccess().next`). */
export function consumeBidAllowance(organizationId: string, bidId: string): Promise<ReserveResult> {
  return reserve(organizationId, bidId, "any");
}

/** Single seam for spending a full bid (plan allowance first, then a Bid Pass) on `bidId`. */
export function consumeFullBid(organizationId: string, bidId: string): Promise<ReserveResult> {
  return reserve(organizationId, bidId, "full");
}

export type BidCapabilities = {
  /** Draft, regenerate, evaluate, apply suggestions. */
  drafting: boolean;
  /** Export answers as a Word document (the check itself can always be exported). */
  exportAnswers: boolean;
  /** Why drafting is locked, for the upgrade notice. */
  lockedReason: "check_only" | "plan_lapsed" | null;
};

/**
 * What a bid allows. A bid paid for with a Bid Pass keeps full access for good; a bid
 * taken from a plan's monthly allowance needs that plan (or any drafting plan) to still be
 * active — after a downgrade the work stays readable but locked.
 */
export async function getBidCapabilities(organizationId: string, bid: { accessLevel: string; accessSource: string | null }): Promise<BidCapabilities> {
  if (bid.accessLevel !== "full") return { drafting: false, exportAnswers: false, lockedReason: "check_only" };
  if (bid.accessSource === "credit") return { drafting: true, exportAnswers: true, lockedReason: null };
  const plan = await planAccess(organizationId);
  return plan.drafting ? { drafting: true, exportAnswers: true, lockedReason: null } : { drafting: false, exportAnswers: false, lockedReason: "plan_lapsed" };
}

/**
 * Grants a Bid Pass (called by billing when a one-off purchase completes, or by an admin).
 * `externalRef` makes the grant idempotent: the same reference never grants twice.
 * Returns true when a new credit was created.
 */
export async function grantBidPass(organizationId: string, options: { source: string; externalRef?: string | null; expiresAt?: Date | null }, executor: DbOrTx = db): Promise<boolean> {
  const rows = await executor
    .insert(bidCredits)
    .values({ organizationId, kind: "bid_pass", source: options.source, externalRef: options.externalRef ?? null, expiresAt: options.expiresAt ?? null })
    .onConflictDoNothing()
    .returning({ id: bidCredits.id });
  return rows.length > 0;
}
