import { sitemapIndexXml } from "@/features/procurement/sitemaps";

/** Sitemap index of the public data pages (tenders always; suppliers and buyers when indexing is switched on). */
// Rendered on request (no database access at build time); the CDN caches it for an hour.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return new Response(await sitemapIndexXml(), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=3600" } });
}
