import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { SettingsFrame } from "@/components/app/settings-nav";
import { UsagePanel } from "@/components/app/usage-panel";
import { ButtonLink } from "@/components/ui/button-link";
import { requireOrgForPage } from "@/server/session";
import { getUsageSummary } from "@/server/usage";

export const metadata: Metadata = { title: "Usage" };

export default async function UsagePage() {
  const ctx = await requireOrgForPage();
  const usage = await getUsageSummary(ctx);
  return (
    <SettingsFrame>
      <PageHeader
        level={2}
        title="Usage"
        description="What this workspace has used against the limits of its plan."
        actions={
          ctx.role === "owner" ? (
            <ButtonLink href="/pricing" variant="outline">
              Change plan
            </ButtonLink>
          ) : null
        }
      />
      <UsagePanel usage={usage} planName={ctx.plan.name} />
    </SettingsFrame>
  );
}
