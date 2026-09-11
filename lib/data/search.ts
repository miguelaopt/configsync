import "server-only";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { escapeLike } from "./games";

const { games, presets, categories, settings } = schema;

export type SearchHit =
  | { kind: "game"; id: string; title: string; subtitle: string; href: string }
  | { kind: "preset"; id: string; title: string; subtitle: string; href: string }
  | { kind: "category"; id: string; title: string; subtitle: string; href: string }
  | { kind: "setting"; id: string; title: string; subtitle: string; href: string; value: string };

/**
 * Global search across games, presets, categories, settings (name, value, notes) and tags.
 * ILIKE substring match; libraries are small enough that trigram indexes can wait.
 */
export async function searchAll(userId: string, query: string, limit = 8): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const pattern = `%${escapeLike(q)}%`;

  const [gameRows, presetRows, categoryRows, settingRows] = await Promise.all([
    db
      .select({
        id: games.id,
        name: games.name,
        slug: games.slug,
        platforms: games.platforms,
        tags: games.tags,
      })
      .from(games)
      .where(
        and(
          eq(games.userId, userId),
          eq(games.isArchived, false),
          or(
            ilike(games.name, pattern),
            sql`array_to_string(${games.tags}, ' ') ILIKE ${pattern}`,
            sql`array_to_string(${games.platforms}, ' ') ILIKE ${pattern}`,
            ilike(games.notes, pattern),
          ),
        ),
      )
      .limit(limit),
    db
      .select({
        id: presets.id,
        name: presets.name,
        slug: presets.slug,
        gameName: games.name,
        gameSlug: games.slug,
      })
      .from(presets)
      .innerJoin(games, eq(games.id, presets.gameId))
      .where(
        and(
          eq(presets.userId, userId),
          eq(presets.isArchived, false),
          or(
            ilike(presets.name, pattern),
            ilike(presets.description, pattern),
            ilike(presets.notes, pattern),
            sql`array_to_string(${presets.tags}, ' ') ILIKE ${pattern}`,
          ),
        ),
      )
      .limit(limit),
    db
      .select({
        id: categories.id,
        name: categories.name,
        presetName: presets.name,
        presetSlug: presets.slug,
        gameName: games.name,
        gameSlug: games.slug,
      })
      .from(categories)
      .innerJoin(presets, eq(presets.id, categories.presetId))
      .innerJoin(games, eq(games.id, presets.gameId))
      .where(and(eq(categories.userId, userId), ilike(categories.name, pattern)))
      .limit(limit),
    db
      .select({
        id: settings.id,
        name: settings.name,
        value: settings.value,
        type: settings.type,
        options: settings.options,
        unit: settings.unit,
        categoryId: settings.categoryId,
        categoryName: categories.name,
        presetName: presets.name,
        presetSlug: presets.slug,
        gameName: games.name,
        gameSlug: games.slug,
      })
      .from(settings)
      .innerJoin(categories, eq(categories.id, settings.categoryId))
      .innerJoin(presets, eq(presets.id, settings.presetId))
      .innerJoin(games, eq(games.id, presets.gameId))
      .where(
        and(
          eq(settings.userId, userId),
          or(
            ilike(settings.name, pattern),
            ilike(settings.notes, pattern),
            ilike(settings.description, pattern),
            sql`${settings.value}::text ILIKE ${pattern}`,
          ),
        ),
      )
      .limit(limit * 2),
  ]);

  const { formatValue } = await import("@/lib/settings/types");

  return [
    ...gameRows.map<SearchHit>((g) => ({
      kind: "game",
      id: g.id,
      title: g.name,
      subtitle: [...g.platforms, ...g.tags].join(" · ") || "Game",
      href: `/games/${g.slug}`,
    })),
    ...presetRows.map<SearchHit>((p) => ({
      kind: "preset",
      id: p.id,
      title: p.name,
      subtitle: p.gameName,
      href: `/games/${p.gameSlug}/${p.slug}`,
    })),
    ...categoryRows.map<SearchHit>((c) => ({
      kind: "category",
      id: c.id,
      title: c.name,
      subtitle: `${c.gameName} › ${c.presetName}`,
      href: `/games/${c.gameSlug}/${c.presetSlug}#category-${c.id}`,
    })),
    ...settingRows.map<SearchHit>((s) => ({
      kind: "setting",
      id: s.id,
      title: s.name,
      subtitle: `${s.gameName} › ${s.presetName} › ${s.categoryName}`,
      href: `/games/${s.gameSlug}/${s.presetSlug}#setting-${s.id}`,
      value: formatValue(
        { type: s.type, options: s.options, unit: s.unit },
        s.value as Parameters<typeof formatValue>[1],
      ),
    })),
  ];
}
