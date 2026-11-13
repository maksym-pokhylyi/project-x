import type { Metadata } from "next";
import { getNotificationsOverview, listPreviewWorkspaces, type FanoutRun } from "@/features/notifications/admin";
import { NotificationPreviewForm } from "@/features/notifications/components/preview-form";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Notifications" };

const when = (date: Date | null) => (date ? `${date.toISOString().replace("T", " ").slice(0, 16)} UTC` : "—");

function fanoutLine(run: FanoutRun | null): string {
  if (!run) return "Not run yet";
  const state = run.status === "succeeded" ? "done" : run.status === "failed" ? "FAILED" : run.status;
  return `${run.period} · ${state} · ${when(run.finishedAt ?? run.startedAt)}`;
}

/**
 * Founder view of the scheduled e-mails: are they running, when did each kind last fan out,
 * what happened in the last seven days, and a button to look at one. Counts only.
 * Link it from the admin nav at integration (as /admin/ingestion).
 */
export default async function AdminNotificationsPage() {
  // Pages render in parallel with their layout, so each admin page guards itself.
  const admin = await requireAdminForPage();
  const [overview, workspaces] = await Promise.all([getNotificationsOverview(), listPreviewWorkspaces()]);
  const columns = ["E-mail", "Schedule (UK time)", "Last fan-out", "Sent", "Nothing new", "Switched off", "Failed", "Not delivered", "Opened from"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scheduled e-mails: weekly digest, daily alerts, deadline reminders, annual-renewal reminder. Numbers cover the last 7 days.
        </p>
      </div>

      {overview.paused ? (
        <p role="alert" data-testid="notifications-paused" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <strong>Paused:</strong> NOTIFICATIONS_PAUSED=1 is set. Nothing is scheduled and queued e-mails are not sent. Remove the variable and redeploy to resume; the
          next e-mail covers everything since the last one that went out.
        </p>
      ) : null}
      {overview.mailDelivery !== "resend" ? (
        <p role="status" className="rounded-md border p-3 text-sm text-muted-foreground">
          {overview.mailDelivery === "outbox"
            ? "No mail provider is configured: e-mails are written to the dev outbox (/dev/outbox) instead of being delivered."
            : "No mail provider and no dev outbox: nothing is scheduled."}
        </p>
      ) : null}

      <section aria-labelledby="week" className="space-y-3">
        <h2 id="week" className="text-lg font-semibold">
          Last 7 days
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[56rem] text-sm" data-testid="notifications-table">
            <thead className="bg-muted text-left text-xs tracking-wider text-muted-foreground uppercase">
              <tr>
                {columns.map((heading) => (
                  <th key={heading} scope="col" className="px-3 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overview.kinds.map((row) => (
                <tr key={row.kind} className="border-t" data-kind={row.kind}>
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {row.name}
                  </th>
                  <td className="px-3 py-2">{row.schedule}</td>
                  <td className="px-3 py-2">
                    <span className={row.lastFanout?.status === "failed" ? "text-destructive" : undefined}>{fanoutLine(row.lastFanout)}</span>
                    {row.lastFanout?.error ? <span className="block max-w-xs truncate text-xs text-destructive">{row.lastFanout.error}</span> : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums" data-testid="count-sent">
                    {row.week.sent}
                  </td>
                  <td className="px-3 py-2 tabular-nums" data-testid="count-skipped-empty">
                    {row.week.skippedEmpty}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.week.skippedPref}</td>
                  <td className={`px-3 py-2 tabular-nums ${row.week.failed > 0 ? "font-semibold text-destructive" : ""}`} data-testid="count-failed">
                    {row.week.failed}
                  </td>
                  <td className={`px-3 py-2 tabular-nums ${row.week.undelivered > 0 ? "font-semibold text-destructive" : ""}`}>{row.week.undelivered}</td>
                  <td className="px-3 py-2 tabular-nums">{row.week.opened}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-[80ch] text-xs text-muted-foreground">
          Sent: handed to the mail queue. Nothing new: the member had no new item, so no e-mail was made. Switched off: the member turned that e-mail off after it
          was queued. Failed: held back by a volume guard, or an error (errors are retried by the job queue). Not delivered: the provider refused the message.
          Opened from: e-mails with at least one tender link followed (counted on the server; opens are not tracked). Waiting in the queue now:{" "}
          {overview.queuedSends}.
        </p>
      </section>

      <section aria-labelledby="preview" className="space-y-3">
        <h2 id="preview" className="text-lg font-semibold">
          Send me a preview
        </h2>
        <p className="max-w-[80ch] text-sm text-muted-foreground">
          Renders the e-mail a workspace would get, as its owner would see it. Nobody in the workspace is e-mailed and nothing is logged; the preview has no
          unsubscribe link and no click marker.
        </p>
        <div className="rounded-xl border bg-card p-4">
          <NotificationPreviewForm workspaces={workspaces} to={admin.email} delivery={overview.mailDelivery} />
        </div>
      </section>
    </div>
  );
}
