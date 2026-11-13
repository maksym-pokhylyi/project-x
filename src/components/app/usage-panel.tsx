import { UsageMeter } from "@/components/app/usage-meter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UsageSummary } from "@/server/usage";

/** The AI allowance is tracked as an estimated cost; people only need to know how much of it is used. */
const aiPercent = (spent: number, limit: number) => (limit <= 0 ? 100 : Math.min(100, Math.round((spent / limit) * 100)));

/** Usage vs. plan limits. Rendered on /app/usage and inside Settings → Billing. */
export function UsagePanel({ usage, planName }: { usage: UsageSummary; planName: string }) {
  const resets = usage.resetsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <Card data-testid="usage-panel">
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        <CardDescription>
          {planName} plan · monthly counters reset on {resets} (UTC)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <UsageMeter
          label="Seats"
          used={usage.seats.members + usage.seats.pendingInvitations}
          limit={usage.seats.limit}
          hint={
            usage.seats.pendingInvitations > 0
              ? `${usage.seats.members} members and ${usage.seats.pendingInvitations} pending invitation${usage.seats.pendingInvitations === 1 ? "" : "s"}`
              : undefined
          }
        />
        {usage.metrics.map((metric) => (
          <UsageMeter
            key={metric.key}
            label={`${metric.label}${metric.period === "month" ? " this month" : ""}`}
            used={metric.used}
            limit={metric.limit}
          />
        ))}
        <UsageMeter
          label="AI fair-use allowance this month"
          used={aiPercent(usage.ai.spentUsd, usage.ai.limitUsd)}
          limit={100}
          valueText={`${aiPercent(usage.ai.spentUsd, usage.ai.limitUsd)}% used`}
          hint="Reading tender packs, drafting and marking all count towards it. It is sized well above what the bids in your plan need."
        />
      </CardContent>
    </Card>
  );
}
