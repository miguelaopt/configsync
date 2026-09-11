import "server-only";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { games, presets } = schema;

export async function getDashboardData(userId: string) {
  const [recentGames, favoriteGames, recentPresets, totals] = await Promise.all([
    db
      .select()
      .from(games)
      .where(and(eq(games.userId, userId), eq(games.isArchived, false), isNotNull(games.lastOpenedAt)))
      .orderBy(desc(games.lastOpenedAt))
      .limit(6),
    db
      .select()
      .from(games)
      .where(and(eq(games.userId, userId), eq(games.isArchived, false), eq(games.isFavorite, true)))
      .orderBy(desc(games.lastOpenedAt))
      .limit(8),
    db
      .select({
        id: presets.id,
        name: presets.name,
        slug: presets.slug,
        updatedAt: presets.updatedAt,
        isDefault: presets.isDefault,
        gameName: games.name,
        gameSlug: games.slug,
        accentColor: games.accentColor,
        settingCount: sql<number>`(select count(*) from ${schema.settings} s where s.preset_id = ${presets.id})`,
      })
      .from(presets)
      .innerJoin(games, eq(games.id, presets.gameId))
      .where(and(eq(presets.userId, userId), eq(presets.isArchived, false), eq(games.isArchived, false)))
      .orderBy(desc(presets.updatedAt))
      .limit(6),
    db
      .select({
        games: sql<number>`count(distinct ${games.id})`,
        presets: sql<number>`count(distinct ${presets.id})`,
        settings: sql<number>`(select count(*) from ${schema.settings} s where s.user_id = ${userId})`,
      })
      .from(games)
      .leftJoin(presets, eq(presets.gameId, games.id))
      .where(and(eq(games.userId, userId), eq(games.isArchived, false))),
  ]);
  return {
    recentGames,
    favoriteGames,
    recentPresets: recentPresets.map((p) => ({ ...p, settingCount: Number(p.settingCount) })),
    totals: {
      games: Number(totals[0]?.games ?? 0),
      presets: Number(totals[0]?.presets ?? 0),
      settings: Number(totals[0]?.settings ?? 0),
    },
  };
}
