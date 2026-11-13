import { UsageMeter } from "@/components/app/usage-meter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BID_PASS_DISPLAY } from "@/config/plan-display";
import type { BidAllowance } from "@/server/bid-allowance";
import type { UsageSummary } from "@/server/usage";

/** The AI allowance is tracked as an estimated cost; people only need to know how much of it is used. */
const aiPercent = (spent: number, limit: number) => (limit <= 0 ? 100 : Math.min(100, Math.round((spent / limit) * 100)));

const day = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * These are counted by the bids module in windows that renew on the billing date, not by
 * the foundation's calendar-month counters, so they come from the bid allowance; "units"
 * is the foundation's placeholder metric and is never shown.
 */
const NOT_FROM_COUNTERS = new Set<string>(["units", "bids.monthly", "briefs.monthly"]);

/**
 * Usage against the plan's limits, for every member (/app/usage). Seats, then what the
 * plan gives for bids — read through the bid allowance (src/server/bid-allowance.ts) —
 * then the fair-use allowance. A plan without full bids or checks does not list them.
 */
export function UsagePanel({ usage, allowance, planName }: { usage: UsageSummary; allowance: BidAllowance | null; planName: string }) {
  const bids = allowance?.fullBids ?? null;
  const checks = allowance?.checks ?? null;
  const renews = bids?.renewsAt ?? checks?.renewsAt ?? null;
  const counters = usage.metrics.filter((metric) => !NOT_FROM_COUNTERS.has(metric.key));
  return (
    <Card data-testid="usage-panel">
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        <CardDescription>
          {planName} plan{renews ? ` · bids renew on ${day(renews)}` : ""}
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
        {bids && bids.limit !== 0 ? (
          <UsageMeter
            label={bids.trial ? "Full bids in your trial" : "Full bids this period"}
            used={bids.used}
            limit={bids.limit}
            hint={
              bids.rolledOver
                ? `Plus ${bids.rolledOver.count} rolled over from ${bids.rolledOver.fromLabel}: use ${bids.rolledOver.count === 1 ? "it" : "them"} by ${day(bids.rolledOver.useBy)}.`
                : undefined
            }
          />
        ) : null}
        {checks && checks.limit !== 0 ? <UsageMeter label="Cited bid checks this period" used={checks.used} limit={checks.limit} /> : null}
        {allowance && allowance.bidPasses > 0 ? (
          <UsageMeter label={`${BID_PASS_DISPLAY.name}es`} used={allowance.bidPasses} limit={null} valueText={`${allowance.bidPasses} unused`} hint="Each adds one full bid and does not expire while your account is open." />
        ) : null}
        {counters.map((metric) => (
          <UsageMeter key={metric.key} label={`${metric.label}${metric.period === "month" ? " this month" : ""}`} used={metric.used} limit={metric.limit} />
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
