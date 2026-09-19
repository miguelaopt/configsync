/** Public, non-secret site constants (safe in client components). */
export const SITE = {
  name: "ConfigSync",
  tagline: "Your game settings. One place.",
  /** Public origin, for absolute URLs in robots/sitemap. */
  url: process.env.NEXT_PUBLIC_APP_URL || "https://configsync.app",
  version: "0.1.0",
};
