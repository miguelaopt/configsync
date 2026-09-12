import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { catalogToGameDoc, getCatalogGame } from "@/lib/catalog";
import { importFile } from "@/lib/data/import";
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

/** Creates the game + its Default preset from the catalog. Always creates; callers decide whether to reuse. */
export async function createGameFromCatalog(userId: string, catalogId: string) {
  const entry = getCatalogGame(catalogId);
  if (!entry) throw new AppError("That game isn't in the catalog.");
  const doc = catalogToGameDoc(entry);
  const outcome = await importFile(userId, {
    format: "gamesettings-vault",
    version: 1,
    kind: "game",
    games: [doc],
  });
  const created = outcome.createdGames[0];
  if (!created) throw new AppError(`You already have "${entry.name}". Open it from your library.`);
  await db.update(schema.games).set({ catalogId }).where(eq(schema.games.id, created.id));
  return created;
}
