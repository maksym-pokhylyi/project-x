import "server-only";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { bidCredits, bids } from "@/db/schema";
import { entitlementsFor, getSubscription } from "@/lib/billing/subscription";
import { NotFoundError } from "@/lib/errors";
import { allowanceWindow, carriedOver, monthLabel, windowAt, type AllowanceSubscription, type AllowanceWindow } from "./allowance";

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
 * Metering: usage is counted from the bids themselves — each bid is stamped with the start
 * of the allowance window it was taken from (`allowance_period_start`) — under a
 * per-workspace lock. The foundation's quota counters are not used: they reset on the 1st
 * of the calendar month, and the product rules below do not.
 *
 * Allowance windows (./allowance.ts): monthly windows that renew on the BILLING date, not
 * on the 1st. Full bids left over from the window just before carry into the current one
 * (at most one plan limit's worth), are used first and lapse when it ends. A trial
 * includes TRIAL_FULL_BIDS full bids in total. Cited checks follow the same windows and
 * do not carry over.
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

/** Full bids included in the 14-day trial, in total (not per month; nothing carries out of it). */
export const TRIAL_FULL_BIDS = 1;
/** How many windows back the carry-over is traced. One is what matters; a few more make it exact. */
const ROLLOVER_LOOKBACK_WINDOWS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

type PlanAccess = {
  planName: string;
  /** Null = unlimited. */
  fullBidsPerMonth: number | null;
  checksPerMonth: number | null;
  drafting: boolean;
  simulated: boolean;
  /** The subscription the windows are anchored on; null when there is none (or a plan is simulated). */
  subscription: AllowanceSubscription;
  /** True during the trial: the allowance is TRIAL_FULL_BIDS for the whole trial. */
  trial: boolean;
  /** Paid since (the end of the trial, or when the subscription began): windows before it carry nothing over. */
  paidSince: Date | null;
};

const SIMULATED_PLANS: Record<string, Pick<PlanAccess, "planName" | "fullBidsPerMonth" | "checksPerMonth" | "drafting">> = {
  free: { planName: "Free", fullBidsPerMonth: 0, checksPerMonth: 0, drafting: false },
  radar_pro: { planName: "Radar Pro", fullBidsPerMonth: 0, checksPerMonth: 1, drafting: false },
  bid_desk: { planName: "Bid Desk", fullBidsPerMonth: 3, checksPerMonth: 0, drafting: true },
  bid_desk_plus: { planName: "Bid Desk Plus", fullBidsPerMonth: 10, checksPerMonth: 0, drafting: true },
};

function simulatedPlan(): PlanAccess | null {
  if (process.env.VERCEL_ENV === "production") return null;
  const key = process.env.BIDS_SIMULATE_PLAN?.trim().toLowerCase();
  const plan = key ? SIMULATED_PLANS[key] : undefined;
  return plan ? { ...plan, simulated: true, subscription: null, trial: false, paidSince: null } : null;
}

function numericLimit(value: unknown): number | null | undefined {
  if (value === null) return null; // unlimited
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

async function planAccess(organizationId: string, executor: DbOrTx = db): Promise<PlanAccess> {
  const simulated = simulatedPlan();
  if (simulated) return simulated;
  const subscription = await getSubscription(organizationId, executor);
  const entitlements = entitlementsFor(subscription);
  const limits = entitlements.limits as unknown as Record<string, unknown>;
  const features = entitlements.features as unknown as Record<string, unknown>;
  const fullBids = numericLimit(limits[FULL_BID_METRIC]);
  const checks = numericLimit(limits[CHECK_METRIC]);
  const drafting = features[DRAFTING_FEATURE] === true;
  // The windows follow the subscription only while it is the one being honoured.
  const honoured = subscription && entitlements.isPaid ? subscription : null;
  const trial = honoured?.status === "trialing";
  const planLimit = fullBids === undefined ? 0 : fullBids;
  return {
    planName: entitlements.plan.name,
    fullBidsPerMonth: trial && drafting ? Math.min(TRIAL_FULL_BIDS, planLimit ?? TRIAL_FULL_BIDS) : planLimit,
    checksPerMonth: checks === undefined ? 0 : checks,
    drafting,
    simulated: false,
    subscription: honoured ? { billingInterval: honoured.billingInterval, currentPeriodStart: honoured.currentPeriodStart, currentPeriodEnd: honoured.currentPeriodEnd } : null,
    trial,
    paidSince: honoured ? (honoured.trialEnd ?? honoured.createdAt) : null,
  };
}

type WindowUsage = {
  window: AllowanceWindow;
  /** Taken from the plan in this window. */
  used: number;
  /** Full bids carried in from the window before (0 for checks, trials and unlimited plans). */
  carried: number;
  /** The window they were carried from, for the label. */
  carriedFrom: AllowanceWindow | null;
};

/**
 * What the plan allowance looks like right now: the current window, what was taken in it
 * and, for full bids, what was carried in. Counted from the bids' window stamps.
 */
async function windowUsage(organizationId: string, source: "plan_bid" | "plan_brief", plan: PlanAccess, executor: DbOrTx = db, now: Date = new Date()): Promise<WindowUsage> {
  const window = allowanceWindow(plan.subscription, now);
  const limit = plan.fullBidsPerMonth;
  // Carry-over needs a paid subscription that was already running in the window before.
  const rolls = source === "plan_bid" && !plan.trial && plan.paidSince !== null && limit !== null && limit > 0;
  const earlier: AllowanceWindow[] = [];
  if (rolls) {
    for (let back = 1; back <= ROLLOVER_LOOKBACK_WINDOWS; back += 1) {
      const candidate = windowAt(plan.subscription, now, -back);
      // A day of slack: the subscription row and its first period are stamped by different events.
      if (candidate.start.getTime() < plan.paidSince!.getTime() - DAY_MS) break;
      earlier.unshift(candidate);
    }
  }
  const from = earlier[0]?.start ?? window.start;
  const stamps = await executor
    .select({ stamp: bids.allowancePeriodStart })
    .from(bids)
    .where(and(eq(bids.organizationId, organizationId), eq(bids.accessSource, source), gte(bids.allowancePeriodStart, from)));
  const countIn = (range: AllowanceWindow) => stamps.filter((row) => row.stamp !== null && row.stamp >= range.start && row.stamp < range.end).length;
  return {
    window,
    used: countIn(window),
    carried: rolls ? carriedOver(limit!, earlier.map(countIn)) : 0,
    carriedFrom: earlier.at(-1) ?? null,
  };
}

/** Room left in the window: the plan's own allowance plus what was carried in. */
const roomIn = (limit: number | null, usage: WindowUsage): number | null => (limit === null ? null : Math.max(0, limit + usage.carried - usage.used));

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

const hasRoom = (limit: number | null, usage: WindowUsage): boolean => limit === null || usage.used < limit + usage.carried;

export type BidAccessSummary = {
  planName: string;
  simulated: boolean;
  /** Plan includes drafting, evaluation and answer export. */
  drafting: boolean;
  fullBids: {
    /** The plan's allowance per window (TRIAL_FULL_BIDS during a trial). Null = unlimited. */
    limit: number | null;
    /** Taken in the current window. */
    used: number;
    /** Left in the current window, carried-over bids included. Null = unlimited. */
    remaining: number | null;
    /** Carried-over bids that are still unused: they are used first and lapse at `useBy`. */
    rolledOver: { count: number; fromLabel: string; useBy: Date } | null;
    /** When the current window ends and the allowance renews. */
    renewsAt: Date;
    /** True during the trial: `limit` is for the whole trial. */
    trial: boolean;
  };
  checks: { limit: number | null; used: number; remaining: number | null; renewsAt: Date };
  /** Unused Bid Passes. */
  bidPasses: number;
  freeCheckAvailable: boolean;
  /** What starting a new bid now would use, or null when nothing is left. */
  next: { source: AllowanceSource; level: AccessLevel } | null;
};

function pickAllowance(input: {
  plan: PlanAccess;
  full: WindowUsage;
  checks: WindowUsage;
  freeCheck: boolean;
  bidPasses: number;
}): BidAccessSummary["next"] {
  const { plan } = input;
  if (plan.drafting && hasRoom(plan.fullBidsPerMonth, input.full)) return { source: "plan_bid", level: "full" };
  if (hasRoom(plan.checksPerMonth, input.checks)) return { source: "plan_brief", level: "brief" };
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
  const [full, checks, bidPasses, freeChecks] = await Promise.all([
    windowUsage(organizationId, "plan_bid", plan),
    windowUsage(organizationId, "plan_brief", plan),
    unusedCredits(organizationId, "bid_pass"),
    unusedCredits(organizationId, "free_brief"),
  ]);
  // Carried-over bids are used first, so what is left of them is the carry minus what was taken.
  const carriedLeft = Math.max(0, full.carried - full.used);
  return {
    planName: plan.planName,
    simulated: plan.simulated,
    drafting: plan.drafting,
    fullBids: {
      limit: plan.fullBidsPerMonth,
      used: full.used,
      remaining: roomIn(plan.fullBidsPerMonth, full),
      rolledOver: carriedLeft > 0 && full.carriedFrom ? { count: carriedLeft, fromLabel: monthLabel(full.carriedFrom.start), useBy: full.window.end } : null,
      renewsAt: full.window.end,
      trial: plan.trial,
    },
    checks: { limit: plan.checksPerMonth, used: checks.used, remaining: roomIn(plan.checksPerMonth, checks), renewsAt: checks.window.end },
    bidPasses,
    freeCheckAvailable: freeChecks > 0,
    next: pickAllowance({ plan, full, checks, freeCheck: freeChecks > 0, bidPasses }),
  };
}

/** Single seam for "may this workspace start (or unlock) a full bid now?". */
export async function canStartFullBid(organizationId: string): Promise<boolean> {
  const plan = await planAccess(organizationId);
  if (plan.drafting && hasRoom(plan.fullBidsPerMonth, await windowUsage(organizationId, "plan_bid", plan))) return true;
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

/** The window to stamp on the bid when the plan still has room, or null. The caller holds the workspace's allowance lock. */
async function planWindowWithRoom(organizationId: string, source: "plan_bid" | "plan_brief", plan: PlanAccess, tx: DbOrTx): Promise<AllowanceWindow | null> {
  const limit = source === "plan_bid" ? plan.fullBidsPerMonth : plan.checksPerMonth;
  const usage = await windowUsage(organizationId, source, plan, tx);
  return hasRoom(limit, usage) ? usage.window : null;
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
    // The stamp is the start of the window the allowance came from: it is what the counts are made of.
    const stamp = async (source: AllowanceSource, level: AccessLevel, window: AllowanceWindow = allowanceWindow(plan.subscription, new Date())): Promise<ReserveResult> => {
      await tx
        .update(bids)
        .set({ accessLevel: level, accessSource: source, allowancePeriodStart: window.start, updatedAt: new Date() })
        .where(and(eq(bids.id, bidId), eq(bids.organizationId, organizationId)));
      return { ok: true, level, source };
    };

    if (plan.drafting) {
      const window = await planWindowWithRoom(organizationId, "plan_bid", plan, tx);
      if (window) return stamp("plan_bid", "full", window);
    }
    if (want === "any") {
      if (plan.checksPerMonth === null || plan.checksPerMonth > 0) {
        const window = await planWindowWithRoom(organizationId, "plan_brief", plan, tx);
        if (window) return stamp("plan_brief", "brief", window);
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
 *
 * A purchased pass does not expire while the account exists: billing passes no `expiresAt`.
 */
export async function grantBidPass(organizationId: string, options: { source: string; externalRef?: string | null; expiresAt?: Date | null }, executor: DbOrTx = db): Promise<boolean> {
  const rows = await executor
    .insert(bidCredits)
    .values({ organizationId, kind: "bid_pass", source: options.source, externalRef: options.externalRef ?? null, expiresAt: options.expiresAt ?? null })
    .onConflictDoNothing()
    .returning({ id: bidCredits.id });
  return rows.length > 0;
}

/**
 * Takes back an unused Bid Pass after a refund (called by the billing webhook with the
 * reference the pass was granted under). A pass that already paid for a bid stays with
 * that bid. The row is kept, marked as lapsed, so a replay of the purchase event cannot
 * grant the pass again; calling this twice is harmless.
 */
export async function revokeBidPass(organizationId: string, externalRef: string, executor: DbOrTx = db): Promise<"revoked" | "already_used" | "not_found"> {
  const rows = await executor.execute<{ consumed_at: Date | null }>(sql`
    update bid_credits
    set expires_at = case when consumed_at is null then least(coalesce(expires_at, now()), now()) else expires_at end
    where organization_id = ${organizationId} and kind = 'bid_pass' and external_ref = ${externalRef}
    returning consumed_at
  `);
  if (rows.length === 0) return "not_found";
  return rows[0]!.consumed_at === null ? "revoked" : "already_used";
}
