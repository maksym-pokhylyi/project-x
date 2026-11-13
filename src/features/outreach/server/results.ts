import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { iso } from "@/features/procurement/ingest/sql";
import { queryOptionalTable } from "@/lib/optional-table";
import { requireAdmin } from "@/server/session";
import { readFunnel, type FunnelCounts, type FunnelReading } from "../domain/funnel";

/**
 * What came of the letters: sent -> opened their page -> claimed it -> started a bid check,
 * and who opted out. Cross-tenant by design: every exported function starts with requireAdmin().
 *
 * How each step is measured
 *  - sent:    prospects the founder marked as sent;
 *  - visited: of those, prospects with a non-bot page view carrying their `?r=` code on or
 *             after the day of sending (the founder's own checks before sending do not
 *             count; mail scanners that follow links still can — claims are the firmer signal);
 *  - claimed: of those, prospects whose company was linked to a workspace after that visit;
 *  - bid checks: of those, the claiming workspace created a bid afterwards (table `bids`,
 *             owned by the bid desk — null while that module is not installed);
 *  - paying:  the claiming workspace has a paid or trialling Paddle subscription, or made a
 *             one-off purchase after the claim (a Bid Pass) that is still paid for
 *             (`billing_purchases`; a pass given by hand is not a payment).
 */

/**
 * A one-off purchase that still counts as a payment: completed, or refunded only in part —
 * the billing module's own rule for what stays handed over (src/lib/billing/fulfilment.ts).
 * A purchase refunded in full or under dispute is not one.
 */
export const PAID_PURCHASE_STATUSES = ["completed", "partially_refunded"] as const;

/** `'completed', 'partially_refunded'` for an SQL `in (…)`. */
export const paidPurchaseStatuses = (): SQL =>
  sql.join(
    PAID_PURCHASE_STATUSES.map((status) => sql`${status}`),
    sql`, `,
  );

type Row = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** CTEs shared by every funnel query: p (prospects), v (first counted visit), c (first claim after it). */
function funnelCtes(campaignId: string | null): SQL {
  const scope = campaignId ? sql`where p.campaign_id = ${campaignId}::uuid` : sql``;
  return sql`
    with p as (
      select p.id, p.ref_code, p.sent_at, p.status, p.email, p.email_kind, p.exported_at, coalesce(s.merged_into, s.id) as supplier_id
      from outreach_prospects p join suppliers s on s.id = p.supplier_id
      ${scope}
    ),
    v as (
      select p.id, min(pv.created_at) as first_visit_at
      from p join page_visits pv on pv.ref_code = p.ref_code and pv.is_bot = false and pv.page_type = 'supplier'
      where p.sent_at is not null and pv.created_at >= (date_trunc('day', p.sent_at at time zone 'UTC') at time zone 'UTC')
      group by p.id
    ),
    c as (
      select v.id, l.organization_id, min(l.created_at) as claimed_at
      from v join p on p.id = v.id
      join org_supplier_links l on l.supplier_id = p.supplier_id and l.created_at >= v.first_visit_at
      group by v.id, l.organization_id
    )`;
}

export type KindCounts = { sent: number; visited: number; claimed: number };

export type OutreachResults = {
  counts: FunnelCounts;
  reading: FunnelReading;
  /** Everything listed, whatever its status. */
  totals: { prospects: number; listed: number; exported: number; skipped: number; optedOutBeforeSending: number };
  /** Prospects with a counted page view that have not been marked as sent: a hint to mark the batch. */
  visitedNotMarkedSent: number;
  /** Generic mailboxes against named addresses (P2 §6.7: keep named ones only if they clearly do better). */
  byKind: { generic: KindCounts; named: KindCounts };
};

const n = (value: unknown) => Number(value ?? 0);

/** Results of one campaign, or of all of them together when no id is given. */
export async function getOutreachResults(campaignId: string | null = null, now: Date = new Date()): Promise<OutreachResults> {
  await requireAdmin();
  const scope = campaignId && UUID.test(campaignId) ? campaignId : null;
  const ctes = funnelCtes(scope);

  const [main] = (await db.execute(sql`
    ${ctes},
    claimed as (select distinct id from c),
    paying as (
      select distinct c.id from c
      where exists (
        select 1 from subscriptions sub where sub.organization_id = c.organization_id
          and sub.status in ('active', 'trialing', 'past_due') and sub.paddle_subscription_id is not null)
        or exists (
        select 1 from billing_purchases bp where bp.organization_id = c.organization_id
          and bp.status in (${paidPurchaseStatuses()}) and bp.created_at >= c.claimed_at)
    )
    select
      count(*)::int as prospects,
      count(*) filter (where p.status = 'listed')::int as listed,
      count(*) filter (where p.status = 'exported')::int as exported,
      count(*) filter (where p.status = 'skipped')::int as skipped,
      count(*) filter (where p.sent_at is not null)::int as sent,
      count(*) filter (where p.sent_at is not null and p.status = 'opted_out')::int as opted_out,
      count(*) filter (where p.sent_at is null and p.status = 'opted_out')::int as opted_out_unsent,
      max(p.sent_at) as last_sent_at,
      count(*) filter (where p.sent_at is not null and p.email_kind = 'generic')::int as sent_generic,
      count(*) filter (where p.sent_at is not null and p.email_kind = 'named')::int as sent_named,
      count(*) filter (where p.id in (select id from v))::int as visited,
      count(*) filter (where p.id in (select id from v) and p.email_kind = 'generic')::int as visited_generic,
      count(*) filter (where p.id in (select id from v) and p.email_kind = 'named')::int as visited_named,
      count(*) filter (where p.id in (select id from claimed))::int as claimed,
      count(*) filter (where p.id in (select id from claimed) and p.email_kind = 'generic')::int as claimed_generic,
      count(*) filter (where p.id in (select id from claimed) and p.email_kind = 'named')::int as claimed_named,
      count(*) filter (where p.id in (select id from paying))::int as paying,
      count(*) filter (where p.sent_at is not null and exists (
        select 1 from suppressions x where x.reason = 'bounce' and x.email = p.email))::int as bounced,
      count(*) filter (where exists (
        select 1 from suppressions x where x.reason = 'complaint' and (x.email = p.email or x.domain = split_part(p.email, '@', 2))))::int as complaints,
      count(*) filter (where p.sent_at is null and exists (
        select 1 from page_visits pv where pv.ref_code = p.ref_code and pv.is_bot = false and pv.page_type = 'supplier'))::int as visited_unsent
    from p
  `)) as unknown as Row[];

  // The bid desk's tables: null (shown as "—") until that module's migration is installed.
  const bidChecks = await queryOptionalTable("bids", async () => {
    const [row] = (await db.execute(sql`
      ${ctes}
      select count(distinct c.id)::int as value
      from c join bids b on b.organization_id = c.organization_id and b.created_at >= c.claimed_at
    `)) as unknown as Row[];
    return n(row?.value);
  });

  const lastSent = iso(main?.last_sent_at);
  const counts: FunnelCounts = {
    sent: n(main?.sent),
    visited: n(main?.visited),
    claimed: n(main?.claimed),
    bidChecks,
    cardPayments: n(main?.paying),
    optedOut: n(main?.opted_out),
    bounced: n(main?.bounced),
    complaints: n(main?.complaints),
    lastSentAt: lastSent ? new Date(lastSent) : null,
  };
  return {
    counts,
    reading: readFunnel(counts, now),
    totals: { prospects: n(main?.prospects), listed: n(main?.listed), exported: n(main?.exported), skipped: n(main?.skipped), optedOutBeforeSending: n(main?.opted_out_unsent) },
    visitedNotMarkedSent: n(main?.visited_unsent),
    byKind: {
      generic: { sent: n(main?.sent_generic), visited: n(main?.visited_generic), claimed: n(main?.claimed_generic) },
      named: { sent: n(main?.sent_named), visited: n(main?.visited_named), claimed: n(main?.claimed_named) },
    },
  };
}
