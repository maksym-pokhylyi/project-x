import { sitemapChunkXml } from "@/features/procurement/sitemaps";

/** One sitemap chunk: /sitemaps/tenders-0.xml, /sitemaps/suppliers-3.xml, /sitemaps/buyers-0.xml. */
// Rendered on request (no database access at build time); the CDN caches it for an hour.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }): Promise<Response> {
  const xml = await sitemapChunkXml((await context.params).file);
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=3600" } });
}
