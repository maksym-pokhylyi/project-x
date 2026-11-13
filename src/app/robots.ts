import type { MetadataRoute } from "next";
import { appUrl } from "@/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/dev", "/accept-invitation"] }],
    // sitemap-data.xml indexes the public data pages (src/features/procurement/sitemaps.ts).
    sitemap: [`${appUrl}/sitemap.xml`, `${appUrl}/sitemap-data.xml`],
  };
}
