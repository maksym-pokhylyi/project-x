import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox, events, jobs, members, notificationLog, sessions, subscriptions, users } from "@/db/schema";
import type { ScheduledKind } from "@/features/notifications/config";
import { sendNotification, type SendOutcome } from "@/features/notifications/deliver";
import { loadMemberContext } from "@/features/notifications/recipients";
import { linkSupplier, setRadarItemState } from "@/features/procurement/radar/data";
import type { OrgContext } from "@/server/session";
import { addMember, createTestUser, type TestUser } from "../helpers/auth";
import { contractRelease, ingest, tenderRelease, type ContractSpec, type TenderSpec } from "../procurement/helpers/factory";

/**
 * Shared set-up for the scheduled e-mail tests.
 *
 * The market is seeded relative to the procurement factory's fixed clock (Friday
 * 13 November 2026, 12:00 UTC). The tests then look at it from fixed moments after that
 * and pass `now` explicitly: nothing here depends on the wall clock.
 */
export const SEEDED = new Date("2026-11-13T12:00:00Z");
/** Monday 16 November 2026, 07:30 UK time: the digest of ISO week 47 and that day's alert. */
export const MONDAY = new Date("2026-11-16T07:30:00Z");
export const MONDAY_REMINDERS = new Date("2026-11-16T08:00:00Z");
export const TUESDAY = new Date("2026-11-17T07:30:00Z");
export const NEXT_MONDAY = new Date("2026-11-23T07:30:00Z");
export const WEEK = "2026-W47";
export const NEXT_WEEK = "2026-W48";

export const LEEDS = { name: "Leeds City Council", ppon: "PLDS-1111-AAAA", region: "UKE42" };
export const YORK = { name: "City of York Council", ppon: "PYRK-2222-BBBB", region: "UKE21" };
export const BRISTOL = { name: "Bristol City Council", ppon: "PBRS-3333-CCCC", region: "UKK11" };
/** Grounds maintenance: Acme's trade. */
export const GROUNDS = ["77314000"];
/** Payroll software: nothing to do with it. */
export const SOFTWARE = ["48450000"];

const DAY = 86_400_000;
export const daysBefore = (date: Date, days: number) => new Date(date.getTime() - days * DAY);
export const hoursBefore = (date: Date, hours: number) => new Date(date.getTime() - hours * 3_600_000);

/** Acme Grounds Ltd with one grounds-maintenance contract in Yorkshire. Returns its supplier id. */
export async function seedAcme(): Promise<string> {
  await ingest([
    contractRelease({ title: "Grounds Maintenance Services", buyer: LEEDS, suppliers: [{ name: "Acme Grounds Ltd", coh: "01111111", region: "UKE42" }], cpv: GROUNDS, value: 120_000, signedDaysAgo: 60, endsInDays: 700 }),
  ]);
  return supplierId("01111111");
}

export async function supplierId(companyNumber: string): Promise<string> {
  const rows = await db.execute<{ id: string }>(sql`select id from suppliers where coh = ${companyNumber}`);
  if (!rows[0]) throw new Error(`no supplier ${companyNumber}`);
  return rows[0].id;
}

let tenderNumber = 0;

/**
 * Stores an open tender and says when we first saw it. A strong match for Acme by default:
 * its own CPV code, its own region, a value like its contract.
 */
export async function addTender(spec: Partial<TenderSpec> & { firstSeen: Date; ocid?: string }): Promise<string> {
  tenderNumber += 1;
  const ocid = spec.ocid ?? `ocds-h6vhtk-n${String(tenderNumber).padStart(5, "0")}`;
  const { firstSeen, ...rest } = spec;
  await ingest([tenderRelease({ title: `Grounds Maintenance Contract ${tenderNumber}`, buyer: LEEDS, cpv: GROUNDS, regions: ["UKE"], value: 100_000, deadlineInDays: 30, ...rest, ocid })], { profiles: false });
  await setFirstSeen(ocid, firstSeen);
  return ocid;
}

/** A rival's contract in Acme's trade, ending in `endsInDays` (from the seeded Friday). */
export async function addRivalContract(spec: Partial<ContractSpec> & { firstSeen: Date; rival?: string; coh?: string }): Promise<{ ocid: string; supplierId: string }> {
  tenderNumber += 1;
  const { firstSeen, rival, coh, ...rest } = spec;
  const companyNumber = coh ?? String(20_000_000 + tenderNumber);
  const ocid = spec.ocid ?? `ocds-h6vhtk-r${String(tenderNumber).padStart(5, "0")}`;
  await ingest([
    contractRelease({
      title: `Parks Grounds Maintenance ${tenderNumber}`,
      buyer: YORK,
      suppliers: [{ name: rival ?? `Rival Landscapes ${tenderNumber} Ltd`, coh: companyNumber, region: "UKE42" }],
      cpv: GROUNDS,
      value: 90_000,
      signedDaysAgo: 300,
      endsInDays: 120,
      ...rest,
      ocid,
    }),
  ]);
  await setFirstSeen(ocid, firstSeen);
  return { ocid, supplierId: await supplierId(companyNumber) };
}

/**
 * When a procurement first reached us. Publication and arrival are set to the same moment,
 * so "first seen" is exactly `at` (see tenderFirstSeen: arrival counts when it is within
 * 72 hours of publication).
 */
export async function setFirstSeen(ocid: string, at: Date): Promise<void> {
  const stamp = at.toISOString();
  await db.execute(sql`update notices set ingested_at = ${stamp}::timestamptz, published_at = ${stamp}::timestamptz where ocid = ${ocid}`);
  await db.execute(sql`update awards set published_at = ${stamp}::timestamptz where ocid = ${ocid}`);
}

/** A notice that was published long ago and only now arrived (a backfill): never news. */
export async function setBackfilled(ocid: string, published: Date, arrived: Date): Promise<void> {
  await db.execute(sql`update notices set published_at = ${published.toISOString()}::timestamptz, ingested_at = ${arrived.toISOString()}::timestamptz where ocid = ${ocid}`);
  await db.execute(sql`update awards set published_at = ${published.toISOString()}::timestamptz where ocid = ${ocid}`);
}

export type Workspace = { owner: TestUser; organizationId: string; ctx: (now?: Date) => Promise<OrgContext> };

/** A verified user with a workspace that follows `supplier` (Free plan unless a plan is given). */
export async function createWorkspace(options: { name?: string; email?: string; supplier?: string | null; plan?: PlanOptions } = {}): Promise<Workspace> {
  const owner = await createTestUser({ name: options.name, email: options.email });
  const organizationId = owner.organizationId;
  const ctx = async (now: Date = MONDAY) => {
    const context = await loadMemberContext(organizationId, owner.id, now);
    if (!context) throw new Error("not a member");
    return context;
  };
  if (options.plan) await setPlan(organizationId, options.plan);
  if (options.supplier) await linkSupplier(await ctx(), options.supplier);
  return { owner, organizationId, ctx };
}

/** Adds a second, verified person to a workspace. */
export async function addWorkspaceMember(workspace: Workspace, options: { name?: string; role?: "owner" | "admin" | "member" } = {}): Promise<TestUser> {
  const user = await createTestUser({ name: options.name });
  await addMember(workspace.organizationId, user, options.role ?? "member");
  await db.update(sessions).set({ activeOrganizationId: workspace.organizationId }).where(eq(sessions.userId, user.id));
  return user;
}

export type PlanOptions = { planKey?: "starter" | "pro" | "business"; interval?: "month" | "year"; status?: string; periodEnd?: Date; periodStart?: Date; raw?: unknown; cancelAt?: Date | null; pausedAt?: Date | null; canceledAt?: Date | null };

/** Puts a workspace on a paid plan (a subscriptions row as the Paddle webhooks would leave it). */
export async function setPlan(organizationId: string, options: PlanOptions = {}): Promise<void> {
  const periodEnd = options.periodEnd ?? new Date(MONDAY.getTime() + 200 * DAY);
  const values = {
    status: options.status ?? "active",
    planKey: options.planKey ?? "pro",
    billingInterval: options.interval ?? "month",
    currentPeriodStart: options.periodStart ?? new Date(periodEnd.getTime() - 365 * DAY),
    currentPeriodEnd: periodEnd,
    cancelAt: options.cancelAt ?? null,
    pausedAt: options.pausedAt ?? null,
    canceledAt: options.canceledAt ?? null,
    raw: options.raw ?? null,
    updatedAt: new Date(),
  };
  await db
    .insert(subscriptions)
    .values({ organizationId, paddleSubscriptionId: `sub_test_${organizationId}`, paddleCustomerId: `ctm_test_${organizationId}`, ...values })
    .onConflictDoUpdate({ target: subscriptions.organizationId, set: values });
}

export async function saveTender(workspace: Workspace, ocid: string, state: "saved" | "dismissed" | null = "saved"): Promise<void> {
  await setRadarItemState(await workspace.ctx(), ocid, state);
}

// ---------------------------------------------------------------------------
// Sending and looking at what happened
// ---------------------------------------------------------------------------

export function send(kind: ScheduledKind, period: string, who: { organizationId: string; userId: string }, now: Date): Promise<SendOutcome> {
  return sendNotification({ kind, period, organizationId: who.organizationId, userId: who.userId }, { now });
}

export const TEMPLATES = ["radar-digest", "radar-alert", "deadline-reminder", "renewal-reminder"];

export type OutboxEmail = { id: string; to: string; subject: string; template: string; html: string; text: string; headers: Record<string, string> | null; status: string };

/** Scheduled e-mails in the outbox, oldest first (sign-up e-mails and the like are left out). */
export async function scheduledEmails(to?: string): Promise<OutboxEmail[]> {
  const rows = await db
    .select()
    .from(emailOutbox)
    .where(and(inArray(emailOutbox.template, TEMPLATES), to ? eq(emailOutbox.toEmail, to.toLowerCase()) : undefined))
    .orderBy(asc(emailOutbox.createdAt), asc(emailOutbox.id));
  return rows.map((row) => ({ id: row.id, to: row.toEmail, subject: row.subject, template: row.template, html: row.html ?? "", text: row.text ?? "", headers: row.headers ?? null, status: row.status }));
}

export async function logRows(filter: { userId?: string; organizationId?: string; kind?: ScheduledKind } = {}) {
  return db
    .select()
    .from(notificationLog)
    .where(
      and(
        filter.userId ? eq(notificationLog.userId, filter.userId) : undefined,
        filter.organizationId ? eq(notificationLog.organizationId, filter.organizationId) : undefined,
        filter.kind ? eq(notificationLog.kind, filter.kind) : undefined,
      ),
    )
    .orderBy(asc(notificationLog.createdAt), asc(notificationLog.periodKey));
}

export async function eventsNamed(name: string) {
  return db.select().from(events).where(eq(events.name, name)).orderBy(asc(events.createdAt));
}

export async function jobsOfType(type: "notifications.fanout" | "notifications.send") {
  const rows = await db.select().from(jobs).where(eq(jobs.type, type)).orderBy(asc(jobs.runAfter), asc(jobs.createdAt));
  return rows.map((row) => ({ ...row, payload: row.payload as { kind: ScheduledKind; period: string; organizationId?: string; userId?: string; cursor?: unknown; offset?: number } }));
}

/** An e-mail's HTML as a reader would see its words: no tags, no head, single spaces. */
export function plainText(html: string): string {
  return html
    .replace(/<head>[\s\S]*?<\/head>/i, "")
    .replace(/<div [^>]*data-skip-in-text[\s\S]*?<\/div>\s*<\/div>/i, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every address in an e-mail's HTML: links, images, anything with a URL. */
export function urlsIn(html: string): string[] {
  return [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]!.replace(/&amp;/g, "&"));
}

export async function markUnverified(userId: string): Promise<void> {
  await db.update(users).set({ emailVerified: false }).where(eq(users.id, userId));
}

export async function removeMember(organizationId: string, userId: string): Promise<void> {
  await db.delete(members).where(and(eq(members.organizationId, organizationId), eq(members.userId, userId)));
}
