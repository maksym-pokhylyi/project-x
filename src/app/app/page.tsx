import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingChecklist } from "@/components/app/onboarding-checklist";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { getOnboardingProgress } from "@/server/onboarding";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "Home" };

/**
 * App home. Intentionally empty: this is where the product's main screen goes.
 * Read data through functions that take `ctx` (see src/server/*) so it stays tenant-scoped.
 */
export default async function AppHomePage() {
  const ctx = await requireOrgForPage();
  const progress = await getOnboardingProgress(ctx);
  const firstName = ctx.user.name.split(/\s+/)[0] || "there";

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${firstName}`} description={`You are in the ${ctx.organization.name} workspace.`} />
      <OnboardingChecklist progress={progress} />
      <EmptyState
        title="Nothing here yet"
        description="This is where your product's main content will appear once it is built."
        action={
          <Button asChild variant="outline">
            <Link href="/app/usage">View usage</Link>
          </Button>
        }
      />
    </div>
  );
}
