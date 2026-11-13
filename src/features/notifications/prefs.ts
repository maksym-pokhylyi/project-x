import "server-only";
import { and, eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { notificationPrefs } from "@/db/schema";
import type { NotificationKind } from "./config";

/**
 * Notification preferences of one member in one workspace.
 *
 * A missing row means the defaults (everything on): always read through
 * `getNotificationPrefs()`. Writes are upserts, so there is never more than one row and a
 * second identical request changes nothing.
 */
export type PrefKey = "weeklyDigest" | "dailyAlerts" | "deadlineReminders" | "productEmails" | "renewalReminders";

export type NotificationPrefs = Record<PrefKey, boolean> & {
  /** Set by "unsubscribe from all e-mails". */
  unsubscribedAllAt: Date | null;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  weeklyDigest: true,
  dailyAlerts: true,
  deadlineReminders: true,
  productEmails: true,
  renewalReminders: true,
  unsubscribedAllAt: null,
};

export const PREF_OF_KIND: Record<NotificationKind, PrefKey> = {
  digest: "weeklyDigest",
  alert: "dailyAlerts",
  reminder: "deadlineReminders",
  product: "productEmails",
  renewal: "renewalReminders",
};

const KIND_OF_PREF = Object.fromEntries(Object.entries(PREF_OF_KIND).map(([kind, key]) => [key, kind])) as Record<PrefKey, NotificationKind>;

/**
 * Whether a kind may be sent under these preferences. "Unsubscribe from all" covers the
 * optional e-mails; the renewal reminder is a billing notice with its own switch, so that
 * stopping digests never means an annual plan renews unannounced.
 */
export function wantsKind(prefs: NotificationPrefs, kind: NotificationKind): boolean {
  if (kind !== "renewal" && prefs.unsubscribedAllAt) return false;
  return prefs[PREF_OF_KIND[kind]];
}

export async function getNotificationPrefs(userId: string, organizationId: string, executor: DbOrTx = db): Promise<NotificationPrefs> {
  const [row] = await executor
    .select()
    .from(notificationPrefs)
    .where(and(eq(notificationPrefs.userId, userId), eq(notificationPrefs.organizationId, organizationId)));
  if (!row) return { ...DEFAULT_PREFS };
  return {
    weeklyDigest: row.weeklyDigest,
    dailyAlerts: row.dailyAlerts,
    deadlineReminders: row.deadlineReminders,
    productEmails: row.productEmails,
    renewalReminders: row.renewalReminders,
    unsubscribedAllAt: row.unsubscribedAllAt,
  };
}

/**
 * For modules that send their own e-mails: may this member get a `kind` e-mail about this
 * workspace? (The bids module asks with "product" before "your bid check is ready".)
 */
export async function wantsNotification(userId: string, organizationId: string, kind: NotificationKind): Promise<boolean> {
  return wantsKind(await getNotificationPrefs(userId, organizationId), kind);
}

/** Sets individual switches. Returns the preferences before and after. */
export async function updateNotificationPrefs(
  userId: string,
  organizationId: string,
  changes: Partial<Record<PrefKey, boolean>>,
): Promise<{ before: NotificationPrefs; after: NotificationPrefs }> {
  const before = await getNotificationPrefs(userId, organizationId);
  const values = Object.fromEntries(Object.entries(changes).filter(([, value]) => typeof value === "boolean")) as Partial<Record<PrefKey, boolean>>;
  if (Object.keys(values).length === 0) return { before, after: before };
  await db
    .insert(notificationPrefs)
    .values({ userId, organizationId, ...values })
    .onConflictDoUpdate({ target: [notificationPrefs.userId, notificationPrefs.organizationId], set: { ...values, updatedAt: new Date() } });
  return { before, after: await getNotificationPrefs(userId, organizationId) };
}

/**
 * The "Email me the weekly digest" box on the sign-up form: call it once the account and
 * its workspace exist. Storing `true` is harmless (it is the default); storing `false`
 * means the first Monday brings nothing.
 */
export async function setDigestPreference(userId: string, organizationId: string, on: boolean): Promise<void> {
  await updateNotificationPrefs(userId, organizationId, { weeklyDigest: on });
}

/** Settings: "Turn e-mails back on" after an unsubscribe from everything. The individual switches apply again. */
export async function resubscribe(userId: string, organizationId: string): Promise<void> {
  await db
    .update(notificationPrefs)
    .set({ unsubscribedAllAt: null, updatedAt: new Date() })
    .where(and(eq(notificationPrefs.userId, userId), eq(notificationPrefs.organizationId, organizationId)));
}

/** Kinds that a change of switches turned off (for the `notification_unsubscribed` event). */
export function kindsTurnedOff(before: NotificationPrefs, after: NotificationPrefs): NotificationKind[] {
  return (Object.keys(KIND_OF_PREF) as PrefKey[]).filter((key) => before[key] && !after[key]).map((key) => KIND_OF_PREF[key]);
}
