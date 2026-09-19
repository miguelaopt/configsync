import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { listRecentPresets } from "./presets";
import { listDeviceState, overallSync, syncLabelsForGames, type SyncLabel } from "./sync";

const { games, presets, revisions } = schema;

export type { SyncLabel };

/** One line in the activity feed: a preset save, or a PC that reported in. */
export type Activity = {
  kind: "preset" | "device";
  text: string;
  detail: string;
  at: Date;
  href?: string;
};

export async function getDashboardData(userId: string) {
  const [recentGames, recentPresets, totals, deviceRows, activity] = await Promise.all([
    db
      .select({
        id: games.id,
        name: games.name,
        slug: games.slug,
        catalogId: games.catalogId,
        platforms: games.platforms,
        accentColor: games.accentColor,
        coverAttachmentId: games.coverAttachmentId,
        coverUrl: games.coverUrl,
        lastOpenedAt: games.lastOpenedAt,
        presetCount: sql<number>`(select count(*) from presets p where p.game_id = "games"."id" and p.is_archived = false)`,
        settingCount: sql<number>`(select count(*) from settings s join presets p on p.id = s.preset_id where p.game_id = "games"."id")`,
      })
      .from(games)
      .where(and(eq(games.userId, userId), eq(games.isArchived, false)))
      .orderBy(desc(games.isFavorite), desc(games.lastOpenedAt))
      .limit(4),
    listRecentPresets(userId, 5),
    db
      .select({
        games: sql<number>`count(distinct ${games.id})`,
        presets: sql<number>`count(distinct ${presets.id})`,
        settings: sql<number>`(select count(*) from ${schema.settings} s where s.user_id = ${userId})`,
      })
      .from(games)
      .leftJoin(presets, eq(presets.gameId, games.id))
      .where(and(eq(games.userId, userId), eq(games.isArchived, false))),
    listDeviceState(userId, 4),
    db
      .select({
        note: revisions.note,
        createdAt: revisions.createdAt,
        presetName: presets.name,
        presetSlug: presets.slug,
        gameName: games.name,
        gameSlug: games.slug,
      })
      .from(revisions)
      .innerJoin(presets, eq(presets.id, revisions.presetId))
      .innerJoin(games, eq(games.id, presets.gameId))
      .where(eq(revisions.userId, userId))
      .orderBy(desc(revisions.createdAt))
      .limit(5),
  ]);

  const syncByGame = await syncLabelsForGames(userId, recentGames, deviceRows.length > 0);

  const feed: Activity[] = [
    ...activity.map((r) => ({
      kind: "preset" as const,
      text: r.note ?? `Saved ${r.presetName}`,
      detail: r.gameName,
      at: r.createdAt,
      href: `/games/${r.gameSlug}/${r.presetSlug}`,
    })),
    ...deviceRows.map((d) => ({
      kind: "device" as const,
      text: `${d.name} reported in`,
      detail: `${Object.keys(d.applied ?? {}).length || "no"} games applied`,
      at: d.lastSeenAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 5);

  const labels = [...syncByGame.values()];
  return {
    recentGames: recentGames.map((g) => ({
      ...g,
      presetCount: Number(g.presetCount),
      settingCount: Number(g.settingCount),
      sync: syncByGame.get(g.id) ?? null,
    })),
    recentPresets: recentPresets.map((p) => ({
      ...p,
      settingCount: Number(p.settingCount),
      sync: syncByGame.get(p.gameId) ?? null,
    })),
    devices: deviceRows.map((d) => ({
      id: d.id,
      name: d.name,
      platform: d.platform,
      lastSeenAt: d.lastSeenAt,
      games: Object.keys(d.applied ?? {}).length,
    })),
    activity: feed,
    totals: {
      games: Number(totals[0]?.games ?? 0),
      presets: Number(totals[0]?.presets ?? 0),
      settings: Number(totals[0]?.settings ?? 0),
    },
    /** Headline state: only "synced" when every tracked game on every PC is up to date. */
    overall: overallSync(labels),
  };
}
