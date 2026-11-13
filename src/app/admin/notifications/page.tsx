import type { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getNotificationsOverview, listPreviewWorkspaces, type FanoutRun } from "@/features/notifications/admin";
import { NotificationPreviewForm } from "@/features/notifications/components/preview-form";
import { cn } from "@/lib/utils";
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
 */
export default async function AdminNotificationsPage() {
  // Pages render in parallel with their layout, so each admin page guards itself.
  const admin = await requireAdminForPage();
  const [overview, workspaces] = await Promise.all([getNotificationsOverview(), listPreviewWorkspaces()]);
  const counts = ["Sent", "Nothing new", "Switched off", "Failed", "Not delivered", "Opened from"];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="type-title text-ink">Notifications</h1>
        <p className="mt-2 text-15 text-ink-2">Scheduled e-mails: weekly digest, daily alerts, deadline reminders, annual-renewal reminder. Numbers cover the last 7 days.</p>
      </div>

      {overview.paused ? (
        <Alert variant="warning" data-testid="notifications-paused">
          <AlertTitle>Paused</AlertTitle>
          <AlertDescription>
            NOTIFICATIONS_PAUSED=1 is set. Nothing is scheduled and queued e-mails are not sent. Remove the variable and redeploy to resume; the next e-mail covers
            everything since the last one that went out.
          </AlertDescription>
        </Alert>
      ) : null}
      {overview.mailDelivery !== "resend" ? (
        <Alert variant="info" role="status">
          <AlertDescription>
            {overview.mailDelivery === "outbox"
              ? "No mail provider is configured: e-mails are written to the dev outbox (/dev/outbox) instead of being delivered."
              : "No mail provider and no dev outbox: nothing is scheduled."}
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="week" className="flex flex-col gap-3">
        <h2 id="week" className="type-section text-ink">
          Last 7 days
        </h2>
        <Table framed className="min-w-[56rem]" data-testid="notifications-table">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">E-mail</TableHead>
              <TableHead scope="col">Schedule (UK time)</TableHead>
              <TableHead scope="col">Last fan-out</TableHead>
              {counts.map((heading) => (
                <TableHead key={heading} scope="col" numeric>
                  {heading}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {overview.kinds.map((row) => (
              <TableRow key={row.kind} data-kind={row.kind}>
                <TableCell className="font-semibold text-ink">{row.name}</TableCell>
                <TableCell>{row.schedule}</TableCell>
                <TableCell>
                  <span className={cn(row.lastFanout?.status === "failed" && "font-semibold text-danger")}>{fanoutLine(row.lastFanout)}</span>
                  {row.lastFanout?.error ? <span className="block max-w-xs truncate text-13 text-danger">{row.lastFanout.error}</span> : null}
                </TableCell>
                <TableCell numeric data-testid="count-sent">
                  {row.week.sent}
                </TableCell>
                <TableCell numeric data-testid="count-skipped-empty">
                  {row.week.skippedEmpty}
                </TableCell>
                <TableCell numeric>{row.week.skippedPref}</TableCell>
                <TableCell numeric className={cn(row.week.failed > 0 && "font-semibold text-danger")} data-testid="count-failed">
                  {row.week.failed}
                </TableCell>
                <TableCell numeric className={cn(row.week.undelivered > 0 && "font-semibold text-danger")}>
                  {row.week.undelivered}
                </TableCell>
                <TableCell numeric>{row.week.opened}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="max-w-[80ch] text-13 text-ink-2">
          Sent: handed to the mail queue. Nothing new: the member had no new item, so no e-mail was made. Switched off: the member turned that e-mail off after it
          was queued. Failed: held back by a volume guard, or an error (errors are retried by the job queue). Not delivered: the provider refused the message.
          Opened from: e-mails with at least one tender link followed (counted on the server; opens are not tracked). Waiting in the queue now:{" "}
          {overview.queuedSends}.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Send me a preview</CardTitle>
          <CardDescription>
            Renders the e-mail a workspace would get, as its owner would see it. Nobody in the workspace is e-mailed and nothing is logged; the preview has no
            unsubscribe link and no click marker.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreviewForm workspaces={workspaces} to={admin.email} delivery={overview.mailDelivery} />
        </CardContent>
      </Card>
    </div>
  );
}
