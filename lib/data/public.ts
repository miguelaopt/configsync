import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { toCategoryDocs, type PresetFull } from "./presets";
import type { CategoryDoc, GameDoc } from "@/lib/import-export/schema";

const { profiles, games, presets, categories, settings } = schema;
const HTTPS = /^https:\/\/\S+$/;

export type PublicProfile = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  links: string[];
  games: {
    name: string;
    slug: string;
    coverUrl: string | null;
    accentColor: string | null;
    presets: { name: string; slug: string; description: string | null; settingCount: number }[];
  }[];
};

/** Only readers for the public pages live here: every query filters on is_public + visibility. */
async function publicProfileRow(username: string) {
  return db.query.profiles.findFirst({
    where: and(eq(profiles.username, username.toLowerCase()), eq(profiles.isPublic, true)),
  });
}

/** Profile + every public preset, grouped by game. Null unless the profile is public. */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const profile = await publicProfileRow(username);
  if (!profile) return null;
  const rows = await db
    .select({
      gameName: games.name,
      gameSlug: games.slug,
      coverUrl: games.coverUrl,
      accentColor: games.accentColor,
      presetName: presets.name,
      presetSlug: presets.slug,
      description: presets.description,
      presetId: presets.id,
    })
    .from(presets)
    .innerJoin(games, eq(games.id, presets.gameId))
    .where(
      and(
        eq(presets.userId, profile.userId),
        eq(presets.visibility, "public"),
        eq(presets.isArchived, false),
        eq(games.isArchived, false),
      ),
    )
    .orderBy(asc(games.name), asc(presets.name));

  const counts = new Map<string, number>();
  if (rows.length > 0) {
    const countRows = await db
      .select({ presetId: categories.presetId })
      .from(settings)
      .innerJoin(categories, eq(categories.id, settings.categoryId))
      .where(
        inArray(
          categories.presetId,
          rows.map((r) => r.presetId),
        ),
      );
    for (const r of countRows) counts.set(r.presetId, (counts.get(r.presetId) ?? 0) + 1);
  }

  const byGame = new Map<string, PublicProfile["games"][number]>();
  for (const r of rows) {
    let g = byGame.get(r.gameSlug);
    if (!g) {
      g = {
        name: r.gameName,
        slug: r.gameSlug,
        coverUrl: r.coverUrl,
        accentColor: r.accentColor,
        presets: [],
      };
      byGame.set(r.gameSlug, g);
    }
    g.presets.push({
      name: r.presetName,
      slug: r.presetSlug,
      description: r.description,
      settingCount: counts.get(r.presetId) ?? 0,
    });
  }
  return {
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    links: profile.links.filter((l) => HTTPS.test(l)),
    games: [...byGame.values()],
  };
}

export type PublicPreset = {
  profile: { username: string; displayName: string | null };
  game: { name: string; slug: string; accentColor: string | null; coverUrl: string | null };
  preset: {
    name: string;
    slug: string;
    description: string | null;
    tags: string[];
    updatedAt: Date;
  };
  categories: CategoryDoc[];
  doc: GameDoc;
};

/** One public preset with its settings. Notes are stripped: they are personal. */
export async function getPublicPreset(
  username: string,
  gameSlug: string,
  presetSlug: string,
): Promise<PublicPreset | null> {
  const profile = await publicProfileRow(username);
  if (!profile) return null;
  const game = await db.query.games.findFirst({
    where: and(
      eq(games.userId, profile.userId),
      eq(games.slug, gameSlug),
      eq(games.isArchived, false),
    ),
  });
  if (!game) return null;
  const preset = await db.query.presets.findFirst({
    where: and(
      eq(presets.gameId, game.id),
      eq(presets.slug, presetSlug),
      eq(presets.visibility, "public"),
      eq(presets.isArchived, false),
    ),
    with: {
      categories: {
        orderBy: [asc(categories.position), asc(categories.createdAt)],
        with: { settings: { orderBy: [asc(settings.position), asc(settings.createdAt)] } },
      },
    },
  });
  if (!preset) return null;
  const cats = toCategoryDocs((preset as PresetFull).categories).map((c) => ({
    ...c,
    settings: c.settings.map((s) => ({ ...s, notes: null })),
  }));
  const doc: GameDoc = {
    name: game.name,
    platforms: game.platforms,
    tags: game.tags,
    accentColor: game.accentColor,
    coverUrl: game.coverUrl,
    notes: null,
    catalogId: game.catalogId,
    presets: [
      {
        name: preset.name,
        description: preset.description,
        notes: null,
        tags: preset.tags,
        isDefault: false,
        categories: cats,
      },
    ],
  };
  return {
    profile: { username: profile.username, displayName: profile.displayName },
    game: {
      name: game.name,
      slug: game.slug,
      accentColor: game.accentColor,
      coverUrl: game.coverUrl,
    },
    preset: {
      name: preset.name,
      slug: preset.slug,
      description: preset.description,
      tags: preset.tags,
      updatedAt: preset.updatedAt,
    },
    categories: cats,
    doc,
  };
}
