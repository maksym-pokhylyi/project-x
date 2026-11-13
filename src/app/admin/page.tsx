import type { Metadata } from "next";
import Link from "next/link";
import { ReplayWebhookButton, RetryJobButton } from "@/components/admin/admin-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminActivity, getAdminConfigWarnings, getAdminMetrics } from "@/server/admin";
import { getFounderKpis, type Windowed } from "@/server/admin-kpis";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Overview" };

const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
const when = (date: Date) => `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
const count = (value: number) => value.toLocaleString("en-GB");
/** "—" is "not measurable here" (a module that is not installed), never zero. */
const DASH = "—";
const inWindows = (figure: Windowed) => `${count(figure.last7Days)} in 7 days · ${count(figure.last30Days)} in 30 days`;

/** "12 minutes ago", "3 hours ago", "2 days ago". */
function ago(date: Date | null, now: Date): string {
  if (!date) return "never";
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

/**
 * One cell of the key numbers, after the design system's stat block: a large serif numeral
 * over its label, then one muted line of context. The cells share one white card and are
 * divided by hairlines (the grid's 1 px gaps).
 */
function Stat({ label, value, hint, link, testId }: { label: string; value: string; hint?: string; link?: { href: string; label: string }; testId?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-5 py-4" data-testid="admin-stat" data-kpi={testId}>
      <dt className="order-2 text-sm font-semibold text-ink">{label}</dt>
      <dd className="type-figure order-1 text-3xl text-ink">{value}</dd>
      {hint ? <dd className="order-3 text-13 text-ink-2">{hint}</dd> : null}
      {link ? (
        <dd className="order-4 text-13">
          <Link href={link.href} className="link">
            {link.label}
          </Link>
        </dd>
      ) : null}
    </div>
  );
}

export default async function AdminOverviewPage() {
  // Pages render in parallel with their layout, so each admin page guards itself.
  await requireAdminForPage();
  const now = new Date();
  const [metrics, activity, configWarnings, kpis] = await Promise.all([getAdminMetrics(now), getAdminActivity(), getAdminConfigWarnings(), getFounderKpis(now)]);
  const conversion = metrics.trials.conversionRate === null ? DASH : `${Math.round(metrics.trials.conversionRate * 100)}%`;
  const byPlan = kpis.paying.byPlan.map((plan) => `${plan.name} ${plan.paying}${plan.trialing > 0 ? ` (+${plan.trialing} trialing)` : ""}`).join(" · ");
  const aiBudget = kpis.aiSpendUsd.dailyBudget;
  const aiShare = aiBudget > 0 ? ` (${Math.round((kpis.aiSpendUsd.today / aiBudget) * 100)}%)` : "";
  const funnel = kpis.outreach;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>

      {configWarnings.length > 0 ? (
        <section aria-label="Configuration warnings" className="space-y-2" data-testid="config-warnings">
          {configWarnings.map((warning) => (
            <p key={warning.code} role="alert" data-testid="config-warning" data-level={warning.level} className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <strong>{warning.level === "error" ? "Action required" : "Warning"}:</strong> {warning.message}
            </p>
          ))}
        </section>
      ) : null}

      <section aria-label="Key numbers" data-testid="founder-kpis">
        {/* Sixteen cells: every row is full at one, two and four columns. */}
        <dl className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Stat testId="signups" label="Sign-ups" value={count(kpis.signups.total)} hint={inWindows(kpis.signups)} />
          <Stat testId="verified" label="Verified accounts" value={count(kpis.verifiedAccounts.total)} hint={`${inWindows(kpis.verifiedAccounts)} (by sign-up date)`} />
          <Stat testId="workspaces" label="Workspaces" value={count(kpis.workspaces.total)} hint={inWindows(kpis.workspaces)} />
          <Stat testId="claimed" label="Claimed companies" value={count(kpis.claimedCompanies.total)} hint={inWindows(kpis.claimedCompanies)} />
          <Stat
            testId="activated"
            label="Activated workspaces"
            value={kpis.activatedWorkspaces ? count(kpis.activatedWorkspaces.total) : DASH}
            hint={kpis.activatedWorkspaces ? `First bid check built · ${inWindows(kpis.activatedWorkspaces)}` : "First bid check built — the bid desk is not installed here yet"}
          />
          <Stat
            testId="paying"
            label="Paying workspaces"
            value={count(kpis.paying.total)}
            hint={`${byPlan || "No paid plans yet"} · ${kpis.paying.pastDue} past due · ${kpis.paying.trialing} trialing`}
          />
          <Stat testId="mrr" label="MRR" value={money(kpis.mrr.minor, kpis.mrr.currency)} hint="Active subscriptions at catalogue prices, annual ÷ 12, before tax and discounts" />
          <Stat
            testId="bid-pass"
            label="Bid Pass sales"
            value={count(kpis.bidPassSales.total)}
            hint={`${inWindows(kpis.bidPassSales)}${kpis.bidPassSales.refunded > 0 ? ` · ${count(kpis.bidPassSales.refunded)} more refunded or disputed` : ""}`}
          />
          <Stat label="Trial → paid" value={conversion} hint={`${metrics.trials.converted} of ${metrics.trials.started} trials`} />
          <Stat label="Churned (30 days)" value={String(metrics.subscriptions.churnedLast30Days)} hint="Subscriptions canceled" />
          <Stat
            testId="ai-spend"
            label="AI spend today"
            value={usd(kpis.aiSpendUsd.today)}
            hint={`of ${usd(aiBudget)} a day${aiShare} · 7 days ${usd(kpis.aiSpendUsd.last7Days)} · 30 days ${usd(kpis.aiSpendUsd.last30Days)} · estimated`}
          />
          <Stat
            testId="jobs"
            label="Job queue"
            value={`${count(kpis.jobs.pending)} pending`}
            hint={`${kpis.jobs.failedLast24Hours} failed in 24 hours · ${kpis.jobs.running} running${kpis.jobs.oldestPendingAt ? ` · oldest due ${ago(kpis.jobs.oldestPendingAt, now)}` : ""}`}
          />
          <Stat
            testId="ingestion"
            label="Data ingestion"
            value={ago(kpis.ingestion.lastSuccessAt, now)}
            hint={kpis.ingestion.lastError ? "Last run reported an error" : kpis.ingestion.lastSuccessAt ? `Last successful run ${when(kpis.ingestion.lastSuccessAt)}` : "No successful run recorded"}
            link={{ href: "/admin/ingestion", label: "Open ingestion" }}
          />
          <Stat
            testId="outreach"
            label="Outreach"
            value={`${count(funnel.sent)} sent`}
            hint={`${count(funnel.visited)} opened their page · ${count(funnel.claimed)} claimed · ${funnel.bidChecks === null ? DASH : count(funnel.bidChecks)} bid checks · ${count(funnel.optedOut)} opted out`}
            link={{ href: "/admin/outreach", label: "Open outreach" }}
          />
          <Stat
            testId="suppressions"
            label="Do-not-contact list"
            value={count(funnel.suppressions)}
            hint="Addresses and domains that are never listed or exported"
            link={{ href: "/admin/suppressions", label: "Open the list" }}
          />
          <Stat
            testId="data-requests"
            label="Correction and removal requests"
            value={`${count(funnel.openDataRequests)} open`}
            hint={funnel.openDataRequests > 0 ? `Oldest received ${ago(funnel.oldestDataRequestAt, now)}. Act within five working days.` : "Nothing waiting"}
            link={{ href: "/admin/suppressions#requests", label: "Open the requests" }}
          />
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Webhooks needing attention</CardTitle>
            <CardDescription>Failed, unmapped or conflicting Paddle events. Replay is idempotent.</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.webhookProblems.length === 0 ? (
              <p className="text-sm text-muted-foreground">All webhook events were processed.</p>
            ) : (
              <ul className="divide-y text-sm">
                {activity.webhookProblems.map((event) => (
                  <li key={event.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">{event.eventType}</p>
                      <p className="break-all text-xs text-muted-foreground">
                        {event.eventId} · {event.processedAt ? event.outcome : `failed ×${event.attempts}`} · {when(event.receivedAt)}
                      </p>
                      {event.error ? <p className="mt-1 break-words text-xs text-destructive">{event.error}</p> : null}
                    </div>
                    <ReplayWebhookButton eventId={event.eventId} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Background jobs</CardTitle>
            <CardDescription>Queue state by status, and jobs that exhausted their retries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.jobCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">The queue is empty.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {activity.jobCounts.map((row) => (
                  <div key={row.status} className="rounded-lg border p-2">
                    <dt className="text-xs text-muted-foreground">{row.status}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{row.count}</dd>
                  </div>
                ))}
              </dl>
            )}
            {activity.failedJobs.length > 0 ? (
              <ul className="divide-y text-sm">
                {activity.failedJobs.map((job) => (
                  <li key={job.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">{job.type}</p>
                      <p className="break-words text-xs text-destructive">{job.lastError}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.attempts} attempts · {when(job.updatedAt)}
                      </p>
                    </div>
                    <RetryJobButton jobId={job.id} />
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent errors</CardTitle>
            <CardDescription>Unexpected server errors from the error_log table.</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.recentErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No errors recorded.</p>
            ) : (
              <ul className="divide-y text-sm">
                {activity.recentErrors.map((error) => (
                  <li key={error.id} className="py-2">
                    <p className="break-words font-medium">{error.message}</p>
                    <p className="break-all text-xs text-muted-foreground">
                      {error.route ?? "unknown route"} · {when(error.createdAt)}
                      {error.requestId ? ` · ${error.requestId}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent events</CardTitle>
            <CardDescription>Latest product analytics events across all workspaces.</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {activity.recentEvents.map((event) => (
                  <li key={event.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">{event.name}</span>{" "}
                      {event.organizationId ? (
                        <Link href={`/admin/organizations/${event.organizationId}`} className="text-muted-foreground hover:underline">
                          {event.organizationName ?? event.organizationId}
                        </Link>
                      ) : null}
                    </span>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={event.createdAt.toISOString()}>
                      {when(event.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
