import "server-only";
import { eq, sql } from "drizzle-orm";
import { PLANS, isPlanKey } from "@/config/plans";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { formatDate } from "@/features/procurement/domain/format";
import type { OrgContext } from "@/server/session";
import { notificationsConfig } from "../config";
import { londonDayKey } from "../time";

/**
 * The annual-renewal reminder: one e-mail to each owner, about seven days before a yearly
 * subscription renews.
 *
 * What the `subscriptions` table gives us, and what it does not (reported to the lead):
 *  - billing_interval ("year") and current_period_end exist: the end of the paid period IS
 *    the renewal moment for an active subscription, and is what Settings → Billing shows;
 *  - there is no column for Paddle's `next_billed_at`, for a scheduled PAUSE (only a
 *    scheduled cancellation has `cancel_at`), or for the amount. All three are inside
 *    `raw`, the last subscription entity Paddle sent. `raw` is read here ONLY to hold a
 *    reminder back (a scheduled pause or cancellation, no next billing date) and to quote
 *    the price the subscription is on; it never causes a reminder that the columns alone
 *    would not.
 */
export type RenewalSubscription = {
  organizationId: string;
  status: string;
  planKey: string;
  priceId: string | null;
  billingInterval: string | null;
  quantity: number;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
  canceledAt: Date | null;
  pausedAt: Date | null;
  raw: unknown;
};

const DAY_MS = 86_400_000;

type PaddleRaw = {
  scheduled_change?: { action?: unknown } | null;
  next_billed_at?: unknown;
  discount?: unknown;
  items?: Array<{ quantity?: unknown; price?: { id?: unknown; unit_price?: { amount?: unknown; currency_code?: unknown } | null } | null }> | null;
};

const asRaw = (raw: unknown): PaddleRaw | null => (raw && typeof raw === "object" ? (raw as PaddleRaw) : null);

/**
 * True when this subscription will renew for another year within the reminder window:
 * billed yearly, active, not cancelled or paused (now or scheduled), and the paid period
 * ends 6 to 8 days from `now` — a three-day window, so one missed daily run still reminds.
 */
export function renewalDue(subscription: RenewalSubscription, now: Date): boolean {
  if (subscription.status !== "active" || subscription.billingInterval !== "year") return false;
  if (subscription.cancelAt || subscription.canceledAt || subscription.pausedAt || !subscription.currentPeriodEnd) return false;
  const raw = asRaw(subscription.raw);
  if (raw) {
    const scheduled = raw.scheduled_change?.action;
    if (scheduled === "cancel" || scheduled === "pause") return false;
    // Paddle sets next_billed_at to null when nothing more will be charged.
    if ("next_billed_at" in raw && raw.next_billed_at === null) return false;
  }
  const { min, max } = notificationsConfig.renewal.windowDays;
  const ahead = subscription.currentPeriodEnd.getTime() - now.getTime();
  return ahead >= min * DAY_MS && ahead <= max * DAY_MS;
}

/** One reminder per paid period: the key is the UK day the period ends on. */
export function renewalPeriodKey(subscription: Pick<RenewalSubscription, "currentPeriodEnd">): string {
  return londonDayKey(subscription.currentPeriodEnd!);
}

/**
 * The price the subscription is on, per year, as Paddle holds it ("£1,490"). Null when it
 * is not stored, or when a discount applies (the charge would differ from this figure):
 * an amount is quoted only when it is known.
 */
export function renewalPrice(subscription: RenewalSubscription): string | null {
  const raw = asRaw(subscription.raw);
  if (!raw || raw.discount) return null;
  const items = Array.isArray(raw.items) ? raw.items : [];
  const item = items.find((entry) => entry?.price?.id === subscription.priceId) ?? (items.length === 1 ? items[0] : undefined);
  const unit = item?.price?.unit_price;
  const minor = typeof unit?.amount === "string" || typeof unit?.amount === "number" ? Number(unit.amount) : Number.NaN;
  const currency = typeof unit?.currency_code === "string" ? unit.currency_code.toUpperCase() : null;
  if (!Number.isFinite(minor) || minor <= 0 || !currency || !/^[A-Z]{3}$/.test(currency)) return null;
  const quantity = typeof item?.quantity === "number" && item.quantity > 0 ? item.quantity : Math.max(1, subscription.quantity);
  try {
    const digits = new Intl.NumberFormat("en-GB", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    const amount = (minor * quantity) / 10 ** digits;
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : digits, maximumFractionDigits: digits }).format(amount);
  } catch {
    return null;
  }
}

const columns = {
  organizationId: subscriptions.organizationId,
  status: subscriptions.status,
  planKey: subscriptions.planKey,
  priceId: subscriptions.priceId,
  billingInterval: subscriptions.billingInterval,
  quantity: subscriptions.quantity,
  currentPeriodEnd: subscriptions.currentPeriodEnd,
  cancelAt: subscriptions.cancelAt,
  canceledAt: subscriptions.canceledAt,
  pausedAt: subscriptions.pausedAt,
  raw: subscriptions.raw,
};

/** Workspaces whose yearly subscription is due a reminder now, with the period it is for. */
export async function listRenewalsDue(now: Date): Promise<Array<{ organizationId: string; periodKey: string }>> {
  const { min, max } = notificationsConfig.renewal.windowDays;
  const rows = await db
    .select(columns)
    .from(subscriptions)
    .where(
      sql`${subscriptions.status} = 'active' and ${subscriptions.billingInterval} = 'year'
        and ${subscriptions.currentPeriodEnd} >= ${new Date(now.getTime() + min * DAY_MS).toISOString()}::timestamptz
        and ${subscriptions.currentPeriodEnd} <= ${new Date(now.getTime() + max * DAY_MS).toISOString()}::timestamptz`,
    );
  return rows.filter((row) => renewalDue(row, now)).map((row) => ({ organizationId: row.organizationId, periodKey: renewalPeriodKey(row) }));
}

export type RenewalContent = {
  asOf: Date;
  periodKey: string;
  workspace: string;
  planName: string;
  /** "20 Nov 2027" */
  renewsOn: string;
  renewsAt: Date;
  /** "£1,490"; null when not stored. */
  price: string | null;
};

/** The reminder for the workspace in `ctx`, re-checked against the subscription as it is now. Null when it no longer applies. */
export async function buildRenewal(ctx: OrgContext, now: Date, options: { everything?: boolean } = {}): Promise<RenewalContent | null> {
  const [row] = await db.select(columns).from(subscriptions).where(eq(subscriptions.organizationId, ctx.organization.id));
  if (!row || !row.currentPeriodEnd) return null;
  if (!options.everything && !renewalDue(row, now)) return null;
  return {
    asOf: now,
    periodKey: renewalPeriodKey(row),
    workspace: ctx.organization.name,
    planName: isPlanKey(row.planKey) ? PLANS[row.planKey].name : "paid",
    renewsOn: formatDate(row.currentPeriodEnd) ?? "",
    renewsAt: row.currentPeriodEnd,
    price: renewalPrice(row),
  };
}
