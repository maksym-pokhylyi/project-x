/**
 * Procurement module settings. Read on the server only.
 *
 * Environment variables (all optional):
 *   PUBLIC_DATA_PAGES_INDEXABLE  "true" lets search engines index /suppliers/* and /buyers/*
 *                                and adds them to the sitemap. Default false: those pages
 *                                launch as noindex (docs/research/round2/P2 §4.6).
 *   AI_MODEL_MATCH_REASON        AI Gateway model id for match reasons
 *                                (default "google/gemini-2.5-flash-lite").
 *   FTS_API_BASE                 Override of the Find a Tender API origin (tests).
 */
const flag = (value: string | undefined) => value === "true" || value === "1";

export const procurementConfig = {
  /** Robots meta + sitemap inclusion for supplier and buyer pages. Tender pages, /find and /about-the-data are always indexable. */
  get publicDataPagesIndexable(): boolean {
    return flag(process.env.PUBLIC_DATA_PAGES_INDEXABLE);
  },
  get matchReasonModel(): string {
    return process.env.AI_MODEL_MATCH_REASON?.trim() || "google/gemini-2.5-flash-lite";
  },
  get ftsApiBase(): string {
    return process.env.FTS_API_BASE?.trim() || "https://www.find-tender.service.gov.uk";
  },
  /** Items shown per block on an unclaimed public supplier page. */
  publicBlockItems: 3,
  /** Matches a workspace on the free plan can see in full. */
  freeMatchLimit: 10,
  /** How many top matches get a model-written reason. */
  aiReasonLimit: 15,
  /** Public data is re-read at most this often (seconds). */
  revalidateSeconds: 3600,
  /** Entries per sitemap file. */
  sitemapChunk: 5000,
  /** Minimum gap between requests to the Find a Tender API (ms). One every ~10 s is safe. */
  ftsRequestGapMs: 10_000,
} as const;

export const OGL_ATTRIBUTION = "Contains public sector information licensed under the Open Government Licence v3.0.";
export const OGL_URL = "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";
export const INDEPENDENCE_STATEMENT = "Bidfolio is an independent service and is not affiliated with, or endorsed by, the UK Government.";
