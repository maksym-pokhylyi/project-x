import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/app/app-nav";
import { UserMenu } from "@/components/app/user-menu";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";
import { Badge } from "@/components/ui/badge";
import { listUserWorkspaces } from "@/server/members";
import { requireOrgForPage, type OrgContext } from "@/server/session";

export const metadata: Metadata = { title: { default: "App", template: "%s · App" }, robots: { index: false } };

function BillingBanner({ ctx }: { ctx: OrgContext }) {
  const { source, graceEndsAt } = ctx.entitlements;
  if (source !== "past_due_grace" && source !== "past_due_expired") return null;
  const isOwner = ctx.role === "owner";
  return (
    <div role="status" className="border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm">
      {source === "past_due_grace" ? (
        <>
          <strong>Payment failed.</strong> Paid features stay on until{" "}
          {graceEndsAt?.toLocaleDateString("en-US", { dateStyle: "medium" })}.
        </>
      ) : (
        <>
          <strong>Subscription past due.</strong> This workspace is limited to the Free plan until payment succeeds.
        </>
      )}{" "}
      {isOwner ? (
        <Link href="/app/settings/billing" className="font-medium underline underline-offset-4">
          Update payment method
        </Link>
      ) : (
        "Ask a workspace owner to update the payment method."
      )}
    </div>
  );
}

/** Authenticated shell: workspace switcher, navigation, user menu. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgForPage();
  const workspaces = await listUserWorkspaces(ctx.user.id);
  const current = { id: ctx.organization.id, name: ctx.organization.name, logo: ctx.organization.logo, role: ctx.role };

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b bg-sidebar md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 p-3">
          <div className="min-w-0 flex-1">
            <WorkspaceSwitcher current={current} workspaces={workspaces} />
          </div>
          <div className="md:hidden">
            <Badge variant="secondary">{ctx.plan.name}</Badge>
          </div>
        </div>
        <div className="px-3 pb-3 md:flex-1 md:overflow-y-auto">
          <AppNav canManageBilling={ctx.role === "owner"} isAdmin={ctx.user.isAdmin} />
        </div>
        <div className="hidden border-t p-3 md:block">
          <div className="mb-2 flex items-center justify-between px-2 text-xs text-muted-foreground">
            <span>Plan</span>
            <Badge variant="secondary" data-testid="plan-badge">
              {ctx.plan.name}
            </Badge>
          </div>
          <UserMenu name={ctx.user.name} email={ctx.user.email} />
        </div>
      </aside>

      <div className="min-w-0">
        <BillingBanner ctx={ctx} />
        <div className="flex items-center justify-end border-b px-4 py-2 md:hidden">
          <div className="w-full max-w-64">
            <UserMenu name={ctx.user.name} email={ctx.user.email} />
          </div>
        </div>
        <main id="main" className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
