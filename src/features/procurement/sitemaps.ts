import "server-only";
import { sql } from "drizzle-orm";
import { appUrl } from "@/env";
import { procurementConfig } from "./config";
import { countBuyers, listBuyerSlugs } from "./queries/buyers";
import { listLiveTenderOcids } from "./queries/notices";
import { db, int, queryRows } from "./queries/shared";
import { countPublicSuppliers, listPublicSupplierSlugs } from "./queries/suppliers";

/**
 * Sitemaps for the data pages, in chunks of 5,000 URLs:
 *   /sitemap-data.xml                index of the chunks below
 *   /sitemaps/tenders-0.xml …        open tenders (always listed)
 *   /sitemaps/suppliers-0.xml …      supplier pages   } only when PUBLIC_DATA_PAGES_INDEXABLE
 *   /sitemaps/buyers-0.xml …         buyer pages      } is on; otherwise 404 and not indexed
 */
export type SitemapKind = "tenders" | "suppliers" | "buyers";
type Entry = { path: string; lastModified: string | null };

const CHUNK = procurementConfig.sitemapChunk;
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function isKindListed(kind: SitemapKind): boolean {
  return kind === "tenders" || procurementConfig.publicDataPagesIndexable;
}

async function countOf(kind: SitemapKind): Promise<number> {
  if (kind === "suppliers") return countPublicSuppliers();
  if (kind === "buyers") return countBuyers();
  const [row] = await queryRows<{ n: unknown }>(
    db,
    sql`select count(*) as n from notices n where n.stage = 'tender' and n.is_latest and n.notice_type is distinct from 'UK12' and coalesce(n.status, 'active') = 'active' and n.deadline_at > now()`,
  );
  return int(row?.n);
}

/** Chunk file names that currently exist, e.g. ["tenders-0.xml", "suppliers-0.xml", "suppliers-1.xml"]. */
export async function listSitemapFiles(): Promise<string[]> {
  const files: string[] = [];
  for (const kind of ["tenders", "suppliers", "buyers"] as const) {
    if (!isKindListed(kind)) continue;
    const chunks = Math.max(1, Math.ceil((await countOf(kind)) / CHUNK));
    for (let index = 0; index < chunks; index += 1) files.push(`${kind}-${index}.xml`);
  }
  return files;
}

export async function sitemapIndexXml(): Promise<string> {
  const files = await listSitemapFiles();
  const items = files.map((file) => `  <sitemap><loc>${escapeXml(`${appUrl}/sitemaps/${file}`)}</loc></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

async function entriesOf(kind: SitemapKind, chunk: number): Promise<Entry[]> {
  const offset = chunk * CHUNK;
  if (kind === "suppliers") return (await listPublicSupplierSlugs(CHUNK, offset)).map((row) => ({ path: `/suppliers/${row.slug}`, lastModified: row.lastAwardAt }));
  if (kind === "buyers") return (await listBuyerSlugs(CHUNK, offset)).map((row) => ({ path: `/buyers/${row.slug}`, lastModified: row.lastNoticeAt }));
  return (await listLiveTenderOcids(CHUNK, offset)).map((row) => ({ path: `/tenders/${row.ocid}`, lastModified: row.publishedAt }));
}

/** XML of one chunk, or null when the file name is unknown, gated or past the end. */
export async function sitemapChunkXml(file: string): Promise<string | null> {
  const match = /^(tenders|suppliers|buyers)-(\d{1,4})\.xml$/.exec(file);
  if (!match) return null;
  const kind = match[1] as SitemapKind;
  if (!isKindListed(kind)) return null;
  const chunk = Number(match[2]);
  const entries = await entriesOf(kind, chunk);
  if (entries.length === 0 && chunk > 0) return null;
  const urls = entries
    .map((entry) => `  <url><loc>${escapeXml(`${appUrl}${entry.path}`)}</loc>${entry.lastModified ? `<lastmod>${entry.lastModified.slice(0, 10)}</lastmod>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
