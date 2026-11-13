import type { Metadata } from "next";
import { site } from "@/config/site";
import { FlagMistakeAside, FlagMistakeIntro } from "@/features/procurement/components/flag-mistake";
import { FlagMistakeForm } from "@/features/procurement/components/flag-mistake-form";
import { DataHeader, DataMain, LegalFooter } from "@/features/procurement/components/public-chrome";
import { cleanPagePath } from "@/features/procurement/domain/data-requests";
import { getUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Flag a mistake",
  description: `Ask ${site.name} to correct or hide something on a page built from Find a Tender notices. A person reviews every request.`,
  alternates: { canonical: "/flag-a-mistake" },
  robots: { index: false, follow: true },
};

/**
 * Flag a mistake (docs/design/handoff: FlagMistake). `?page=/suppliers/<slug>` names the
 * page the visitor came from; only paths of this site's own data pages are accepted.
 */
export default async function FlagMistakePage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const raw = (await searchParams).page;
  const page = cleanPagePath(Array.isArray(raw) ? raw[0] : raw);
  const signedIn = Boolean(await getUser());

  return (
    <>
      <DataHeader signedIn={signedIn} phone="links" />
      <DataMain variant="task">
        <FlagMistakeIntro />
        <div className="mt-6 flex flex-col gap-x-10 gap-y-6 md:mt-8 lg:flex-row lg:items-start">
          <div className="min-w-0 lg:flex-[1_1_37.5rem]">
            <FlagMistakeForm page={page} pageAddress={page ? `${site.domain}${page}` : null} backHref={page ?? "/about-the-data"} />
          </div>
          <FlagMistakeAside />
        </div>
      </DataMain>
      <LegalFooter />
    </>
  );
}
