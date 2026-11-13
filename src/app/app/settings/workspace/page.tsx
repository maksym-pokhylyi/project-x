import type { Metadata } from "next";
import Link from "next/link";
import { WorkspaceDangerZone } from "@/components/app/danger-zone";
import { PageHeader } from "@/components/app/page-header";
import { WorkspaceForm } from "@/components/app/workspace-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS } from "@/config/plans";
import { listAuditLog } from "@/server/audit";
import { requireOrgForPage } from "@/server/session";
import { hasRole } from "@/server/workspaces";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspaceSettingsPage() {
  const ctx = await requireOrgForPage();
  const canEdit = hasRole(ctx.role, "admin");
  const auditEnabled = ctx.entitlements.features.auditLog;
  const audit = canEdit && auditEnabled ? await listAuditLog(ctx, 15) : [];

  return (
    <>
      <PageHeader level={2} title="Workspace" description="Name and branding of this workspace." />
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Visible to everyone in the workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceForm name={ctx.organization.name} logo={ctx.organization.logo} canEdit={canEdit} />
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Security-relevant changes in this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {!auditEnabled ? (
              <p className="text-sm text-ink-2">
                The activity log is part of the {PLANS.pro.name} plan and above.{" "}
                {ctx.role === "owner" ? (
                  <Link href="/app/settings/billing" className="link font-medium">
                    Upgrade
                  </Link>
                ) : null}
              </p>
            ) : audit.length === 0 ? (
              <p className="text-sm text-ink-2">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <span className="font-medium">{entry.action}</span>{" "}
                      <span className="text-ink-2">by {entry.actorName ?? entry.actorType}</span>
                    </span>
                    <time dateTime={entry.createdAt.toISOString()} className="text-xs text-ink-2">
                      {entry.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {ctx.role === "owner" ? (
        <Card>
          <CardHeader>
            <CardTitle>Export and deletion</CardTitle>
            <CardDescription>Owners only.</CardDescription>
          </CardHeader>
          <CardContent>
            <WorkspaceDangerZone workspaceName={ctx.organization.name} />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
