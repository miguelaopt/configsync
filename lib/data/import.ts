import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createGame, getGameById } from "./games";
import { insertCategoriesFromDocs } from "./presets";
import { uniqueSlug } from "@/lib/utils/slug";
import type { ExportFile, GameDoc } from "@/lib/import-export/schema";

const { games, presets } = schema;

export type ImportOutcome = {
  createdGames: { id: string; slug: string; name: string }[];
  createdPresets: number;
  createdSettings: number;
};

/**
 * Imports a validated file. Additive only: existing games/presets are never modified.
 * - `targetGameId`: put every preset of the file into this game instead of creating games.
 * - Otherwise a game with the same name (case-insensitive) receives the presets; else it is created.
 * Preset names that collide get a numeric suffix.
 */
export async function importFile(
  userId: string,
  file: ExportFile,
  opts: { targetGameId?: string | null } = {},
): Promise<ImportOutcome> {
  return db.transaction(async (tx) => {
    const outcome: ImportOutcome = { createdGames: [], createdPresets: 0, createdSettings: 0 };

    for (const gameDoc of file.games) {
      let gameId: string;
      if (opts.targetGameId) {
        gameId = (await getGameById(userId, opts.targetGameId, tx)).id;
      } else {
        const existing = await tx.query.games.findFirst({
          where: and(eq(games.userId, userId), eq(games.slug, uniqueSlug(gameDoc.name, []))),
        });
        if (existing) {
          gameId = existing.id;
        } else {
          const created = await createGame(
            userId,
            {
              name: gameDoc.name,
              platforms: gameDoc.platforms,
              tags: gameDoc.tags,
              accentColor: gameDoc.accentColor ?? null,
              coverUrl: gameDoc.coverUrl ?? null,
              notes: gameDoc.notes ?? null,
            },
            tx,
          );
          gameId = created.id;
          outcome.createdGames.push({ id: created.id, slug: created.slug, name: created.name });
        }
      }
      await importPresetsInto(tx, userId, gameId, gameDoc, outcome);
    }
    return outcome;
  });
}

async function importPresetsInto(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  gameId: string,
  gameDoc: GameDoc,
  outcome: ImportOutcome,
) {
  const existing = await tx
    .select({ slug: presets.slug, name: presets.name, id: presets.id })
    .from(presets)
    .where(eq(presets.gameId, gameId));
  const taken = new Set(existing.map((p) => p.slug));
  let hasDefault =
    (await tx.query.presets.findFirst({
      where: and(eq(presets.gameId, gameId), eq(presets.isDefault, true)),
    })) != null;

  for (const presetDoc of gameDoc.presets) {
    const slug = uniqueSlug(presetDoc.name, taken);
    taken.add(slug);
    const name =
      slug === uniqueSlug(presetDoc.name, [])
        ? presetDoc.name
        : `${presetDoc.name} (${slug.split("-").pop()})`;
    const [created] = await tx
      .insert(presets)
      .values({
        userId,
        gameId,
        name,
        slug,
        description: presetDoc.description ?? null,
        notes: presetDoc.notes ?? null,
        tags: presetDoc.tags,
        isDefault: !hasDefault && presetDoc.isDefault,
      })
      .returning({ id: presets.id });
    if (!hasDefault && presetDoc.isDefault) hasDefault = true;
    await insertCategoriesFromDocs(tx, userId, created!.id, presetDoc.categories);
    outcome.createdPresets++;
    outcome.createdSettings += presetDoc.categories.reduce((n, c) => n + c.settings.length, 0);
  }
}
