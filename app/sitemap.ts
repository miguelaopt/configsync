import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * The pages a signed-out visitor can read. Public profiles are not listed — they opt in by link.
 * No lastModified: a date that changes on every request is worse for crawlers than none.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/pricing",
    "/docs/companion",
    "/terms",
    "/privacy",
    "/refunds",
    "/sign-in",
    "/sign-up",
  ].map((path) => ({
    url: `${SITE.url}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/pricing" || path === "/docs/companion" ? 0.8 : 0.5,
  }));
}
