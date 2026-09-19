import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** The pages a signed-out visitor can read. Public profiles are not listed — they opt in by link. */
export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date();
  return ["", "/pricing", "/terms", "/privacy", "/refunds", "/sign-in", "/sign-up"].map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: updated,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
