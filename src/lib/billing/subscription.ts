import "server-only";
import { eq, getTableColumns } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { subscriptions } from "@/db/schema";
import { env } from "@/env";
import { resolveEntitlements, type Entitlements } from "./entitlements";

export type SubscriptionRow = typeof subscriptions.$inferSelect;

/** Every column except `raw` (the last Paddle payload: large, and only useful for debugging). */
const { raw: _raw, ...subscriptionColumns } = getTableColumns(subscriptions);

/**
 * The workspace's subscription row. Runs on every authenticated request, so the stored
 * Paddle payload is not loaded: `raw` is always null here (read it from the table directly
 * when debugging).
 */
export async function getSubscription(organizationId: string, executor: DbOrTx = db): Promise<SubscriptionRow | null> {
  const [row] = await executor.select(subscriptionColumns).from(subscriptions).where(eq(subscriptions.organizationId, organizationId));
  return row ? { ...row, raw: null } : null;
}

export function entitlementsFor(subscription: SubscriptionRow | null, now: Date = new Date()): Entitlements {
  return resolveEntitlements(subscription, {
    graceDays: env.BILLING_PAST_DUE_GRACE_DAYS,
    periodEndGraceDays: env.BILLING_PERIOD_END_GRACE_DAYS,
    now,
  });
}

/** Current plan, limits and feature flags of a workspace. */
export async function getOrgEntitlements(organizationId: string, executor: DbOrTx = db): Promise<Entitlements> {
  return entitlementsFor(await getSubscription(organizationId, executor));
}
