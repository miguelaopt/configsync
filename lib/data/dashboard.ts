import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { deviceRowsForGame } from "./devices";

const { devices, games, presets, revisions } = schema;

export type SyncLabel = "synced" | "pending" | "never" | "failed";

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
    db
      .select({
        id: presets.id,
        name: presets.name,
        slug: presets.slug,
        updatedAt: presets.updatedAt,
        isDefault: presets.isDefault,
        gameId: games.id,
        gameName: games.name,
        gameSlug: games.slug,
        accentColor: games.accentColor,
        coverAttachmentId: games.coverAttachmentId,
        coverUrl: games.coverUrl,
        settingCount: sql<number>`(select count(*) from settings s where s.preset_id = "presets"."id")`,
      })
      .from(presets)
      .innerJoin(games, eq(games.id, presets.gameId))
      .where(
        and(eq(presets.userId, userId), eq(presets.isArchived, false), eq(games.isArchived, false)),
      )
      .orderBy(desc(presets.updatedAt))
      .limit(5),
    db
      .select({
        games: sql<number>`count(distinct ${games.id})`,
        presets: sql<number>`count(distinct ${presets.id})`,
        settings: sql<number>`(select count(*) from ${schema.settings} s where s.user_id = ${userId})`,
      })
      .from(games)
      .leftJoin(presets, eq(presets.gameId, games.id))
      .where(and(eq(games.userId, userId), eq(games.isArchived, false))),
    db
      .select({
        id: devices.id,
        name: devices.name,
        platform: devices.platform,
        lastSeenAt: devices.lastSeenAt,
        applied: devices.applied,
      })
      .from(devices)
      .where(eq(devices.userId, userId))
      .orderBy(desc(devices.lastSeenAt))
      .limit(4),
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

  // ponytail: one fingerprint per device per shown game (max 4 games). Cache per game if the
  // dashboard ever shows more.
  const syncByGame = new Map<string, SyncLabel>();
  if (deviceRows.length > 0) {
    await Promise.all(
      recentGames
        .filter((g) => g.catalogId)
        .map(async (g) => {
          const rows = await deviceRowsForGame(userId, { id: g.id, catalogId: g.catalogId! });
          syncByGame.set(g.id, summarise(rows.map((r) => r.status.kind)));
        }),
    );
  }

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
    overall: labels.length === 0 ? null : summariseLabels(labels),
  };
}

/** Worst status wins: a failure or a pending change is what the user needs to see. */
function summarise(kinds: string[]): SyncLabel {
  if (kinds.length === 0 || kinds.every((k) => k === "never")) return "never";
  if (kinds.includes("failed")) return "failed";
  if (kinds.some((k) => k === "stale" || k === "waiting")) return "pending";
  return "synced";
}

function summariseLabels(labels: SyncLabel[]): SyncLabel {
  if (labels.includes("failed")) return "failed";
  if (labels.includes("pending")) return "pending";
  if (labels.every((l) => l === "never")) return "never";
  return "synced";
}
