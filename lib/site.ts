/** Public, non-secret site constants (safe in client components). */
export const SITE = {
  name: "ConfigSync",
  tagline: "Your game settings. One place.",
  /** Set NEXT_PUBLIC_REPO_URL once the repository is published. */
  repoUrl: process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/miguelaopt/configsync",
  docsImportExport: "docs/import-export.md",
  docsCompanion: "docs/companion.md",
  version: "0.1.0",
};
