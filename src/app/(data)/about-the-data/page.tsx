import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { site } from "@/config/site";
import { AboutTheData } from "@/features/procurement/components/about-the-data";
import { DataMain, LegalFooter } from "@/features/procurement/components/public-chrome";
import { cleanPagePath } from "@/features/procurement/domain/data-requests";
import { FLAG_MISTAKE_HREF } from "@/features/procurement/domain/links";

export const metadata: Metadata = {
  title: "About the data",
  description: `Where ${site.name}'s contract data comes from, how it is licensed, what we show and do not show, and how to ask for a correction or removal.`,
  alternates: { canonical: "/about-the-data" },
};

/**
 * "Data sources": the public account of where the notices come from and how pages are built.
 *
 * The request form used to live here. Links written for it still work: `?page=/suppliers/<slug>`
 * (the opt-out page, letters already sent) goes on to "Flag a mistake" with the page filled in,
 * and `#request` lands on the block that leads there.
 */
export default async function AboutTheDataPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const raw = (await searchParams).page;
  const page = cleanPagePath(Array.isArray(raw) ? raw[0] : raw);
  if (page) redirect(`${FLAG_MISTAKE_HREF}?page=${encodeURIComponent(page)}`);
  return (
    <>
      <SiteHeader />
      <DataMain variant="task">
        <AboutTheData />
      </DataMain>
      <LegalFooter />
    </>
  );
}
