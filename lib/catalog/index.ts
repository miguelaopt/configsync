import cs2 from "@/catalog/cs2.json";
import rocketLeague from "@/catalog/rocket-league.json";
import { catalogGameSchema, type CatalogGame } from "./schema";
import { buildExportFile } from "@/lib/import-export/serialize";
import type { ExportFile, GameDoc } from "@/lib/import-export/schema";

export * from "./schema";

/** Add a game: drop its JSON in catalog/ and import it here. Validated once at module load. */
export const CATALOG: CatalogGame[] = [cs2, rocketLeague].map((raw, index) => {
  const parsed = catalogGameSchema.safeParse(raw);
  if (!parsed.success) {
    const id = (raw as { id?: string }).id ?? index;
    throw new Error(
      `Invalid catalog entry "${id}": ${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`,
    );
  }
  return parsed.data;
});

export function getCatalogGame(id: string): CatalogGame | null {
  return CATALOG.find((g) => g.id === id) ?? null;
}

/** The catalog entry as a plain GameDoc: catalog-only fields removed, catalogId set. */
export function catalogToGameDoc(game: CatalogGame): GameDoc {
  const { id, files: _files, steamAppId: _s, epicAppName: _e, presets, ...rest } = game;
  return {
    ...rest,
    catalogId: id,
    presets: presets.map((p) => ({
      ...p,
      categories: p.categories.map((c) => ({
        ...c,
        settings: c.settings.map(({ source: _source, ...s }) => s),
      })),
    })),
  };
}

export function catalogToExportFile(game: CatalogGame): ExportFile {
  return buildExportFile([catalogToGameDoc(game)], "game");
}

/** Lightweight listing for the Add-game dialog and the CLI. */
export function publicCatalog() {
  return CATALOG.map((g) => ({
    id: g.id,
    name: g.name,
    coverUrl: g.coverUrl ?? null,
    accentColor: g.accentColor ?? null,
    steamAppId: g.steamAppId ?? null,
    epicAppName: g.epicAppName ?? null,
    settingCount: g.presets[0]!.categories.reduce((n, c) => n + c.settings.length, 0),
    files: g.files,
  }));
}
export type PublicCatalogEntry = ReturnType<typeof publicCatalog>[number];
