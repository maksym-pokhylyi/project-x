import type { Metadata } from "next";
import Link from "next/link";
import { ReplayWebhookButton, RetryJobButton } from "@/components/admin/admin-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminActivity, getAdminMetrics } from "@/server/admin";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Overview" };

const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const when = (date: Date) => `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4" data-testid="admin-stat">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default async function AdminOverviewPage() {
  // Pages render in parallel with their layout, so each admin page guards itself.
  await requireAdminForPage();
  const [metrics, activity] = await Promise.all([getAdminMetrics(), getAdminActivity()]);
  const conversion = metrics.trials.conversionRate === null ? "—" : `${Math.round(metrics.trials.conversionRate * 100)}%`;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sign-ups" value={String(metrics.signups.total)} hint={`${metrics.signups.last7Days} in 7 days · ${metrics.signups.last30Days} in 30 days`} />
        <Stat label="Activated workspaces" value={String(metrics.organizations.activated)} hint={`of ${metrics.organizations.total} workspaces`} />
        <Stat label="Paying workspaces" value={String(metrics.subscriptions.paying)} hint={`${metrics.subscriptions.pastDue} past due · ${metrics.subscriptions.trialing} trialing`} />
        <Stat label="MRR (estimate)" value={usd(metrics.mrrCents / 100)} hint="Catalogue prices, before tax and discounts" />
        <Stat label="Trial → paid" value={conversion} hint={`${metrics.trials.converted} of ${metrics.trials.started} trials`} />
        <Stat label="Churned (30 days)" value={String(metrics.subscriptions.churnedLast30Days)} hint="Subscriptions canceled" />
        <Stat label="AI spend today" value={usd(metrics.aiSpendUsd.today)} hint="Estimated, UTC day" />
        <Stat label="AI spend this month" value={usd(metrics.aiSpendUsd.month)} hint="Estimated, UTC month" />
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
