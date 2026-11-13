import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { appUrl } from "@/env";

/** Public, indexable pages. Add product marketing pages here as they are created. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(site.legal.lastUpdated);
  const pages: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1 },
    { path: "/pricing", priority: 0.8 },
    { path: "/contact", priority: 0.4 },
    { path: "/legal/terms", priority: 0.2 },
    { path: "/legal/privacy", priority: 0.2 },
    { path: "/legal/refunds", priority: 0.2 },
    { path: "/legal/dpa", priority: 0.2 },
  ];
  return pages.map((page) => ({ url: `${appUrl}${page.path}`, lastModified, changeFrequency: "monthly", priority: page.priority }));
}
