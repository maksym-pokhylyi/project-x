import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { SettingsFrame } from "@/components/app/settings-nav";
import { UsagePanel } from "@/components/app/usage-panel";
import { Button } from "@/components/ui/button";
import { requireOrgForPage } from "@/server/session";
import { getUsageSummary } from "@/server/usage";

export const metadata: Metadata = { title: "Usage" };

export default async function UsagePage() {
  const ctx = await requireOrgForPage();
  const usage = await getUsageSummary(ctx);
  return (
    <SettingsFrame showBilling={ctx.role === "owner"}>
      <PageHeader
        level={2}
        title="Usage"
        description="What this workspace has used against the limits of its plan."
        actions={
          ctx.role === "owner" ? (
            <Button asChild variant="outline">
              <Link href="/app/settings/billing">Change plan</Link>
            </Button>
          ) : null
        }
      />
      <UsagePanel usage={usage} planName={ctx.plan.name} />
    </SettingsFrame>
  );
}
