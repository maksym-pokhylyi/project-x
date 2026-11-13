import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { WorkspaceForm } from "@/components/app/workspace-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-6">
      <PageHeader title="Workspace" description="Name and branding of this workspace." />
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
              <p className="text-sm text-muted-foreground">
                The audit log is part of the Pro plan and above.{" "}
                {ctx.role === "owner" ? (
                  <Link href="/app/settings/billing" className="font-medium text-foreground underline underline-offset-4">
                    Upgrade
                  </Link>
                ) : null}
              </p>
            ) : audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <span className="font-medium">{entry.action}</span>{" "}
                      <span className="text-muted-foreground">by {entry.actorName ?? entry.actorType}</span>
                    </span>
                    <time dateTime={entry.createdAt.toISOString()} className="text-xs text-muted-foreground">
                      {entry.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
