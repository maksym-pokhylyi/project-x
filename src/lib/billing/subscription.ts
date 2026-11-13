import "server-only";
import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { subscriptions } from "@/db/schema";
import { env } from "@/env";
import { resolveEntitlements, type Entitlements } from "./entitlements";

export type SubscriptionRow = typeof subscriptions.$inferSelect;

export async function getSubscription(organizationId: string, executor: DbOrTx = db): Promise<SubscriptionRow | null> {
  const [row] = await executor.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId));
  return row ?? null;
}

export function entitlementsFor(subscription: SubscriptionRow | null, now: Date = new Date()): Entitlements {
  return resolveEntitlements(subscription, { graceDays: env.BILLING_PAST_DUE_GRACE_DAYS, now });
}

/** Current plan, limits and feature flags of a workspace. */
export async function getOrgEntitlements(organizationId: string, executor: DbOrTx = db): Promise<Entitlements> {
  return entitlementsFor(await getSubscription(organizationId, executor));
}
