import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { canAddRadarSource, radarAccess } from "@/features/procurement/access";
import { UpgradeNotice } from "@/features/procurement/components/radar-screen";
import { RadarProfileForm } from "@/features/procurement/components/radar-profile-form";
import { pluralise } from "@/features/procurement/domain/format";
import { UK_REGIONS } from "@/features/procurement/domain/regions";
import { commonTrades, labelTrades } from "@/features/procurement/queries/cpv";
import { getRadarProfile, listRadarSources } from "@/features/procurement/radar/data";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "Set up your radar" };

/** Manual radar profile: for companies with no published awards (or to describe a new line of work). */
export default async function RadarSetupPage({ searchParams }: { searchParams: Promise<{ profile?: string | string[] }> }) {
  const ctx = await requireOrgForPage({ returnTo: "/app/radar/setup" });
  const raw = (await searchParams).profile;
  const profileId = Array.isArray(raw) ? raw[0] : raw;
  const editing = profileId && /^[0-9a-f-]{36}$/i.test(profileId) ? await getRadarProfile(ctx, profileId) : null;
  if (profileId && !editing) notFound();

  const sources = await listRadarSources(ctx);
  const access = radarAccess(ctx.entitlements);
  const blocked = !editing && !canAddRadarSource(access, sources.length);
  const regions = Object.entries(UK_REGIONS).map(([code, label]) => ({ code, label }));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/app">← Back to radar</Link>
        </Button>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{editing ? "Edit radar profile" : "Set up your radar"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us what you do and where. We match it against every open tender, the contracts ending soon in your trade and the buyers who award them.
        </p>
      </div>
      {blocked ? (
        <UpgradeNotice title={`Your plan includes ${pluralise(access.maxProfiles ?? 1, "radar profile")}`}>
          {ctx.organization.name} already follows {sources.map((source) => source.name).join(", ")}. Radar Pro includes five profiles.
        </UpgradeNotice>
      ) : (
        <RadarProfileForm
          profileId={editing?.id}
          defaults={{
            name: editing?.name ?? (ctx.organization.isPersonal ? "" : ctx.organization.name),
            trades: editing ? await labelTrades(editing.cpvCodes) : [],
            regions: editing?.regions ?? [],
            keywords: editing?.keywords.join(", ") ?? "",
            valueMin: editing?.valueMin ?? null,
            valueMax: editing?.valueMax ?? null,
          }}
          suggestions={commonTrades()}
          regions={regions}
        />
      )}
    </div>
  );
}
