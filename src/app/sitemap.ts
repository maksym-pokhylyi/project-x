import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { appUrl } from "@/env";

/**
 * Public, indexable marketing and legal pages. The procurement module adds its own entries
 * (supplier, buyer and tender pages, /find, /about-the-data) next to these.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(site.legal.lastUpdated);
  const pages: Array<{ path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }> = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/free-bid-check", priority: 0.9, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
    { path: "/legal/terms", priority: 0.2, changeFrequency: "yearly" },
    { path: "/legal/privacy", priority: 0.2, changeFrequency: "yearly" },
    { path: "/legal/refunds", priority: 0.2, changeFrequency: "yearly" },
    { path: "/legal/acceptable-use", priority: 0.2, changeFrequency: "yearly" },
    { path: "/legal/dpa", priority: 0.2, changeFrequency: "yearly" },
  ];
  return pages.map((page) => ({ url: `${appUrl}${page.path}`, lastModified, changeFrequency: page.changeFrequency, priority: page.priority }));
}
