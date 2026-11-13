import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppMenu, AppNav } from "@/components/app/app-nav";
import { AppBreadcrumbs, BreadcrumbProvider } from "@/components/app/breadcrumbs";
import { UserMenu, type UserMenuPlan } from "@/components/app/user-menu";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";
import { Logo } from "@/components/logo";
import { PLANS, formatPrice } from "@/config/plans";
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
    <div role="status" className="bg-accent-tint">
      <p className="container-app flex items-start gap-2.5 py-3 text-sm text-ink">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
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

/** The plan as the account menu shows it, with "Upgrade" on Free for owners (they are the ones who can pay). */
function menuPlan(ctx: OrgContext): UserMenuPlan {
  const radarPro = PLANS.starter.prices ? formatPrice(PLANS.starter.prices.month) : null;
  return {
    name: ctx.plan.name,
    isFree: ctx.entitlements.planKey === "free",
    isOwner: ctx.role === "owner",
    upgradeNote: `Every match and daily alerts${radarPro ? ` from ${radarPro} a month` : ""}.`,
  };
}

/**
 * Authenticated shell, as in the artboards (docs/design/handoff/Brief-*, Editor-*): a white
 * top bar on a hairline, no sidebar.
 *
 *   ≥ 768 px   logo · Radar · Bids · Documents ………… workspace name · avatar menu   (60 px)
 *   < 768 px   logo ………………………………………………………… avatar menu · menu button       (56 px)
 *
 * The avatar menu holds the plan (with Upgrade), Settings and sign-out; on phones the menu
 * button opens the same sections plus the workspace switcher. Pages render inside a 1280 px
 * container, with their breadcrumb above the title. Landmarks: <header>,
 * <nav aria-label="App">, <main id="main"> (target of the skip link in the root layout).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgForPage();
  const workspaces = await listUserWorkspaces(ctx.user.id);
  const current = { id: ctx.organization.id, name: ctx.organization.name, logo: ctx.organization.logo, role: ctx.role };

  return (
    <BreadcrumbProvider>
      <div className="flex min-h-dvh flex-col text-15">
        <header data-slot="app-topbar" className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className="container-app flex min-h-14 items-center justify-between gap-x-8 max-md:pr-2 md:min-h-[3.75rem]">
            <div className="flex min-w-0 items-center gap-x-7">
              <Logo href="/app" size="sm" className="shrink-0" />
              <AppNav />
            </div>
            <div className="flex min-w-0 items-center md:gap-2">
              <WorkspaceSwitcher current={current} workspaces={workspaces} className="hidden max-w-[24rem] md:inline-flex" />
              <UserMenu name={ctx.user.name} email={ctx.user.email} workspaceName={ctx.organization.name} plan={menuPlan(ctx)} isAdmin={ctx.user.isAdmin} />
              <AppMenu workspace={<WorkspaceSwitcher current={current} workspaces={workspaces} variant="field" testId="workspace-switcher-sheet" />} />
            </div>
          </div>
        </header>
        <BillingBanner ctx={ctx} />
        <main id="main" className="container-app flex-1 pt-5 pb-12 md:pt-7 md:pb-[4.5rem]">
          <AppBreadcrumbs />
          {children}
        </main>
      </div>
    </BreadcrumbProvider>
  );
}
