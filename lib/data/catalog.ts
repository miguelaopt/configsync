import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { catalogToGameDoc, getCatalogGame } from "@/lib/catalog";
import { importFile } from "@/lib/data/import";
import { getGameBySlug } from "@/lib/data/games";
import { getPresetBySlug, getPresetFull, toPresetDoc } from "@/lib/data/presets";
import { readGameConfig, writeGameConfig, type ConfigFiles } from "@/lib/game-configs";
import { presetFingerprint } from "@/lib/import-export/fingerprint";
import { uniqueSlug } from "@/lib/utils/slug";
import { AppError } from "./errors";

export async function findGameByCatalogId(userId: string, catalogId: string) {
  return db.query.games.findFirst({
    where: and(
      eq(schema.games.userId, userId),
      eq(schema.games.catalogId, catalogId),
      eq(schema.games.isArchived, false),
    ),
  });
}

/** Catalog ids of games this user already owns, for graying out the picker. */
export async function listOwnedCatalogIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ catalogId: schema.games.catalogId })
    .from(schema.games)
    .where(
      and(
        eq(schema.games.userId, userId),
        isNotNull(schema.games.catalogId),
        eq(schema.games.isArchived, false),
      ),
    );
  return rows.map((r) => r.catalogId!);
}

const alreadyHaveIt = (name: string) =>
  new AppError(`You already have "${name}". Open it from your library.`);

/** Creates the game + its Default preset from the catalog. Refuses if the user already has it. */
export async function createGameFromCatalog(userId: string, catalogId: string) {
  const entry = getCatalogGame(catalogId);
  if (!entry) throw new AppError("That game isn't in the catalog.");

  // Check before acting: importFile merges into a same-slug game instead of creating one,
  // which would otherwise commit a duplicate Default preset before we could refuse.
  const already =
    (await findGameByCatalogId(userId, catalogId)) ??
    (await getGameBySlug(userId, uniqueSlug(entry.name, [])));
  if (already) throw alreadyHaveIt(entry.name);

  const doc = catalogToGameDoc(entry);
  const outcome = await importFile(userId, {
    format: "gamesettings-vault",
    version: 1,
    kind: "game",
    games: [doc],
  });
  const created = outcome.createdGames[0];
  // Last line of defence, in case of a race between the check above and this import.
  if (!created) throw alreadyHaveIt(entry.name);
  await db.update(schema.games).set({ catalogId }).where(eq(schema.games.id, created.id));
  return created;
}

/** Reads the uploaded config files through the catalog mapping and saves them as a new preset. */
export async function importConfigFiles(
  userId: string,
  input: { catalogId: string; files: ConfigFiles; name?: string | null; device?: string | null },
) {
  const entry = getCatalogGame(input.catalogId);
  if (!entry) throw new AppError("That game isn't in the catalog.");
  if (Object.keys(input.files).length === 0) throw new AppError("No config files were provided.");
  const read = readGameConfig(entry, input.files);
  const game =
    (await findGameByCatalogId(userId, input.catalogId)) ??
    (await createGameFromCatalog(userId, input.catalogId));
  const stamp = new Date().toISOString().slice(0, 10);
  const from = input.device ? ` from ${input.device}` : "";
  const name = input.name?.trim() || `Imported${from} ${stamp}`;
  const doc = catalogToGameDoc(entry);
  const outcome = await importFile(
    userId,
    {
      format: "gamesettings-vault",
      version: 1,
      kind: "preset",
      games: [{ ...doc, presets: [{ ...read.preset, name, isDefault: false }] }],
    },
    { targetGameId: game.id },
  );
  return { gameSlug: game.slug, presetSlug: outcome.createdPresetSlugs[0]!, read };
}

/** Patches the given config files with a preset's values. The preset is found by id or by slug. */
export async function patchConfigFiles(
  userId: string,
  input: { catalogId: string; presetId?: string; presetSlug?: string; files: ConfigFiles },
) {
  const entry = getCatalogGame(input.catalogId);
  if (!entry) throw new AppError("That game isn't in the catalog.");
  let presetId = input.presetId;
  if (!presetId) {
    const game = await findGameByCatalogId(userId, input.catalogId);
    if (!game)
      throw new AppError(`You don't have ${entry.name} in your library yet. Run import first.`);
    const row = await getPresetBySlug(userId, game.id, input.presetSlug ?? "");
    if (!row) throw new AppError(`No preset "${input.presetSlug}" in ${game.name}.`);
    presetId = row.id;
  }
  const preset = toPresetDoc(await getPresetFull(userId, presetId));
  return writeGameConfig(entry, preset, input.files);
}

export type SyncTarget = {
  catalogId: string;
  gameSlug: string;
  presetSlug: string;
  presetName: string;
  version: string;
};

/** The Default preset of one catalog game, with a content fingerprint; null when none. */
export async function defaultPresetFor(
  userId: string,
  catalogId: string,
): Promise<SyncTarget | null> {
  const game = await findGameByCatalogId(userId, catalogId);
  if (!game) return null;
  const row = await db.query.presets.findFirst({
    where: and(
      eq(schema.presets.gameId, game.id),
      eq(schema.presets.isDefault, true),
      eq(schema.presets.isArchived, false),
    ),
    columns: { id: true, slug: true, name: true },
  });
  if (!row) return null;
  const full = await getPresetFull(userId, row.id);
  return {
    catalogId,
    gameSlug: game.slug,
    presetSlug: row.slug,
    presetName: row.name,
    version: presetFingerprint(toPresetDoc(full)),
  };
}

/** Every catalog game the user owns that has a Default preset. */
export async function listSyncTargets(userId: string): Promise<SyncTarget[]> {
  const ids = await listOwnedCatalogIds(userId);
  // ponytail: one full-preset load per catalog game per poll; cache by max(updated_at) if it ever matters.
  const targets = await Promise.all(ids.map((id) => defaultPresetFor(userId, id)));
  return targets.filter((t): t is SyncTarget => t !== null);
}
