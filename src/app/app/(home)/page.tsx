import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { RadarError, RadarScreen } from "@/features/procurement/components/radar-screen";
import { scheduleMatchReasons } from "@/features/procurement/radar/reasons-ai";
import { loadRadar, parseRadarQuery, type RadarView } from "@/features/procurement/radar/view";
import { track } from "@/lib/analytics";
import { reportError } from "@/lib/report-error";
import { hasRole } from "@/server/workspaces";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "Radar" };

/**
 * App home = the Radar: open tenders that match the workspace's company, contracts ending
 * soon in its trade, the buyers behind them and early notices.
 * All data is read through functions that take `ctx` (tenant-scoped).
 */
export default async function RadarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireOrgForPage();
  const params = await searchParams;
  const now = new Date();

  let view: RadarView;
  try {
    view = await loadRadar(ctx, parseRadarQuery(params), now);
  } catch (error) {
    unstable_rethrow(error);
    await reportError(error, { route: "/app", organizationId: ctx.organization.id, userId: ctx.user.id });
    return <RadarError />;
  }

  after(() => track("radar_viewed", { organizationId: ctx.organization.id, userId: ctx.user.id }, { tab: view.tab, source: view.active ? view.active.kind : "none" }));
  // Top matches without a cached model-written reason get one in the background (budgeted, optional).
  if (view.spec && view.list?.tab === "matches") {
    scheduleMatchReasons({ organizationId: ctx.organization.id, userId: ctx.user.id }, view.spec, view.list.items);
  }

  return <RadarScreen view={view} now={now} justClaimed={params.claimed === "1"} canManage={hasRole(ctx.role, "admin")} />;
}
