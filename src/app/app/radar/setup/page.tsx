import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BreadcrumbTrail } from "@/components/app/breadcrumbs";
import { PLANS } from "@/config/plans";
import { canAddRadarSource, radarAccess } from "@/features/procurement/access";
import { ClaimNotice } from "@/features/procurement/components/claim-forms";
import { ManualRadarCard } from "@/features/procurement/components/find-page";
import { AppSourceNote } from "@/features/procurement/components/public-chrome";
import { RadarEditPage } from "@/features/procurement/components/radar-edit";
import { RemoveRadar } from "@/features/procurement/components/radar-remove";
import { pluralise } from "@/features/procurement/domain/format";
import { listRadarSources } from "@/features/procurement/radar/data";
import { parseSelection } from "@/features/procurement/radar/selection";
import { loadRadar } from "@/features/procurement/radar/view";
import { requireOrgForPage } from "@/server/session";
import { hasRole } from "@/server/workspaces";

export const metadata: Metadata = { title: "Trades and regions" };

type Params = Record<string, string | string[] | undefined>;

/**
 * Trades and regions of a radar, as a page of its own (docs/design/handoff: RadarEdit-390).
 *
 *   ?source=s:<supplier id> | r:<profile id>   edit that radar (the panel's page form)
 *   otherwise                                  set up a manual radar; ?name=&trade=&cpv=&region=
 *                                              pre-fill it (the selection made on the Find page
 *                                              before signing up). Opening the page creates
 *                                              nothing: one button does.
 */
export default async function RadarSetupPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const ctx = await requireOrgForPage({ returnTo: "/app/radar/setup" });
  const raw = Array.isArray(params.source) ? params.source[0] : params.source;
  const sources = await listRadarSources(ctx);

  if (raw) {
    const source = sources.find((entry) => entry.key === raw);
    if (!source) notFound();
    const view = await loadRadar(ctx, { profile: source.key, tab: "matches" });
    if (!view.edit) notFound();
    const backHref = `/app?tab=matches&profile=${encodeURIComponent(source.key)}`;
    return (
      <div className="flex flex-col">
        <div className="flex w-full max-w-[35rem] flex-col">
          <BreadcrumbTrail items={[{ label: "Radar", href: backHref }, { label: "Trades and regions" }]} />
          <h1 className="type-title text-ink">Trades and regions</h1>
          <p className="mt-2 text-15 text-ink">Your radar shows open tenders that match any of your trades in any of your regions.</p>
          <p className="mt-1 text-sm text-ink-2 [overflow-wrap:anywhere]">{source.name}</p>
          <div className="mt-6">
            <RadarEditPage data={view.edit} cancelHref={backHref} />
          </div>
          {hasRole(ctx.role, "admin") ? <RemoveRadar sourceKey={source.key} name={source.name} /> : null}
        </div>
        <AppSourceNote />
      </div>
    );
  }

  const access = radarAccess(ctx.entitlements);
  const blocked = !canAddRadarSource(access, sources.length);
  const selection = parseSelection(params);
  if (!selection.name && !ctx.organization.isPersonal) selection.name = ctx.organization.name.slice(0, 80);

  return (
    <div className="flex flex-col">
      <BreadcrumbTrail items={[{ label: "Radar", href: "/app" }, { label: "Set up your radar" }]} />
      <h1 className="type-title text-ink">Set up your radar</h1>
      <p className="mt-2 max-w-[45rem] text-base text-ink">Choose your trades and regions. The radar shows the open tenders that match them, the rival contracts ending soon and the buyers behind them.</p>
      <div className="mt-6">
        {blocked ? (
          <ClaimNotice title={`Your plan includes ${pluralise(access.maxProfiles ?? 1, "radar")}`} primary={{ href: "/pricing", label: `See ${PLANS.starter.name}` }} secondary={{ href: "/app", label: "Back to your radar" }} data-testid="radar-limit">
            <p>
              {ctx.organization.name} already follows {sources.map((source) => source.name).join(", ")}. {PLANS.starter.name} includes more than one radar; or change the trades and regions of the one you have.
            </p>
          </ClaimNotice>
        ) : (
          <ManualRadarCard selection={selection} signedIn />
        )}
      </div>
      <AppSourceNote />
    </div>
  );
}
