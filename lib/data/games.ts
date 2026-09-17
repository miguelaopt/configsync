import "server-only";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { uniqueSlug } from "@/lib/utils/slug";
import { assertCanAddGame } from "@/lib/billing/plan";
import { notFound } from "./errors";
import type { GameInput } from "@/lib/validation";

const { games, presets } = schema;

export type GameListItem = schema.Game & { presetCount: number };

export async function listGames(
  userId: string,
  opts: { archived?: boolean; query?: string } = {},
): Promise<GameListItem[]> {
  const conditions = [eq(games.userId, userId), eq(games.isArchived, opts.archived ?? false)];
  if (opts.query?.trim()) {
    const q = `%${escapeLike(opts.query.trim())}%`;
    conditions.push(
      or(
        ilike(games.name, q),
        sql`array_to_string(${games.tags}, ' ') ILIKE ${q}`,
        sql`array_to_string(${games.platforms}, ' ') ILIKE ${q}`,
      )!,
    );
  }
  const rows = await db
    .select({ game: games, presetCount: count(presets.id) })
    .from(games)
    .leftJoin(presets, and(eq(presets.gameId, games.id), eq(presets.isArchived, false)))
    .where(and(...conditions))
    .groupBy(games.id)
    .orderBy(desc(games.isFavorite), asc(games.name));
  return rows.map((r) => ({ ...r.game, presetCount: Number(r.presetCount) }));
}

export async function getGameBySlug(userId: string, slug: string) {
  return db.query.games.findFirst({
    where: and(eq(games.userId, userId), eq(games.slug, slug)),
  });
}

export async function getGameById(userId: string, gameId: string, tx: Tx | typeof db = db) {
  const game = await tx.query.games.findFirst({
    where: and(eq(games.userId, userId), eq(games.id, gameId)),
  });
  if (!game) throw notFound("game");
  return game;
}

/** Presets of a game with their category/setting counts, active first. */
export async function listPresetsForGame(userId: string, gameId: string) {
  const rows = await db
    .select({
      preset: presets,
      categoryCount: sql<number>`(select count(*) from categories c where c.preset_id = "presets"."id")`,
      settingCount: sql<number>`(select count(*) from settings s where s.preset_id = "presets"."id")`,
    })
    .from(presets)
    .where(and(eq(presets.userId, userId), eq(presets.gameId, gameId)))
    .orderBy(
      asc(presets.isArchived),
      desc(presets.isDefault),
      desc(presets.isFavorite),
      asc(presets.name),
    );
  return rows.map((r) => ({
    ...r.preset,
    categoryCount: Number(r.categoryCount),
    settingCount: Number(r.settingCount),
  }));
}

async function takenGameSlugs(userId: string, tx: Tx | typeof db = db) {
  const rows = await tx.select({ slug: games.slug }).from(games).where(eq(games.userId, userId));
  return rows.map((r) => r.slug);
}

export async function createGame(userId: string, input: GameInput, tx: Tx | typeof db = db) {
  await assertCanAddGame(userId, tx);
  const slug = uniqueSlug(input.name, await takenGameSlugs(userId, tx));
  const [game] = await tx
    .insert(games)
    .values({ ...input, userId, slug })
    .returning();
  return game!;
}

export async function updateGame(userId: string, gameId: string, input: GameInput) {
  const existing = await getGameById(userId, gameId);
  let slug = existing.slug;
  if (existing.name !== input.name) {
    const taken = (await takenGameSlugs(userId)).filter((s) => s !== existing.slug);
    slug = uniqueSlug(input.name, taken);
  }
  const [game] = await db
    .update(games)
    .set({ ...input, slug })
    .where(and(eq(games.id, gameId), eq(games.userId, userId)))
    .returning();
  return game!;
}

export async function setGameFlags(
  userId: string,
  gameId: string,
  flags: Partial<Pick<schema.Game, "isFavorite" | "isArchived">>,
) {
  if (flags.isArchived === false) await assertCanAddGame(userId); // un-archiving takes a slot
  const [game] = await db
    .update(games)
    .set(flags)
    .where(and(eq(games.id, gameId), eq(games.userId, userId)))
    .returning();
  if (!game) throw notFound("game");
  return game;
}

export async function setGameCover(userId: string, gameId: string, attachmentId: string | null) {
  await getGameById(userId, gameId);
  await db
    .update(games)
    .set({ coverAttachmentId: attachmentId, coverUrl: attachmentId ? null : undefined })
    .where(and(eq(games.id, gameId), eq(games.userId, userId)));
}

export async function deleteGame(userId: string, gameId: string) {
  const deleted = await db
    .delete(games)
    .where(and(eq(games.id, gameId), eq(games.userId, userId)))
    .returning({ id: games.id });
  if (deleted.length === 0) throw notFound("game");
}

export async function touchGameOpened(userId: string, gameId: string) {
  await db
    .update(games)
    // Opening a game is not an edit: keep updated_at untouched.
    .set({ lastOpenedAt: new Date(), updatedAt: sql`${games.updatedAt}` })
    .where(and(eq(games.id, gameId), eq(games.userId, userId)));
}

export function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}
