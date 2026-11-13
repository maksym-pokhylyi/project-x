import "server-only";
import { and, count, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { members, organizations, users } from "@/db/schema";
import { entitlementsFor, getSubscription, type SubscriptionRow } from "@/lib/billing/subscription";
import type { OrgContext } from "@/server/session";
import { isRole, type Role } from "@/server/workspaces";
import { notificationAccess } from "./access";
import type { ScheduledKind } from "./config";

/**
 * Who a scheduled e-mail goes to.
 *
 * RULES (each is re-checked right before a message is written, not only at fan-out):
 *  - the person is a member of the workspace NOW (removed members stop at once);
 *  - their e-mail address is verified;
 *  - the workspace comes from the membership row — never from input.
 * A deleted workspace or account has no membership rows, so nothing can be addressed to it.
 */

function isPersonalWorkspace(metadata: string | null): boolean {
  if (!metadata) return false;
  try {
    return (JSON.parse(metadata) as { personal?: unknown }).personal === true;
  } catch {
    return false;
  }
}

/**
 * The same context `requireOrg()` gives a signed-in member, built for a background job:
 * the radar's data-access functions take it and filter on `ctx.organization.id`, so a
 * scheduled e-mail reads the workspace through exactly the code paths the app uses.
 * Null unless the user is a member of the workspace right now.
 */
export async function loadMemberContext(organizationId: string, userId: string, now: Date = new Date()): Promise<OrgContext | null> {
  const [row] = await db
    .select({ role: members.role, organization: organizations, user: users })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)))
    .limit(1);
  if (!row) return null;
  const [subscription, [memberCount]] = await Promise.all([
    getSubscription(organizationId),
    db.select({ value: count() }).from(members).where(eq(members.organizationId, organizationId)),
  ]);
  const entitlements = entitlementsFor(subscription, now);
  const role: Role = isRole(row.role) ? row.role : "member";
  const seatsUsed = memberCount?.value ?? 1;
  const seatLimit = entitlements.limits.seats;
  return {
    user: { id: row.user.id, name: row.user.name, email: row.user.email, image: row.user.image ?? null, emailVerified: row.user.emailVerified, isAdmin: false },
    sessionId: "job:notifications",
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      slug: row.organization.slug,
      logo: row.organization.logo,
      createdAt: row.organization.createdAt,
      isPersonal: isPersonalWorkspace(row.organization.metadata),
    },
    role,
    subscription,
    entitlements,
    plan: entitlements.plan,
    seats: { used: seatsUsed, limit: seatLimit, overLimit: seatLimit !== null && seatsUsed > seatLimit },
  };
}

export type FanoutMember = { organizationId: string; userId: string };

export type FanoutPage = { members: FanoutMember[]; /** Pass as `after` to get the next page; null when this was the last. */ next: FanoutMember | null };

type FanoutQuery = {
  kind: ScheduledKind;
  /** Continue after this member (keyset pagination on workspace, user). */
  after?: FanoutMember | null;
  limit: number;
  /** Restrict to these workspaces (reminders, renewals). */
  organizationIds?: readonly string[];
  /** Alerts on a digest day: leave out members who get the digest, which covers the same tenders. */
  exceptDigestRecipients?: boolean;
  now?: Date;
};

const PREF_COLUMN: Record<ScheduledKind, SQL> = {
  digest: sql`p.weekly_digest`,
  alert: sql`p.daily_alerts`,
  reminder: sql`p.deadline_reminders`,
  renewal: sql`p.renewal_reminders`,
};

const jsonTextArray = (values: readonly string[]) => sql`array(select jsonb_array_elements_text(${JSON.stringify(values)}::jsonb))`;

/**
 * One page of members a fan-out should create a send job for: verified address, the
 * preference for this kind on, and a workspace that can have something to say (a radar for
 * digests and alerts; owners only for renewals; daily alerts only where the plan has them).
 */
export async function listFanoutMembers(query: FanoutQuery): Promise<FanoutPage> {
  if (query.organizationIds && query.organizationIds.length === 0) return { members: [], next: null };
  const conditions: SQL[] = [sql`u.email_verified`, sql`coalesce(${PREF_COLUMN[query.kind]}, true)`];
  // "Unsubscribe from all" covers the optional e-mails; the renewal reminder has its own switch.
  if (query.kind !== "renewal") conditions.push(sql`p.unsubscribed_all_at is null`);
  if (query.kind === "digest" || query.kind === "alert") {
    conditions.push(sql`(exists (select 1 from org_supplier_links l where l.organization_id = m.organization_id) or exists (select 1 from radar_profiles r where r.organization_id = m.organization_id))`);
  }
  if (query.kind === "renewal") conditions.push(sql`m.role = 'owner'`);
  if (query.exceptDigestRecipients) conditions.push(sql`not coalesce(p.weekly_digest, true)`);
  if (query.organizationIds) conditions.push(sql`m.organization_id = any(${jsonTextArray(query.organizationIds)})`);
  if (query.after) conditions.push(sql`(m.organization_id, m.user_id) > (${query.after.organizationId}, ${query.after.userId})`);

  const rows = await db.execute<{
    organization_id: string;
    user_id: string;
    status: string | null;
    plan_key: string | null;
    past_due_since: Date | string | null;
    current_period_end: Date | string | null;
  }>(sql`
    select distinct m.organization_id, m.user_id, s.status, s.plan_key, s.past_due_since, s.current_period_end
    from members m
    join users u on u.id = m.user_id
    left join notification_prefs p on p.user_id = m.user_id and p.organization_id = m.organization_id
    left join subscriptions s on s.organization_id = m.organization_id
    where ${sql.join(conditions, sql` and `)}
    order by m.organization_id, m.user_id
    limit ${query.limit}
  `);

  const last = rows.length === query.limit ? rows[rows.length - 1]! : null;
  const now = query.now ?? new Date();
  const toDate = (value: Date | string | null) => (value === null ? null : value instanceof Date ? value : new Date(value));
  const selected = rows.filter((row) => {
    if (query.kind !== "alert") return true;
    // Daily alerts are a plan feature: the decision lives in notificationAccess().
    const subscription = row.status && row.plan_key ? ({ status: row.status, planKey: row.plan_key, pastDueSince: toDate(row.past_due_since), currentPeriodEnd: toDate(row.current_period_end) } as SubscriptionRow) : null;
    return notificationAccess(entitlementsFor(subscription, now)).dailyAlerts;
  });
  return {
    members: selected.map((row) => ({ organizationId: row.organization_id, userId: row.user_id })),
    next: last ? { organizationId: last.organization_id, userId: last.user_id } : null,
  };
}
