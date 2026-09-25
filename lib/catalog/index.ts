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
  const {
    id,
    files: _f,
    steamAppId: _s,
    epicAppName: _e,
    processNames: _p,
    presets,
    ...rest
  } = game;
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
    processNames: g.processNames,
  }));
}
export type PublicCatalogEntry = ReturnType<typeof publicCatalog>[number];

/** Where a catalog setting lives on disk, for the setting details panel. Client-safe shape. */
export type SettingFileInfo = { file: string; keys: string[]; bind: boolean };

/**
 * Setting name → the file it is stored in and the key(s) inside it, for one catalog game.
 * Settings the catalog does not map to a file are absent: the companion skips them on apply.
 */
export function settingFiles(catalogId: string): Record<string, SettingFileInfo> {
  const game = getCatalogGame(catalogId);
  if (!game) return {};
  const fileName = (id: string) => {
    const f = game.files.find((x) => x.id === id);
    const path = f?.paths["steam-windows"] ?? Object.values(f?.paths ?? {})[0] ?? id;
    return path.split(/[\\/]/).pop() ?? path;
  };
  const out: Record<string, SettingFileInfo> = {};
  for (const c of game.presets[0]?.categories ?? [])
    for (const s of c.settings) {
      const src = s.source;
      if (!src) continue;
      const keys =
        "key" in src
          ? [src.key]
          : "width" in src
            ? [src.width, src.height]
            : "bind" in src
              ? [src.bind]
              : [...new Set(src.match.flatMap((m) => Object.keys(m.keys)))];
      out[s.name] = { file: fileName(src.file), keys, bind: "bind" in src };
    }
  return out;
}
