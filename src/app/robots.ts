import type { MetadataRoute } from "next";
import { appUrl } from "@/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The app, admin and internal pages are not for search engines. (Auth pages are left
        // crawlable on purpose: they carry a noindex tag, which a crawler must be able to read.)
        disallow: ["/app", "/admin", "/api", "/dev", "/accept-invitation", "/styleguide", "/maintenance"],
      },
    ],
    // sitemap-data.xml indexes the public data pages (src/features/procurement/sitemaps.ts).
    sitemap: [`${appUrl}/sitemap.xml`, `${appUrl}/sitemap-data.xml`],
  };
}
