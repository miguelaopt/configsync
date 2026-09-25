import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getPlan } from "@/lib/billing/plan";
import { AI_DAILY_MESSAGE, AI_LIMIT_MESSAGE, limitsFor } from "@/lib/billing/limits";
import { getScreenshotParser, type ScreenshotImage } from "@/lib/providers/screenshot";
import {
  buildHints,
  knownSettings,
  matchProposals,
  normalise,
  type ScreenshotRow,
} from "@/lib/ai/screenshot";
import { getCatalogGame } from "@/lib/catalog";
import type { SettingOption, SettingTypeId, SettingValue } from "@/lib/settings/types";
import { AppError } from "./errors";
import { getGameById } from "./games";
import { getPresetFull } from "./presets";
import { createRevision } from "./revisions";
import { createCategory, createSetting, updateSettingValues } from "./settings";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Throws when the plan has no screenshot quota or `images` more would pass the rolling 24 h cap. */
export async function assertCanAnalyse(userId: string, images = 1) {
  const max = limitsFor((await getPlan(userId)).plan).aiScreenshots;
  if (max === 0) throw new AppError(AI_LIMIT_MESSAGE, "forbidden");
  const [row] = await db
    .select({ n: count() })
    .from(schema.aiRequests)
    .where(
      and(
        eq(schema.aiRequests.userId, userId),
        gte(schema.aiRequests.createdAt, new Date(Date.now() - DAY_MS)),
      ),
    );
  const used = row?.n ?? 0;
  if (used >= max) throw new AppError(AI_DAILY_MESSAGE, "forbidden");
  if (used + images > max)
    throw new AppError(
      `You have ${max - used} of today's ${max} screenshots left. Send fewer at once or try again later.`,
      "forbidden",
    );
}

/** Sends every screenshot of a menu in one call and matches the result to the preset. */
export async function analyseScreenshots(
  userId: string,
  presetId: string,
  images: ScreenshotImage[],
): Promise<{ rows: ScreenshotRow[] }> {
  const parser = getScreenshotParser();
  if (!parser) throw new AppError("Screenshot import isn't configured on this server.");
  // ponytail: the cap is checked before the call and counted after, so a parallel burst can
  // overshoot by a few images. Insert the rows first (and delete on failure) if that ever matters.
  await assertCanAnalyse(userId, images.length);
  const preset = await getPresetFull(userId, presetId);
  const game = await getGameById(userId, preset.gameId);
  const known = knownSettings(game.catalogId ? getCatalogGame(game.catalogId) : null);
  const { proposals, usage } = await parser.parse(
    images,
    buildHints(game, preset.categories, known),
  );
  // One row per screenshot, so the daily cap keeps counting screenshots.
  await db.insert(schema.aiRequests).values(
    images.map(() => ({
      userId,
      model: usage.model,
      inputTokens: Math.round(usage.inputTokens / images.length),
      outputTokens: Math.round(usage.outputTokens / images.length),
    })),
  );
  return { rows: matchProposals(proposals, preset.categories, known) };
}

export type ScreenshotCreate = {
  /** An existing category of the preset, or the name of one to create. */
  category: { id: string } | { name: string };
  name: string;
  type: SettingTypeId;
  value: SettingValue | null;
  options?: SettingOption[] | null;
  min?: number | null;
  max?: number | null;
  unit?: string | null;
};

/**
 * Writes the rows the user confirmed (validated by the settings layer), creating any category
 * they asked for once per name, then snapshots the preset.
 */
export async function applyScreenshotRows(
  userId: string,
  presetId: string,
  updates: { id: string; value?: SettingValue | null }[],
  creates: ScreenshotCreate[],
) {
  const preset = await getPresetFull(userId, presetId);
  const own = new Map(preset.categories.map((c) => [c.id, c]));
  const byName = new Map(preset.categories.map((c) => [normalise(c.name), c.id]));
  if (creates.some((c) => "id" in c.category && !own.has(c.category.id)))
    throw new AppError("That category isn't in this preset.");
  let createdCategories = 0;
  await db.transaction(async (tx) => {
    await updateSettingValues(userId, presetId, updates, tx);
    for (const { category, ...c } of creates) {
      let categoryId = "id" in category ? category.id : byName.get(normalise(category.name));
      if (!categoryId && "name" in category) {
        categoryId = (await createCategory(userId, presetId, { name: category.name }, tx)).id;
        byName.set(normalise(category.name), categoryId);
        createdCategories++;
      }
      await createSetting(userId, { ...c, categoryId: categoryId! }, tx);
    }
  });
  await createRevision(userId, presetId, "Imported from screenshot");
  return { updated: updates.length, created: creates.length, createdCategories };
}
