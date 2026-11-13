import { UsageMeter } from "@/components/app/usage-meter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UsageSummary } from "@/server/usage";

const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

/** Usage vs. plan limits. Rendered on /app/usage and inside Settings → Billing. */
export function UsagePanel({ usage, planName }: { usage: UsageSummary; planName: string }) {
  const resets = usage.resetsAt.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
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
        <UsageMeter label="AI allowance this month" used={usage.ai.spentUsd} limit={usage.ai.limitUsd} format={usd} hint="Estimated cost of AI-assisted features." />
      </CardContent>
    </Card>
  );
}
