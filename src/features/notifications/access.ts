import type { Entitlements } from "@/lib/billing/entitlements";

/**
 * Plan gating for scheduled e-mails — the ONLY place this module reads entitlements
 * (the radar's own gating, the top-10 cap, stays in procurement/access.ts).
 *
 * Key (to be wired into the plan catalogue):
 *   features["radar.alerts"]  boolean  the plan includes daily alerts
 * While the catalogue has no such key, every paid plan has daily alerts and Free has the
 * weekly digest only (docs/product/SPEC.md §5). Change that decision here and nowhere else.
 */
export type NotificationAccess = {
  /** Daily alerts on weekdays, in addition to the weekly digest. */
  dailyAlerts: boolean;
};

export function notificationAccess(entitlements: Pick<Entitlements, "features" | "isPaid">): NotificationAccess {
  const explicit = (entitlements.features as unknown as Record<string, unknown>)["radar.alerts"];
  return { dailyAlerts: typeof explicit === "boolean" ? explicit : entitlements.isPaid };
}
