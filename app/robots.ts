import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** Public pages are crawlable; the app, the API and other people's exports are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/games", "/import", "/export", "/settings", "/search"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
