import type { CatalogFile } from "@/lib/catalog/schema";

export function configFileNames(file: CatalogFile): string[] {
  return [...new Set(Object.values(file.paths).map((path) => path.split(/[\\/]/).pop()!))];
}

/** Catalog IDs are logical roles (e.g. "video"), not necessarily filenames. */
export function matchConfigFile(files: CatalogFile[], filename: string): CatalogFile | undefined {
  const name = filename.toLowerCase();
  const exact = files.filter((file) =>
    configFileNames(file).some((candidate) => candidate.toLowerCase() === name),
  );
  if (exact.length) return exact.length === 1 ? exact[0] : undefined;

  // CS2 includes user/slot suffixes. Match whole tokens, never arbitrary substrings.
  const tokens = name.split(/[^a-z0-9]+/);
  const matches = files.filter((file) => tokens.includes(file.id.toLowerCase()));
  return matches.length === 1 ? matches[0] : undefined;
}
