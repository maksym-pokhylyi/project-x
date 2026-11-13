import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { PLANS } from "@/config/plans";
import { features } from "@/env";
import { canAddRadarSource, radarAccess } from "@/features/procurement/access";
import { ClaimAccountLinks, ClaimBenefits, ClaimCard, ClaimCompanyCard, ClaimConfirmForm, ClaimNotice } from "@/features/procurement/components/claim-forms";
import { ClaimSignUp } from "@/features/procurement/components/claim-sign-up";
import { DataMain, LegalFooter } from "@/features/procurement/components/public-chrome";
import { pluralise } from "@/features/procurement/domain/format";
import { getSupplierBySlug } from "@/features/procurement/queries/suppliers";
import { hasSupplierLink, listRadarSources } from "@/features/procurement/radar/data";
import { track } from "@/lib/analytics";
import { getUser, requireOrg } from "@/server/session";

export const metadata: Metadata = { title: "Claim this page", robots: { index: false, follow: false } };

const PROBLEMS: Record<string, string> = {
  "read-only": "This workspace has more members than its plan allows, so it is read-only for now. An owner can remove members or upgrade, then claim the page.",
  failed: "We could not link this company just now. Nothing was changed. Please try again.",
};

type Query = { limit?: string; confirm?: string; authorised?: string; problem?: string };

/**
 * Claim (docs/design/handoff: Claim, ClaimSignedIn; REPLY-2 §5).
 *
 *   signed out   the account form in place — the product's own sign-up form — with the
 *                "I am authorised" tick. Creating the account claims nothing; after the
 *                e-mail is confirmed the visitor is back here, signed in.
 *   signed in    one tick and "Confirm and open my radar".
 *
 * The workspace is linked to the company only by the Server Action behind that button,
 * never by opening this page, so following a link can never change a workspace.
 */
export default async function ClaimPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Query> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const supplier = await getSupplierBySlug(slug);
  if (!supplier) notFound();
  if (supplier.mergedIntoSlug) redirect(`/claim/${supplier.mergedIntoSlug}`);
  const claimPath = `/claim/${supplier.slug}`;
  const user = await getUser();

  let body;
  if (!user) {
    await track("claim_started", {}, { supplier: supplier.id });
    body = (
      <ClaimCard title="Your details" headingId="claim-form-h" data-testid="claim-sign-up">
        <div className="max-w-[30rem]">
          <ClaimSignUp claimPath={claimPath} requireEmailVerification={features.requireEmailVerification} googleEnabled={features.googleOAuth} notMineHref="/find" />
        </div>
        <ClaimAccountLinks signInHref={`/sign-in?redirect=${encodeURIComponent(claimPath)}`} />
      </ClaimCard>
    );
  } else {
    const ctx = await requireOrg();
    const [alreadyLinked, sources] = await Promise.all([hasSupplierLink(ctx, supplier.id), listRadarSources(ctx)]);
    const access = radarAccess(ctx.entitlements);
    const atLimit = !alreadyLinked && (!canAddRadarSource(access, sources.length) || query.limit === "1");
    if (alreadyLinked) {
      body = (
        <ClaimNotice
          title="This company is already on your radar"
          primary={{ href: `/app?profile=${encodeURIComponent(`s:${supplier.id}`)}`, label: "Open your radar" }}
          data-testid="claim-already"
        >
          <p>
            {ctx.organization.name} claimed this page. Its open tenders, rival contracts and buyers are in your radar.
          </p>
        </ClaimNotice>
      );
    } else if (atLimit) {
      const allowed = access.maxProfiles ?? 1;
      body = (
        <ClaimNotice title={`Your plan includes ${pluralise(allowed, "radar")}`} primary={{ href: "/pricing", label: `See ${PLANS.starter.name}` }} secondary={{ href: "/app", label: "Back to your radar" }} data-testid="claim-limit">
          <p>
            {ctx.organization.name} already follows {sources.map((source) => source.name).join(", ")}. {PLANS.starter.name} includes more than one radar; or remove the current one from your radar first.
          </p>
        </ClaimNotice>
      );
    } else {
      body = (
        <ClaimConfirmForm
          supplierId={supplier.id}
          userName={user.name}
          userEmail={user.email}
          ticked={query.authorised === "1"}
          missing={query.confirm === "missing"}
          problem={query.problem ? (PROBLEMS[query.problem] ?? PROBLEMS.failed) : null}
        />
      );
    }
  }

  return (
    <>
      <SiteHeader />
      <DataMain variant="task">
        <h1 className="type-h1 text-ink">Claim this page</h1>
        <div className="mt-4 md:mt-7">
          <ClaimCompanyCard supplier={supplier} />
        </div>
        <div className="mt-4 flex flex-col gap-x-6 gap-y-4 md:mt-6 md:gap-y-6 lg:flex-row lg:items-start">
          <div className="min-w-0 lg:flex-[1.5_1_35rem]">{body}</div>
          <ClaimBenefits className="lg:flex-[1_1_22.5rem]" />
        </div>
      </DataMain>
      <LegalFooter />
    </>
  );
}
