import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getPlan } from "@/lib/billing/plan";
import { AI_DAILY_MESSAGE, AI_LIMIT_MESSAGE, limitsFor } from "@/lib/billing/limits";
import { getScreenshotParser, type ScreenshotImage } from "@/lib/providers/screenshot";
import { buildHints, matchProposals, type ScreenshotRow } from "@/lib/ai/screenshot";
import type { SettingTypeId, SettingValue } from "@/lib/settings/types";
import { AppError } from "./errors";
import { getGameById } from "./games";
import { getPresetFull } from "./presets";
import { createRevision } from "./revisions";
import { createSetting, updateSettingValues } from "./settings";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Throws when the plan has no screenshot quota or the rolling 24 h cap is reached. */
export async function assertCanAnalyse(userId: string) {
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
  if ((row?.n ?? 0) >= max) throw new AppError(AI_DAILY_MESSAGE, "forbidden");
}

/** Sends one image to the configured parser and matches the result to the preset. */
export async function analyseScreenshot(
  userId: string,
  presetId: string,
  image: ScreenshotImage,
): Promise<{ rows: ScreenshotRow[] }> {
  const parser = getScreenshotParser();
  if (!parser) throw new AppError("Screenshot import isn't configured on this server.");
  // ponytail: the cap is checked before the call and counted after, so a parallel burst can
  // overshoot by a few images. Insert the row first (and delete on failure) if that ever matters.
  await assertCanAnalyse(userId);
  const preset = await getPresetFull(userId, presetId);
  const game = await getGameById(userId, preset.gameId);
  const { proposals, usage } = await parser.parse(image, buildHints(game, preset.categories));
  await db.insert(schema.aiRequests).values({
    userId,
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  return { rows: matchProposals(proposals, preset.categories) };
}

export type ScreenshotCreate = {
  categoryId: string;
  name: string;
  type: SettingTypeId;
  value: SettingValue | null;
};

/** Writes the rows the user confirmed (validated by the settings layer), then snapshots the preset. */
export async function applyScreenshotRows(
  userId: string,
  presetId: string,
  updates: { id: string; value?: SettingValue | null }[],
  creates: ScreenshotCreate[],
) {
  const preset = await getPresetFull(userId, presetId);
  const own = new Set(preset.categories.map((c) => c.id));
  if (creates.some((c) => !own.has(c.categoryId)))
    throw new AppError("That category isn't in this preset.");
  await db.transaction(async (tx) => {
    await updateSettingValues(userId, presetId, updates, tx);
    for (const c of creates) await createSetting(userId, c, tx);
  });
  await createRevision(userId, presetId, "Imported from screenshot");
  return { updated: updates.length, created: creates.length };
}
