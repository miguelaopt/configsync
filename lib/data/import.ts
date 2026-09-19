import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createGame, getGameById } from "./games";
import { insertCategoriesFromDocs } from "./presets";
import { uniqueSlug } from "@/lib/utils/slug";
import type { ExportFile, GameDoc } from "@/lib/import-export/schema";

const { games, presets } = schema;

export type ImportOutcome = {
  createdGames: { id: string; slug: string; name: string }[];
  createdPresets: number;
  createdPresetSlugs: string[];
  createdSettings: number;
  skippedPresets: number;
  replacedPresets: number;
};

/** What to do when a preset of the same name already exists in the target game. */
export type ImportStrategy = "keep-both" | "skip" | "replace";

export type ImportPreview = {
  games: {
    name: string;
    exists: boolean;
    presets: {
      name: string;
      settingCount: number;
      /** Present when a preset of this name already lives in the target game. */
      conflict: { settingCount: number; updatedAt: Date } | null;
    }[];
  }[];
  totals: { games: number; presets: number; settings: number; conflicts: number };
};

/**
 * Reads a validated file and reports what importing it would do — without writing anything.
 * Conflicts are matched the way the importer matches them: by the slug a name would take.
 */
export async function previewImport(
  userId: string,
  file: ExportFile,
  opts: { targetGameId?: string | null } = {},
): Promise<ImportPreview> {
  const out: ImportPreview = {
    games: [],
    totals: { games: 0, presets: 0, settings: 0, conflicts: 0 },
  };

  for (const gameDoc of file.games) {
    const target = opts.targetGameId
      ? await db.query.games.findFirst({
          where: and(eq(games.userId, userId), eq(games.id, opts.targetGameId)),
        })
      : await db.query.games.findFirst({
          where: and(eq(games.userId, userId), eq(games.slug, uniqueSlug(gameDoc.name, []))),
        });

    const existing = target
      ? await db
          .select({
            slug: presets.slug,
            updatedAt: presets.updatedAt,
            settingCount: sql<number>`(select count(*) from settings s where s.preset_id = "presets"."id")`,
          })
          .from(presets)
          .where(and(eq(presets.userId, userId), eq(presets.gameId, target.id)))
      : [];
    const bySlug = new Map(existing.map((p) => [p.slug, p]));

    const rows = gameDoc.presets.map((p) => {
      const hit = bySlug.get(uniqueSlug(p.name, []));
      const settingCount = p.categories.reduce((n, c) => n + c.settings.length, 0);
      out.totals.presets++;
      out.totals.settings += settingCount;
      if (hit) out.totals.conflicts++;
      return {
        name: p.name,
        settingCount,
        conflict: hit ? { settingCount: Number(hit.settingCount), updatedAt: hit.updatedAt } : null,
      };
    });
    out.totals.games++;
    out.games.push({ name: gameDoc.name, exists: Boolean(target), presets: rows });
  }
  return out;
}

/**
 * Imports a validated file.
 * - `targetGameId`: put every preset of the file into this game instead of creating games.
 * - Otherwise a game with the same name (case-insensitive) receives the presets; else it is created.
 * - `strategy` decides what happens when a preset name already exists there:
 *   "keep-both" (default) suffixes the incoming one, "skip" leaves yours alone, "replace" deletes
 *   yours first. Only "replace" ever destroys anything, and only what the name matched.
 */
export async function importFile(
  userId: string,
  file: ExportFile,
  opts: { targetGameId?: string | null; strategy?: ImportStrategy } = {},
): Promise<ImportOutcome> {
  return db.transaction(async (tx) => {
    const outcome: ImportOutcome = {
      createdGames: [],
      createdPresets: 0,
      createdPresetSlugs: [],
      createdSettings: 0,
      skippedPresets: 0,
      replacedPresets: 0,
    };

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
      await importPresetsInto(tx, userId, gameId, gameDoc, outcome, opts.strategy ?? "keep-both");
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
  strategy: ImportStrategy,
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

  const bySlug = new Map(existing.map((p) => [p.slug, p]));

  for (const presetDoc of gameDoc.presets) {
    const base = uniqueSlug(presetDoc.name, []);
    const clash = bySlug.get(base);
    if (clash && strategy === "skip") {
      outcome.skippedPresets++;
      continue;
    }
    if (clash && strategy === "replace") {
      // Cascades to that preset's categories, settings and revisions — the user asked for it.
      await tx.delete(presets).where(eq(presets.id, clash.id));
      taken.delete(base);
      bySlug.delete(base);
      outcome.replacedPresets++;
    }
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
    outcome.createdPresetSlugs.push(slug);
    outcome.createdSettings += presetDoc.categories.reduce((n, c) => n + c.settings.length, 0);
  }
}
