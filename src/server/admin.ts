import "server-only";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { ACTIVATION_EVENTS } from "@/config/events";
import { PLANS, isBillingInterval, isPlanKey } from "@/config/plans";
import { db } from "@/db";
import { auditLog, errorLog, events, jobs, members, organizations, subscriptions, usageCounters, users, webhookEvents } from "@/db/schema";
import { getAiSpendUsd, startOfUtcDay, startOfUtcMonth } from "@/lib/ai";
import { NotFoundError } from "@/lib/errors";
import { requireAdmin } from "./session";

/**
 * Founder dashboard queries. Cross-tenant BY DESIGN, so every function starts with
 * requireAdmin() (ADMIN_EMAILS + verified e-mail) — keep that as the first line.
 */

/** Monthly recurring revenue contribution of one subscription, in USD cents (catalogue price). */
export function monthlyRevenueCents(subscription: { status: string; planKey: string; billingInterval: string | null; quantity: number }): number {
  if (subscription.status !== "active" && subscription.status !== "past_due") return 0;
  if (!isPlanKey(subscription.planKey)) return 0;
  const prices = PLANS[subscription.planKey].prices;
  if (!prices) return 0;
  const interval = isBillingInterval(subscription.billingInterval) ? subscription.billingInterval : "month";
  const perMonth = interval === "year" ? prices.year / 12 : prices.month;
  return Math.round(perMonth * Math.max(1, subscription.quantity));
}

export type AdminMetrics = {
  signups: { total: number; last7Days: number; last30Days: number };
  organizations: { total: number; activated: number };
  subscriptions: { paying: number; trialing: number; pastDue: number; churnedLast30Days: number };
  /** Estimate from catalogue prices (excludes taxes, discounts, proration). */
  mrrCents: number;
  trials: { started: number; converted: number; conversionRate: number | null };
  aiSpendUsd: { today: number; month: number };
};

export async function getAdminMetrics(now: Date = new Date()): Promise<AdminMetrics> {
  await requireAdmin();
  const activation = sql.join(ACTIVATION_EVENTS.map((name) => sql`${name}`), sql`, `);

  const [[userCounts], [organizationCounts], [activated], allSubscriptions, aiToday, aiMonth] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        last7Days: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '7 days')::int`,
        last30Days: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '30 days')::int`,
      })
      .from(users),
    db.select({ total: sql<number>`count(*)::int` }).from(organizations),
    db
      .select({ value: sql<number>`count(distinct ${events.organizationId})::int` })
      .from(events)
      .where(sql`${events.name} in (${activation}) and ${events.organizationId} is not null`),
    db
      .select({
        status: subscriptions.status,
        planKey: subscriptions.planKey,
        billingInterval: subscriptions.billingInterval,
        quantity: subscriptions.quantity,
        trialEnd: subscriptions.trialEnd,
        canceledAt: subscriptions.canceledAt,
      })
      .from(subscriptions),
    getAiSpendUsd(startOfUtcDay(now)),
    getAiSpendUsd(startOfUtcMonth(now)),
  ]);

  const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const withTrial = allSubscriptions.filter((row) => row.trialEnd !== null);
  const converted = withTrial.filter((row) => row.status === "active" || row.status === "past_due");

  return {
    signups: { total: userCounts?.total ?? 0, last7Days: userCounts?.last7Days ?? 0, last30Days: userCounts?.last30Days ?? 0 },
    organizations: { total: organizationCounts?.total ?? 0, activated: activated?.value ?? 0 },
    subscriptions: {
      paying: allSubscriptions.filter((row) => row.status === "active" || row.status === "past_due").length,
      trialing: allSubscriptions.filter((row) => row.status === "trialing").length,
      pastDue: allSubscriptions.filter((row) => row.status === "past_due").length,
      churnedLast30Days: allSubscriptions.filter((row) => row.status === "canceled" && row.canceledAt && row.canceledAt.getTime() >= thirtyDaysAgo).length,
    },
    mrrCents: allSubscriptions.reduce((sum, row) => sum + monthlyRevenueCents(row), 0),
    trials: {
      started: withTrial.length,
      converted: converted.length,
      conversionRate: withTrial.length > 0 ? converted.length / withTrial.length : null,
    },
    aiSpendUsd: { today: aiToday, month: aiMonth },
  };
}

export async function getAdminActivity() {
  await requireAdmin();
  const [recentEvents, recentErrors, webhookProblems, jobCounts, failedJobs] = await Promise.all([
    db
      .select({ id: events.id, name: events.name, organizationId: events.organizationId, organizationName: organizations.name, createdAt: events.createdAt })
      .from(events)
      .leftJoin(organizations, eq(organizations.id, events.organizationId))
      .orderBy(desc(events.createdAt))
      .limit(30),
    db
      .select({ id: errorLog.id, message: errorLog.message, route: errorLog.route, requestId: errorLog.requestId, organizationId: errorLog.organizationId, createdAt: errorLog.createdAt })
      .from(errorLog)
      .orderBy(desc(errorLog.createdAt))
      .limit(20),
    // Anything that did not end as a plain success: failed, unmapped or conflicting events.
    db
      .select({
        id: webhookEvents.id,
        eventId: webhookEvents.eventId,
        eventType: webhookEvents.eventType,
        outcome: webhookEvents.outcome,
        error: webhookEvents.error,
        attempts: webhookEvents.attempts,
        processedAt: webhookEvents.processedAt,
        receivedAt: webhookEvents.receivedAt,
      })
      .from(webhookEvents)
      .where(sql`${webhookEvents.processedAt} is null or ${webhookEvents.outcome} in ('ignored_unmapped', 'ignored_conflict')`)
      .orderBy(desc(webhookEvents.receivedAt))
      .limit(20),
    db.select({ status: jobs.status, count: sql<number>`count(*)::int`, oldest: sql<Date | null>`min(${jobs.runAfter})` }).from(jobs).groupBy(jobs.status),
    db
      .select({ id: jobs.id, type: jobs.type, attempts: jobs.attempts, lastError: jobs.lastError, updatedAt: jobs.updatedAt })
      .from(jobs)
      .where(eq(jobs.status, "failed"))
      .orderBy(desc(jobs.updatedAt))
      .limit(10),
  ]);
  return { recentEvents, recentErrors, webhookProblems, jobCounts, failedJobs };
}

export async function listAdminOrganizations(search?: string) {
  await requireAdmin();
  const term = search?.trim();
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      createdAt: organizations.createdAt,
      planKey: subscriptions.planKey,
      status: subscriptions.status,
      memberCount: sql<number>`(select count(*)::int from members where members.organization_id = ${organizations.id})`,
    })
    .from(organizations)
    .leftJoin(subscriptions, eq(subscriptions.organizationId, organizations.id))
    .where(term ? or(ilike(organizations.name, `%${term}%`), ilike(organizations.slug, `%${term}%`), eq(organizations.id, term)) : undefined)
    .orderBy(desc(organizations.createdAt))
    .limit(100);
  return rows;
}

export async function getAdminOrganization(organizationId: string) {
  await requireAdmin();
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  if (!organization) throw new NotFoundError("Organization not found.");
  const [memberRows, [subscription], counters, recentEvents, recentAudit, aiMonth] = await Promise.all([
    db
      .select({ id: members.id, role: members.role, name: users.name, email: users.email, joinedAt: members.createdAt })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.organizationId, organizationId))
      .orderBy(members.createdAt),
    db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)),
    db.select().from(usageCounters).where(eq(usageCounters.organizationId, organizationId)).orderBy(desc(usageCounters.periodStart)).limit(12),
    db.select().from(events).where(eq(events.organizationId, organizationId)).orderBy(desc(events.createdAt)).limit(30),
    db.select().from(auditLog).where(eq(auditLog.organizationId, organizationId)).orderBy(desc(auditLog.createdAt)).limit(30),
    getAiSpendUsd(startOfUtcMonth(new Date()), organizationId),
  ]);
  return { organization, members: memberRows, subscription: subscription ?? null, counters, recentEvents, recentAudit, aiSpendMonthUsd: aiMonth };
}
