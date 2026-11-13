import type { Metadata } from "next";
import Link from "next/link";
import { ReplayWebhookButton, RetryJobButton } from "@/components/admin/admin-buttons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, StatRow } from "@/components/ui/stat";
import { formatPrice } from "@/config/plans";
import { getAdminActivity, getAdminConfigWarnings, getAdminMetrics } from "@/server/admin";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Overview" };

/** AI spend is an estimated cost in US dollars; revenue is in the catalogue's pounds. */
const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const when = (date: Date) => `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;

const list = "divide-y divide-line text-sm";
const row = "py-3 first:pt-0 last:pb-0";
const meta = "text-13 text-ink-2";
const empty = "text-sm text-ink-2";

/**
 * Founder overview: what needs attention first (configuration warnings), the key numbers,
 * then the queues and the latest errors and events. Built from the library: Alert, StatRow,
 * Card. Plain lists, no charts.
 */
export default async function AdminOverviewPage() {
  // Pages render in parallel with their layout, so each admin page guards itself.
  await requireAdminForPage();
  const [metrics, activity, configWarnings] = await Promise.all([getAdminMetrics(), getAdminActivity(), getAdminConfigWarnings()]);
  const conversion = metrics.trials.conversionRate === null ? "—" : `${Math.round(metrics.trials.conversionRate * 100)}%`;

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

      <StatRow frame="card" columns={4} aria-label="Key numbers">
        <Stat data-testid="admin-stat" value={String(metrics.signups.total)} label="Sign-ups" hint={`${metrics.signups.last7Days} in 7 days · ${metrics.signups.last30Days} in 30 days`} />
        <Stat data-testid="admin-stat" value={String(metrics.organizations.activated)} label="Activated workspaces" hint={`of ${metrics.organizations.total} workspaces`} />
        <Stat
          data-testid="admin-stat"
          value={String(metrics.subscriptions.paying)}
          label="Paying workspaces"
          hint={`${metrics.subscriptions.pastDue} past due · ${metrics.subscriptions.trialing} trialing`}
        />
        <Stat data-testid="admin-stat" value={formatPrice(metrics.mrrCents)} label="MRR (estimate)" hint="Catalogue prices, before tax and discounts" />
        <Stat data-testid="admin-stat" value={conversion} label="Trial to paid" hint={`${metrics.trials.converted} of ${metrics.trials.started} trials`} />
        <Stat data-testid="admin-stat" value={String(metrics.subscriptions.churnedLast30Days)} label="Churned (30 days)" hint="Subscriptions cancelled" />
        <Stat data-testid="admin-stat" value={usd(metrics.aiSpendUsd.today)} label="AI spend today" hint="Estimated, UTC day" />
        <Stat data-testid="admin-stat" value={usd(metrics.aiSpendUsd.month)} label="AI spend this month" hint="Estimated, UTC month" />
      </StatRow>

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
