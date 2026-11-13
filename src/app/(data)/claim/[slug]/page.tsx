import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { claimSupplierAction } from "@/features/procurement/actions";
import { DataAttribution } from "@/features/procurement/components/data-attribution";
import { canAddRadarSource, radarAccess } from "@/features/procurement/access";
import { pluralise } from "@/features/procurement/domain/format";
import { getSupplierBySlug } from "@/features/procurement/queries/suppliers";
import { hasSupplierLink, listRadarSources } from "@/features/procurement/radar/data";
import { track } from "@/lib/analytics";
import { getUser, requireOrg } from "@/server/session";

export const metadata: Metadata = { title: "Claim your company page", robots: { index: false, follow: false } };

/**
 * Claim flow, step 2 of 2.
 *
 *   supplier page → "Claim this page" → here.
 *   Signed out: record `claim_started`, go to sign-up (which returns here afterwards).
 *   Signed in:  one confirmation, then the workspace is linked and the radar opens.
 *
 * The link is created by a Server Action behind a button, never by this GET request, so
 * following a link can never change a workspace.
 */
export default async function ClaimPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ limit?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const supplier = await getSupplierBySlug(slug);
  if (!supplier) notFound();
  if (supplier.mergedIntoSlug) redirect(`/claim/${supplier.mergedIntoSlug}`);

  const user = await getUser();
  if (!user) {
    await track("claim_started", {}, { supplier: supplier.id });
    redirect(`/sign-up?redirect=${encodeURIComponent(`/claim/${supplier.slug}`)}`);
  }

  const ctx = await requireOrg();
  const [alreadyLinked, sources] = await Promise.all([hasSupplierLink(ctx, supplier.id), listRadarSources(ctx)]);
  const access = radarAccess(ctx.entitlements);
  const atLimit = !alreadyLinked && (!canAddRadarSource(access, sources.length) || query.limit === "1");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Claim your company page</p>
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{supplier.name}</h1>
        <p className="text-sm text-muted-foreground">
          {[supplier.companyNumber ? `Company number ${supplier.companyNumber}` : null, supplier.locality, pluralise(supplier.awardsCount, "published contract award")].filter(Boolean).join(" · ")}
        </p>
      </header>

      {alreadyLinked ? (
        <div className="rounded-lg border bg-card p-5" data-testid="claim-already">
          <p className="font-medium">This company is already on your radar.</p>
          <p className="mt-1 text-sm text-muted-foreground">Workspace: {ctx.organization.name}</p>
          <Button asChild className="mt-4">
            <Link href={`/app?profile=${encodeURIComponent(`s:${supplier.id}`)}`}>Open your radar</Link>
          </Button>
        </div>
      ) : atLimit ? (
        <div className="rounded-lg border bg-card p-5" data-testid="claim-limit">
          <p className="font-medium">Your plan includes {pluralise(access.maxProfiles ?? 1, "radar profile")}.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {ctx.organization.name} already follows {sources.map((source) => source.name).join(", ")}. Radar Pro includes five profiles and every match — or
            remove the current profile from your radar first.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/app/settings/billing">See plans</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app">Back to your radar</Link>
            </Button>
          </div>
        </div>
      ) : (
        <form action={claimSupplierAction} className="rounded-lg border bg-card p-5" data-testid="claim-form">
          <input type="hidden" name="supplierId" value={supplier.id} />
          <p className="font-medium">Link this company to {ctx.organization.name}?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Your radar is set up from this company&apos;s contract history: matching open tenders, contracts ending soon and buyers in your trade.</li>
            <li>The public page stays as it is. Claiming does not publish anything about you.</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">By continuing you confirm that you work for this company or act on its behalf.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button type="submit" autoFocus data-testid="claim-confirm">
              Confirm and open my radar
            </Button>
            <Button asChild variant="ghost">
              <Link href="/app/radar/find">This is not my company</Link>
            </Button>
          </div>
        </form>
      )}
      <DataAttribution pagePath={supplier.isPublic ? `/suppliers/${supplier.slug}` : undefined} />
    </div>
  );
}
