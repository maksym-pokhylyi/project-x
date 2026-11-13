import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppMenu, AppNav } from "@/components/app/app-nav";
import { AppBreadcrumbs, BreadcrumbProvider } from "@/components/app/breadcrumbs";
import { FreePlanBar, FreePlanChip, SeePlansLink, TrialStrip } from "@/components/app/plan-strips";
import { UserMenu, type UserMenuPlan } from "@/components/app/user-menu";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";
import { OnBillingRoutes } from "@/components/billing/on-billing-routes";
import { TestModeNotice } from "@/components/billing/test-mode-notice";
import { Logo } from "@/components/logo";
import { NoticeBand } from "@/components/ui/notice-band";
import { PLANS, formatPrice } from "@/config/plans";
import { listUserWorkspaces } from "@/server/members";
import { requireOrgForPage, type OrgContext } from "@/server/session";

export const metadata: Metadata = { title: { default: "App", template: "%s · App" }, robots: { index: false } };

const formatDate = (date: Date | null | undefined) => date?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Shown while the workspace has more members than its plan allows (see OrgContext.seats). */
function SeatBanner({ ctx }: { ctx: OrgContext }) {
  if (!ctx.seats.overLimit) return null;
  return (
    <NoticeBand tone="warning" role="status" data-testid="seat-limit-banner" containerClassName="container-app">
      <strong className="font-semibold">
        This workspace has {ctx.seats.used} members but the {ctx.plan.name} plan includes {ctx.seats.limit}.
      </strong>{" "}
      It is read-only and nobody can be invited until{" "}
      {ctx.role === "owner" ? (
        <>
          you{" "}
          <Link href="/app/settings/members" className="link font-medium">
            remove members
          </Link>{" "}
          or{" "}
          <Link href="/pricing" className="link font-medium">
            upgrade
          </Link>
          .
        </>
      ) : (
        "an owner removes members or upgrades the plan."
      )}
    </NoticeBand>
  );
}

/** Payment problem: said once, at the top of every app page, with the one thing to do about it. */
function BillingBanner({ ctx }: { ctx: OrgContext }) {
  const { source, graceEndsAt } = ctx.entitlements;
  if (source === "period_lapsed") {
    return (
      <NoticeBand tone="warning" role="status" data-testid="period-lapsed-banner" containerClassName="container-app">
        <strong className="font-semibold">We could not confirm the renewal of this subscription.</strong> The workspace is limited to the Free plan for
        now.{" "}
        {ctx.role === "owner" ? (
          <Link href="/app/settings/billing" className="link font-medium">
            Check billing
          </Link>
        ) : (
          "Ask a workspace owner to check billing."
        )}
      </NoticeBand>
    );
  }
  if (source !== "past_due_grace" && source !== "past_due_expired") return null;
  const isOwner = ctx.role === "owner";
  return (
    <NoticeBand tone="warning" role="status" containerClassName="container-app">
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
    </NoticeBand>
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
 * On Free the bar also carries the "Free plan" chip and "See plans" (Radar artboard); on
 * phones those two and the workspace name sit in a 44 px bar of their own under it
 * (RadarFirstRun-390). Under the bar, in this order and only when they apply: the trial
 * strip, the test-mode band (Billing pages), a payment problem, a seat problem.
 *
 * The avatar menu holds the plan (with Upgrade), Billing, Settings and sign-out; on phones
 * the menu button opens the same sections plus the workspace switcher. Pages render inside a
 * 1280 px container, with their breadcrumb above the title. Landmarks: <header>,
 * <nav aria-label="App">, <main id="main"> (target of the skip link in the root layout).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgForPage();
  const workspaces = await listUserWorkspaces(ctx.user.id);
  const current = { id: ctx.organization.id, name: ctx.organization.name, logo: ctx.organization.logo, role: ctx.role };
  const isFree = ctx.entitlements.planKey === "free";

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
              {isFree ? (
                <>
                  <FreePlanChip className="max-md:hidden" />
                  <SeePlansLink className="mx-1 max-md:hidden" />
                </>
              ) : null}
              <UserMenu name={ctx.user.name} email={ctx.user.email} workspaceName={ctx.organization.name} plan={menuPlan(ctx)} isAdmin={ctx.user.isAdmin} />
              <AppMenu workspace={<WorkspaceSwitcher current={current} workspaces={workspaces} variant="field" testId="workspace-switcher-sheet" />} />
            </div>
          </div>
        </header>
        <FreePlanBar ctx={ctx} />
        <TrialStrip ctx={ctx} />
        <OnBillingRoutes>
          <TestModeNotice />
        </OnBillingRoutes>
        <BillingBanner ctx={ctx} />
        <SeatBanner ctx={ctx} />
        <main id="main" className="container-app flex-1 pt-5 pb-12 md:pt-7 md:pb-[4.5rem]">
          <AppBreadcrumbs />
          {children}
        </main>
      </div>
    </BreadcrumbProvider>
  );
}
