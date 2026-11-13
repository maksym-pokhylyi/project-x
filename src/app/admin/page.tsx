import type { Metadata } from "next";
import Link from "next/link";
import { ReplayWebhookButton, RetryJobButton } from "@/components/admin/admin-buttons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, StatRow } from "@/components/ui/stat";
import { getAdminActivity, getAdminConfigWarnings, getAdminMetrics } from "@/server/admin";
import { getFounderKpis, type Windowed } from "@/server/admin-kpis";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Overview" };

/** AI spend is an estimated cost in US dollars; revenue is in the catalogue's pounds. */
const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
const when = (date: Date) => `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
const count = (value: number) => value.toLocaleString("en-GB");
/** "—" is "not measurable here" (a module that is not installed), never zero. */
const DASH = "—";
const inWindows = (figure: Windowed) => `${count(figure.last7Days)} in 7 days · ${count(figure.last30Days)} in 30 days`;

const list = "divide-y divide-line text-sm";
const row = "py-3 first:pt-0 last:pb-0";
const meta = "text-13 text-ink-2";
const empty = "text-sm text-ink-2";

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

/** Marks a key number for the tests and the founder's scripts: every cell, and its name. */
const kpi = (name?: string) => ({ "data-testid": "admin-stat", "data-kpi": name });
const open = (href: string, label: string) => (
  <Link href={href} className="link">
    {label}
  </Link>
);

/**
 * Founder overview: what needs attention first (configuration warnings), the key numbers,
 * then the queues and the latest errors and events. Built from the library: Alert, StatRow,
 * Card. Plain lists, no charts.
 */
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
    <div className="flex flex-col gap-7 md:gap-8">
      <h1 className="type-page text-ink">Overview</h1>

      {configWarnings.length > 0 ? (
        <section aria-label="Configuration warnings" className="flex flex-col gap-2.5" data-testid="config-warnings">
          {configWarnings.map((warning) => (
            <Alert key={warning.code} variant={warning.level === "error" ? "destructive" : "warning"} data-testid="config-warning" data-level={warning.level}>
              <AlertTitle>{warning.level === "error" ? "Action required" : "Warning"}</AlertTitle>
              <AlertDescription>{warning.message}</AlertDescription>
            </Alert>
          ))}
        </section>
      ) : null}

      <section aria-label="Key numbers" data-testid="founder-kpis">
        {/* Sixteen cells in the library's stat card: every row is full at two and at four columns. */}
        <StatRow frame="card" columns={4}>
          <Stat {...kpi("signups")} label="Sign-ups" value={count(kpis.signups.total)} hint={inWindows(kpis.signups)} />
          <Stat {...kpi("verified")} label="Verified accounts" value={count(kpis.verifiedAccounts.total)} hint={`${inWindows(kpis.verifiedAccounts)} (by sign-up date)`} />
          <Stat {...kpi("workspaces")} label="Workspaces" value={count(kpis.workspaces.total)} hint={inWindows(kpis.workspaces)} />
          <Stat {...kpi("claimed")} label="Claimed companies" value={count(kpis.claimedCompanies.total)} hint={inWindows(kpis.claimedCompanies)} />
          <Stat
            {...kpi("activated")}
            label="Activated workspaces"
            value={kpis.activatedWorkspaces ? count(kpis.activatedWorkspaces.total) : DASH}
            hint={kpis.activatedWorkspaces ? `First bid check built · ${inWindows(kpis.activatedWorkspaces)}` : "First bid check built — the bid desk is not installed here yet"}
          />
          <Stat
            {...kpi("paying")}
            label="Paying workspaces"
            value={count(kpis.paying.total)}
            hint={`${byPlan || "No paid plans yet"} · ${kpis.paying.pastDue} past due · ${kpis.paying.trialing} trialing`}
          />
          <Stat {...kpi("mrr")} label="MRR" value={money(kpis.mrr.minor, kpis.mrr.currency)} hint="Active subscriptions at catalogue prices, annual ÷ 12, before tax and discounts" />
          <Stat
            {...kpi("bid-pass")}
            label="Bid Pass sales"
            value={count(kpis.bidPassSales.total)}
            hint={`${inWindows(kpis.bidPassSales)}${kpis.bidPassSales.refunded > 0 ? ` · ${count(kpis.bidPassSales.refunded)} more refunded or disputed` : ""}`}
          />
          <Stat {...kpi()} label="Trial → paid" value={conversion} hint={`${metrics.trials.converted} of ${metrics.trials.started} trials`} />
          <Stat {...kpi()} label="Churned (30 days)" value={String(metrics.subscriptions.churnedLast30Days)} hint="Subscriptions canceled" />
          <Stat
            {...kpi("ai-spend")}
            label="AI spend today"
            value={usd(kpis.aiSpendUsd.today)}
            hint={`of ${usd(aiBudget)} a day${aiShare} · 7 days ${usd(kpis.aiSpendUsd.last7Days)} · 30 days ${usd(kpis.aiSpendUsd.last30Days)} · estimated`}
          />
          <Stat
            {...kpi("jobs")}
            label="Job queue"
            value={`${count(kpis.jobs.pending)} pending`}
            hint={`${kpis.jobs.failedLast24Hours} failed in 24 hours · ${kpis.jobs.running} running${kpis.jobs.oldestPendingAt ? ` · oldest due ${ago(kpis.jobs.oldestPendingAt, now)}` : ""}`}
          />
          <Stat
            {...kpi("ingestion")}
            label="Data ingestion"
            value={ago(kpis.ingestion.lastSuccessAt, now)}
            hint={kpis.ingestion.lastError ? "Last run reported an error" : kpis.ingestion.lastSuccessAt ? `Last successful run ${when(kpis.ingestion.lastSuccessAt)}` : "No successful run recorded"}
            action={open("/admin/ingestion", "Open ingestion")}
          />
          <Stat
            {...kpi("outreach")}
            label="Outreach"
            value={`${count(funnel.sent)} sent`}
            hint={`${count(funnel.visited)} opened their page · ${count(funnel.claimed)} claimed · ${funnel.bidChecks === null ? DASH : count(funnel.bidChecks)} bid checks · ${count(funnel.optedOut)} opted out`}
            action={open("/admin/outreach", "Open outreach")}
          />
          <Stat
            {...kpi("suppressions")}
            label="Do-not-contact list"
            value={count(funnel.suppressions)}
            hint="Addresses and domains that are never listed or exported"
            action={open("/admin/suppressions", "Open the list")}
          />
          <Stat
            {...kpi("data-requests")}
            label="Correction and removal requests"
            value={`${count(funnel.openDataRequests)} open`}
            hint={funnel.openDataRequests > 0 ? `Oldest received ${ago(funnel.oldestDataRequestAt, now)}. Act within five working days.` : "Nothing waiting"}
            action={open("/admin/suppressions#requests", "Open the requests")}
          />
        </StatRow>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Webhooks needing attention</CardTitle>
            <CardDescription>Failed, unmapped or conflicting Paddle events. Replay is idempotent.</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.webhookProblems.length === 0 ? (
              <p className={empty}>All webhook events were processed.</p>
            ) : (
              <ul className={list}>
                {activity.webhookProblems.map((event) => (
                  <li key={event.id} className={`flex items-start justify-between gap-3 ${row}`}>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{event.eventType}</p>
                      <p className={`break-all ${meta}`}>
                        {event.eventId} · {event.processedAt ? event.outcome : `failed ×${event.attempts}`} · {when(event.receivedAt)}
                      </p>
                      {event.error ? <p className="mt-1 text-13 break-words text-danger">{event.error}</p> : null}
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
          <CardContent className="flex flex-col gap-5">
            {activity.jobCounts.length === 0 ? (
              <p className={empty}>The queue is empty.</p>
            ) : (
              <StatRow frame="rules" size="sm">
                {activity.jobCounts.map((count) => (
                  <Stat key={count.status} value={count.count.toLocaleString("en-GB")} label={count.status} />
                ))}
              </StatRow>
            )}
            {activity.failedJobs.length > 0 ? (
              <ul className={list}>
                {activity.failedJobs.map((job) => (
                  <li key={job.id} className={`flex items-start justify-between gap-3 ${row}`}>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{job.type}</p>
                      <p className="text-13 break-words text-danger">{job.lastError}</p>
                      <p className={meta}>
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
              <p className={empty}>No errors recorded.</p>
            ) : (
              <ul className={list}>
                {activity.recentErrors.map((error) => (
                  <li key={error.id} className={row}>
                    {/* Three lines are enough to recognise an error; the whole message is in the title and in error_log. */}
                    <p className="line-clamp-3 break-words text-ink" title={error.message}>
                      {error.message}
                    </p>
                    <p className={`break-all ${meta}`}>
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
              <p className={empty}>No events yet.</p>
            ) : (
              <ul className={list}>
                {activity.recentEvents.map((event) => (
                  <li key={event.id} className={`flex items-baseline justify-between gap-3 ${row}`}>
                    <span className="min-w-0">
                      <span className="font-semibold text-ink">{event.name}</span>{" "}
                      {event.organizationId ? (
                        <Link href={`/admin/organizations/${event.organizationId}`} className="link text-ink-2">
                          {event.organizationName ?? event.organizationId}
                        </Link>
                      ) : null}
                    </span>
                    <time className={`shrink-0 tabular-nums ${meta}`} dateTime={event.createdAt.toISOString()}>
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
