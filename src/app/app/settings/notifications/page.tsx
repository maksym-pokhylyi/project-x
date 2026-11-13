import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { site } from "@/config/site";
import { notificationAccess } from "@/features/notifications/access";
import { NotificationSettings, type NotificationSettingsRow } from "@/features/notifications/components/notification-settings";
import { getNotificationPrefs } from "@/features/notifications/prefs";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "Notifications" };

/**
 * Settings → Notifications: what this member is e-mailed about this workspace.
 * (Preferences are per member and workspace; a missing row means everything is on.)
 */
export default async function NotificationSettingsPage() {
  const ctx = await requireOrgForPage({ returnTo: "/app/settings/notifications" });
  const { unsubscribedAllAt, ...switches } = await getNotificationPrefs(ctx.user.id, ctx.organization.id);
  const access = notificationAccess(ctx.entitlements);

  const rows: NotificationSettingsRow[] = [
    {
      key: "weeklyDigest",
      label: "Weekly digest",
      description: "Mondays at 07:30, UK time: new tenders that match your company, contracts ending soon in your trade, and saved tenders about to close. Not sent when nothing is new.",
    },
    {
      key: "dailyAlerts",
      label: "Daily alerts",
      description: "Working days at 07:30, UK time: tenders that matched since the last email. Not sent when nothing is new.",
      ...(access.dailyAlerts ? {} : { unavailable: { text: "Part of the paid plans.", link: { label: "See plans", href: "/pricing" } } }),
    },
    {
      key: "deadlineReminders",
      label: "Deadline reminders",
      description: "At 08:00, UK time, 7 days and 2 days before a tender you saved closes. One email a day at most.",
    },
    {
      key: "productEmails",
      label: "Product emails",
      description: "When something you asked for is ready, such as a bid check.",
    },
    ...(ctx.role === "owner"
      ? [
          {
            key: "renewalReminders" as const,
            label: "Renewal reminder",
            description: "Seven days before an annual plan renews, with the date and the price. Sent to workspace owners.",
            independent: true,
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader level={2} title="Notifications" description={`What ${site.name} emails you about ${ctx.organization.name}. Each member chooses for themselves.`} />
      <Card>
        <CardHeader>
          <CardTitle>Emails</CardTitle>
          <CardDescription>
            Sent to <strong className="font-semibold [overflow-wrap:anywhere] text-ink">{ctx.user.email}</strong>
            {ctx.user.emailVerified ? "." : ", once you have confirmed that address."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettings rows={rows} initial={{ ...switches, unsubscribedAll: unsubscribedAllAt !== null }} />
        </CardContent>
      </Card>
      <p className="text-sm text-ink-2">Sign-in links, receipts and other emails about your account are always sent.</p>
    </>
  );
}
