import "server-only";
import { QUOTA_METRICS, QUOTA_METRIC_KEYS, type QuotaMetric } from "@/config/plans";
import { getAiSpendUsd, startOfUtcMonth } from "@/lib/ai";
import { getUsage, quotaPeriodStart } from "@/lib/billing/quota";
import { getSeatUsage, type SeatUsage } from "./members";
import type { OrgContext } from "./session";

export type MetricUsage = {
  key: QuotaMetric;
  label: string;
  description: string;
  period: "month" | "lifetime";
  used: number;
  /** null = unlimited */
  limit: number | null;
};

export type UsageSummary = {
  seats: SeatUsage;
  metrics: MetricUsage[];
  ai: { spentUsd: number; limitUsd: number };
  /** When monthly counters reset (start of next UTC month). */
  resetsAt: Date;
};

/** Usage vs. plan limits for the active workspace (Usage panel + Billing page). */
export async function getUsageSummary(ctx: OrgContext, now: Date = new Date()): Promise<UsageSummary> {
  const organizationId = ctx.organization.id;
  const monthStart = startOfUtcMonth(now);
  const [seats, aiSpent, ...quantities] = await Promise.all([
    getSeatUsage(ctx),
    getAiSpendUsd(monthStart, organizationId),
    ...QUOTA_METRIC_KEYS.map((metric) => getUsage(organizationId, metric, now)),
  ]);
  return {
    seats,
    metrics: QUOTA_METRIC_KEYS.map((key, index) => ({
      key,
      label: QUOTA_METRICS[key].label,
      description: QUOTA_METRICS[key].description,
      period: QUOTA_METRICS[key].period,
      used: quantities[index] ?? 0,
      limit: ctx.entitlements.limits[key],
    })),
    ai: { spentUsd: aiSpent, limitUsd: ctx.entitlements.limits.aiMonthlyBudgetUsd },
    resetsAt: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)),
  };
}

export { quotaPeriodStart };
