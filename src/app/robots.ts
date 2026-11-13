import type { MetadataRoute } from "next";
import { appUrl } from "@/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/dev", "/accept-invitation"] }],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
