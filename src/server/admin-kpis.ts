import "server-only";
import { sql } from "drizzle-orm";
import * as planCatalogue from "@/config/plans";
import { PLANS, isPlanKey } from "@/config/plans";
import { db } from "@/db";
import { env } from "@/env";
import { countOpenDataRequests } from "@/features/outreach/server/data-requests";
import { getOutreachResults } from "@/features/outreach/server/results";
import { iso } from "@/features/procurement/ingest/sql";
import { getAiSpendUsd, startOfUtcDay } from "@/lib/ai";
import { queryOptionalTable } from "@/lib/optional-table";
import { monthlyRevenueCents } from "./admin";
import { requireAdmin } from "./session";

/**
 * The founder's numbers on /admin. Every figure is a query — nothing is estimated beyond
 * what its label says. Cross-tenant BY DESIGN, so the function starts with requireAdmin().
 *
 * Two figures depend on the bid desk, whose tables (`bids`, `bid_credits`) arrive with their
 * own migration: they are read through `queryOptionalTable` and are `null` — shown as "—",
 * never as a made-up zero — while those tables are absent.
 */
export type Windowed = { total: number; last7Days: number; last30Days: number };

export type FounderKpis = {
  signups: Windowed;
  /** Accounts with a verified e-mail address; the windows count accounts CREATED in them. */
  verifiedAccounts: Windowed;
  workspaces: Windowed;
  /** Distinct companies claimed by a workspace. */
  claimedCompanies: Windowed;
  /** Workspaces whose first bid check was built; windows by the date of that first check. Null without the bid desk. */
  activatedWorkspaces: Windowed | null;
  paying: { total: number; trialing: number; pastDue: number; byPlan: Array<{ planKey: string; name: string; paying: number; trialing: number }> };
  /** Monthly recurring revenue at catalogue prices (annual plans ÷ 12), in minor units of `currency`. */
  mrr: { minor: number; currency: string };
  /** Bid Passes bought through Paddle. Null without the bid desk. */
  bidPassSales: Windowed | null;
  aiSpendUsd: { today: number; last7Days: number; last30Days: number; dailyBudget: number };
  jobs: { pending: number; running: number; failedLast24Hours: number; oldestPendingAt: Date | null };
  ingestion: { lastSuccessAt: Date | null; lastRunAt: Date | null; lastError: string | null };
  outreach: {
    sent: number;
    visited: number;
    claimed: number;
    bidChecks: number | null;
    optedOut: number;
    suppressions: number;
    openDataRequests: number;
    oldestDataRequestAt: Date | null;
  };
};

type Row = Record<string, unknown>;
const n = (value: unknown) => Number(value ?? 0);
const date = (value: unknown): Date | null => {
  const text = iso(value);
  return text ? new Date(text) : null;
};
const windowed = (row: Row | undefined): Windowed => ({ total: n(row?.total), last7Days: n(row?.d7), last30Days: n(row?.d30) });

/** Catalogue prices are in one currency; a later catalogue names it (`PLAN_CURRENCY`), this product bills in pounds. */
const CATALOGUE_CURRENCY = (planCatalogue as { PLAN_CURRENCY?: string }).PLAN_CURRENCY ?? "GBP";

const DAY_MS = 86_400_000;

export async function getFounderKpis(now: Date = new Date()): Promise<FounderKpis> {
  await requireAdmin();
  const d7 = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const d30 = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const d1 = new Date(now.getTime() - DAY_MS).toISOString();
  /** "… as d7, … as d30": rows created in the last 7 and 30 days. */
  const createdInWindows = sql`count(*) filter (where created_at >= ${d7}::timestamptz)::int as d7, count(*) filter (where created_at >= ${d30}::timestamptz)::int as d30`;

  const [users, organizations, claims, subscriptionRows, jobs, ingestion, suppressionCount, aiToday, ai7, ai30, results, requests] = await Promise.all([
    db.execute(sql`
      select count(*)::int as total, ${createdInWindows},
             count(*) filter (where email_verified)::int as verified,
             count(*) filter (where email_verified and created_at >= ${d7}::timestamptz)::int as verified_d7,
             count(*) filter (where email_verified and created_at >= ${d30}::timestamptz)::int as verified_d30
      from users
    `),
    db.execute(sql`select count(*)::int as total, ${createdInWindows} from organizations`),
    db.execute(sql`
      select count(*)::int as total,
             count(*) filter (where first_claim >= ${d7}::timestamptz)::int as d7,
             count(*) filter (where first_claim >= ${d30}::timestamptz)::int as d30
      from (select supplier_id, min(created_at) as first_claim from org_supplier_links group by supplier_id) claimed
    `),
    db.execute(sql`select status, plan_key, billing_interval, quantity from subscriptions`),
    db.execute(sql`
      select count(*) filter (where status = 'pending')::int as pending,
             count(*) filter (where status = 'running')::int as running,
             count(*) filter (where status = 'failed' and updated_at >= ${d1}::timestamptz)::int as failed_24h,
             min(run_after) filter (where status = 'pending') as oldest_pending
      from jobs
    `),
    db.execute(sql`
      select max(last_success_at) as last_success, max(last_run_at) as last_run,
             (select last_error from ingest_state where last_error is not null order by last_run_at desc nulls last limit 1) as last_error
      from ingest_state
    `),
    db.execute(sql`select count(*)::int as total from suppressions`),
    getAiSpendUsd(startOfUtcDay(now)),
    getAiSpendUsd(new Date(d7)),
    getAiSpendUsd(new Date(d30)),
    getOutreachResults(null, now),
    countOpenDataRequests(),
  ]);

  // The bid desk: null (shown as "—") until its tables exist.
  const activatedWorkspaces = await queryOptionalTable("bids", async () => {
    const [row] = (await db.execute(sql`
      select count(*)::int as total,
             count(*) filter (where first_ready >= ${d7}::timestamptz)::int as d7,
             count(*) filter (where first_ready >= ${d30}::timestamptz)::int as d30
      from (select organization_id, min(ready_at) as first_ready from bids where ready_at is not null group by organization_id) activated
    `)) as unknown as Row[];
    return windowed(row);
  });
  const bidPassSales = await queryOptionalTable("bid_credits", async () => {
    const [row] = (await db.execute(sql`
      select count(*)::int as total,
             count(*) filter (where granted_at >= ${d7}::timestamptz)::int as d7,
             count(*) filter (where granted_at >= ${d30}::timestamptz)::int as d30
      from bid_credits where kind = 'bid_pass' and source = 'paddle'
    `)) as unknown as Row[];
    return windowed(row);
  });

  const userRow = (users as unknown as Row[])[0];
  const subscriptions = (subscriptionRows as unknown as Row[]).map((row) => ({
    status: String(row.status),
    planKey: String(row.plan_key),
    billingInterval: row.billing_interval === null || row.billing_interval === undefined ? null : String(row.billing_interval),
    quantity: n(row.quantity) || 1,
  }));
  const isPaying = (status: string) => status === "active" || status === "past_due";
  const byPlan = new Map<string, { planKey: string; name: string; paying: number; trialing: number }>();
  for (const subscription of subscriptions) {
    if (!isPaying(subscription.status) && subscription.status !== "trialing") continue;
    const entry = byPlan.get(subscription.planKey) ?? {
      planKey: subscription.planKey,
      name: isPlanKey(subscription.planKey) ? PLANS[subscription.planKey].name : `Unknown plan (${subscription.planKey})`,
      paying: 0,
      trialing: 0,
    };
    if (isPaying(subscription.status)) entry.paying += 1;
    else entry.trialing += 1;
    byPlan.set(subscription.planKey, entry);
  }
  const jobRow = (jobs as unknown as Row[])[0];
  const ingestRow = (ingestion as unknown as Row[])[0];

  return {
    signups: windowed(userRow),
    verifiedAccounts: { total: n(userRow?.verified), last7Days: n(userRow?.verified_d7), last30Days: n(userRow?.verified_d30) },
    workspaces: windowed((organizations as unknown as Row[])[0]),
    claimedCompanies: windowed((claims as unknown as Row[])[0]),
    activatedWorkspaces,
    paying: {
      total: subscriptions.filter((subscription) => isPaying(subscription.status)).length,
      trialing: subscriptions.filter((subscription) => subscription.status === "trialing").length,
      pastDue: subscriptions.filter((subscription) => subscription.status === "past_due").length,
      byPlan: [...byPlan.values()].sort((a, b) => b.paying - a.paying || a.name.localeCompare(b.name)),
    },
    mrr: { minor: subscriptions.reduce((sum, subscription) => sum + monthlyRevenueCents(subscription), 0), currency: CATALOGUE_CURRENCY },
    bidPassSales,
    aiSpendUsd: { today: aiToday, last7Days: ai7, last30Days: ai30, dailyBudget: env.AI_DAILY_BUDGET_USD },
    jobs: { pending: n(jobRow?.pending), running: n(jobRow?.running), failedLast24Hours: n(jobRow?.failed_24h), oldestPendingAt: date(jobRow?.oldest_pending) },
    ingestion: { lastSuccessAt: date(ingestRow?.last_success), lastRunAt: date(ingestRow?.last_run), lastError: typeof ingestRow?.last_error === "string" ? ingestRow.last_error : null },
    outreach: {
      sent: results.counts.sent,
      visited: results.counts.visited,
      claimed: results.counts.claimed,
      bidChecks: results.counts.bidChecks,
      optedOut: results.counts.optedOut,
      suppressions: n((suppressionCount as unknown as Row[])[0]?.total),
      openDataRequests: requests.open,
      oldestDataRequestAt: requests.oldestAt,
    },
  };
}
