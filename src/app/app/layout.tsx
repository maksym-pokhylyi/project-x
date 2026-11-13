import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav, AppTabBar } from "@/components/app/app-nav";
import { AppBreadcrumbs, BreadcrumbProvider } from "@/components/app/breadcrumbs";
import { MobileAccount } from "@/components/app/mobile-account";
import { UserMenu } from "@/components/app/user-menu";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";
import { Logo, LogoMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLANS, formatPrice } from "@/config/plans";
import { site } from "@/config/site";
import { listUserWorkspaces } from "@/server/members";
import { requireOrgForPage, type OrgContext } from "@/server/session";

export const metadata: Metadata = { title: { default: "App", template: "%s · App" }, robots: { index: false } };

const formatDate = (date: Date | null | undefined) => date?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Payment problem: said once, at the top of every app page, with the one thing to do about it. */
function BillingBanner({ ctx }: { ctx: OrgContext }) {
  const { source, graceEndsAt } = ctx.entitlements;
  if (source !== "past_due_grace" && source !== "past_due_expired") return null;
  const isOwner = ctx.role === "owner";
  return (
    <div role="status" className="border-b border-accent/25 bg-accent-tint">
      <p className="container-content flex items-start gap-2.5 py-2.5 text-sm text-ink">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-ink" />
        <span>
          {source === "past_due_grace" ? (
            <>
              <strong className="font-semibold">Payment failed.</strong> Paid features stay on until {formatDate(graceEndsAt)}.
            </>
          ) : (
            <>
              <strong className="font-semibold">Subscription past due.</strong> This workspace is limited to the Free plan until payment succeeds.
            </>
          )}{" "}
          {isOwner ? (
            <Link href="/app/settings/billing" className="link font-medium">
              Update payment method
            </Link>
          ) : (
            "Ask a workspace owner to update the payment method."
          )}
        </span>
      </p>
    </div>
  );
}

/** Current plan, with an "Upgrade" affordance on Free (owners only: they are the ones who can pay). */
function PlanBlock({ ctx, badgeTestId }: { ctx: OrgContext; badgeTestId?: string }) {
  const isFree = ctx.entitlements.planKey === "free";
  const isOwner = ctx.role === "owner";
  const radarPro = PLANS.starter.prices ? formatPrice(PLANS.starter.prices.month) : null;
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-13 text-ink-2">Plan</span>
        <Badge variant={isFree ? "secondary" : "brand"} data-testid={badgeTestId}>
          {ctx.plan.name}
        </Badge>
      </div>
      {isFree ? (
        isOwner ? (
          <>
            <p className="mt-2 text-13 text-ink-2">Every match and daily alerts{radarPro ? ` from ${radarPro} a month` : ""}.</p>
            <Button asChild size="sm" className="mt-3 w-full">
              <Link href="/app/settings/billing">Upgrade</Link>
            </Button>
          </>
        ) : (
          <p className="mt-2 text-13 text-ink-2">A workspace owner can upgrade the plan.</p>
        )
      ) : isOwner ? (
        <Link href="/app/settings/billing" className="link mt-2 inline-flex min-h-6 items-center text-13 font-medium">
          Manage plan
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Authenticated shell.
 *
 *   ≥ 1024 px  sidebar (logo, workspace switcher, navigation, plan, account) + top bar with breadcrumbs
 *   < 1024 px  top bar (mark, breadcrumbs, account sheet) + bottom tab bar within thumb reach
 *
 * Pages render inside a 1120 px container. Landmarks: <aside>, <header>, <nav aria-label="App">,
 * <main id="main"> (target of the skip link in the root layout).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgForPage();
  const workspaces = await listUserWorkspaces(ctx.user.id);
  const current = { id: ctx.organization.id, name: ctx.organization.name, logo: ctx.organization.logo, role: ctx.role };

  return (
    <BreadcrumbProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside data-slot="app-sidebar" aria-label="Workspace" className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper lg:flex">
          <div className="flex h-14 shrink-0 items-center px-5">
            <Logo href="/app" size="sm" />
          </div>
          <div className="px-3 pb-3">
            <WorkspaceSwitcher current={current} workspaces={workspaces} />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-1">
            <AppNav isAdmin={ctx.user.isAdmin} />
          </div>
          <div className="space-y-2 p-3">
            <PlanBlock ctx={ctx} badgeTestId="plan-badge" />
            <UserMenu name={ctx.user.name} email={ctx.user.email} />
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-col">
          <header data-slot="app-topbar" className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
            <div className="container-content flex h-14 items-center gap-3">
              <Link href="/app" className="grid size-10 shrink-0 place-items-center rounded-control lg:hidden" aria-label={`${site.name}: go to your radar`}>
                <LogoMark size={24} />
              </Link>
              <AppBreadcrumbs className="flex-1" />
              <div className="lg:hidden">
                <MobileAccount
                  name={ctx.user.name}
                  email={ctx.user.email}
                  isAdmin={ctx.user.isAdmin}
                  current={current}
                  workspaces={workspaces}
                  plan={<PlanBlock ctx={ctx} />}
                />
              </div>
            </div>
          </header>
          <BillingBanner ctx={ctx} />
          <main id="main" className="container-content flex-1 pt-6 pb-28 lg:pt-8 lg:pb-16">
            {children}
          </main>
        </div>

        <AppTabBar />
      </div>
    </BreadcrumbProvider>
  );
}
