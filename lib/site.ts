/** Public, non-secret site constants (safe in client components). */
export const SITE = {
  name: "GameSettings Vault",
  tagline: "Your game settings. One place.",
  /** Set NEXT_PUBLIC_REPO_URL once the repository is published. */
  repoUrl:
    process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/gamesettings-vault/gamesettings-vault",
  docsImportExport: "docs/import-export.md",
  version: "0.1.0",
};
