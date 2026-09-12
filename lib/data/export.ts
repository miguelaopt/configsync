import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notFound } from "./errors";
import { toPresetDoc, type PresetFull } from "./presets";
import type { GameDoc } from "@/lib/import-export/schema";

const { games, presets, categories, settings } = schema;

function gameToDoc(game: schema.Game, presetRows: PresetFull[]): GameDoc {
  return {
    name: game.name,
    platforms: game.platforms,
    tags: game.tags,
    accentColor: game.accentColor,
    coverUrl: game.coverUrl,
    notes: game.notes,
    catalogId: game.catalogId,
    presets: presetRows.map(toPresetDoc),
  };
}

const withTree = () => ({
  categories: {
    orderBy: [asc(categories.position), asc(categories.createdAt)],
    with: { settings: { orderBy: [asc(settings.position), asc(settings.createdAt)] } },
  },
});

/** All non-archived games with all presets. */
export async function exportLibrary(userId: string, opts: { includeArchived?: boolean } = {}) {
  const rows = await db.query.games.findMany({
    where: opts.includeArchived
      ? eq(games.userId, userId)
      : and(eq(games.userId, userId), eq(games.isArchived, false)),
    orderBy: [asc(games.name)],
    with: {
      presets: {
        where: opts.includeArchived ? undefined : eq(presets.isArchived, false),
        orderBy: [asc(presets.name)],
        with: withTree(),
      },
    },
  });
  return rows.map((g) => gameToDoc(g, g.presets as PresetFull[]));
}

export async function exportGame(userId: string, gameId: string): Promise<GameDoc> {
  const game = await db.query.games.findFirst({
    where: and(eq(games.userId, userId), eq(games.id, gameId)),
    with: { presets: { orderBy: [asc(presets.name)], with: withTree() } },
  });
  if (!game) throw notFound("game");
  return gameToDoc(game, game.presets as PresetFull[]);
}

export async function exportPreset(userId: string, presetId: string): Promise<GameDoc> {
  const preset = await db.query.presets.findFirst({
    where: and(eq(presets.userId, userId), eq(presets.id, presetId)),
    with: { game: true, ...withTree() },
  });
  if (!preset) throw notFound("preset");
  return gameToDoc(preset.game, [preset as unknown as PresetFull]);
}
