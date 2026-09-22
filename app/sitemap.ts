import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { CATALOG } from "@/lib/catalog";
import { CHANGELOG } from "@/content/changelog";

/**
 * The pages a signed-out visitor can read. Public profiles are not listed — they opt in by link.
 * No lastModified: a date that changes on every request is worse for crawlers than none.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/pricing",
    "/for",
    ...CATALOG.map((g) => `/for/${g.id}`),
    "/docs/companion",
    "/docs/import-export",
    "/changelog",
    "/contact",
    "/terms",
    "/privacy",
    "/refunds",
    "/sign-in",
    "/sign-up",
  ].map((path) => ({
    url: `${SITE.url}${path}`,
    // The changelog is the one page with a date we can stand behind.
    ...(path === "/changelog" ? { lastModified: CHANGELOG[0]!.date } : {}),
    changeFrequency: path === "" || path === "/changelog" ? "weekly" : "monthly",
    priority:
      path === ""
        ? 1
        : path.startsWith("/for") || path === "/pricing" || path.startsWith("/docs")
          ? 0.8
          : 0.5,
  }));
}
