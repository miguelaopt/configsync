import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { uniqueSlug } from "@/lib/utils/slug";
import { notFound } from "./errors";
import { getGameById } from "./games";
import type { PresetInput } from "@/lib/validation";
import type { CategoryDoc, PresetDoc } from "@/lib/import-export/schema";
import type { SettingValue } from "@/lib/settings/types";

const { presets, categories, settings } = schema;

export type CategoryWithSettings = schema.Category & { settings: schema.Setting[] };
export type PresetFull = schema.Preset & { categories: CategoryWithSettings[] };

/** Preset with ordered categories and settings. */
export async function getPresetFull(userId: string, presetId: string, tx: Tx | typeof db = db) {
  const preset = await tx.query.presets.findFirst({
    where: and(eq(presets.userId, userId), eq(presets.id, presetId)),
    with: {
      categories: {
        orderBy: [asc(categories.position), asc(categories.createdAt)],
        with: { settings: { orderBy: [asc(settings.position), asc(settings.createdAt)] } },
      },
    },
  });
  if (!preset) throw notFound("preset");
  return preset as PresetFull;
}

export async function getPresetBySlug(userId: string, gameId: string, slug: string) {
  const row = await db.query.presets.findFirst({
    where: and(eq(presets.userId, userId), eq(presets.gameId, gameId), eq(presets.slug, slug)),
  });
  return row ?? null;
}

export async function getPresetById(userId: string, presetId: string, tx: Tx | typeof db = db) {
  const row = await tx.query.presets.findFirst({
    where: and(eq(presets.userId, userId), eq(presets.id, presetId)),
  });
  if (!row) throw notFound("preset");
  return row;
}

async function takenPresetSlugs(gameId: string, tx: Tx | typeof db) {
  const rows = await tx
    .select({ slug: presets.slug })
    .from(presets)
    .where(eq(presets.gameId, gameId));
  return rows.map((r) => r.slug);
}

/** Starter categories for a new preset (names only; users rename/delete freely). */
export const STARTER_CATEGORIES = ["Controls", "Display", "Graphics", "Audio", "Gameplay"];

export async function createPreset(
  userId: string,
  gameId: string,
  input: PresetInput,
  start: { kind: "empty" } | { kind: "starter" } | { kind: "copy"; fromPresetId: string },
) {
  return db.transaction(async (tx) => {
    await getGameById(userId, gameId, tx);
    const existing = await tx
      .select({ id: presets.id })
      .from(presets)
      .where(eq(presets.gameId, gameId))
      .limit(1);
    const slug = uniqueSlug(input.name, await takenPresetSlugs(gameId, tx));
    const [preset] = await tx
      .insert(presets)
      .values({ ...input, userId, gameId, slug, isDefault: existing.length === 0 })
      .returning();

    if (start.kind === "starter") {
      await tx.insert(categories).values(
        STARTER_CATEGORIES.map((name, position) => ({
          presetId: preset!.id,
          userId,
          name,
          position,
        })),
      );
    } else if (start.kind === "copy") {
      const source = await getPresetFull(userId, start.fromPresetId, tx);
      await insertCategoriesFromDocs(tx, userId, preset!.id, toCategoryDocs(source.categories));
    }
    return preset!;
  });
}

export async function updatePreset(userId: string, presetId: string, input: PresetInput) {
  const existing = await getPresetById(userId, presetId);
  let slug = existing.slug;
  if (existing.name !== input.name) {
    const taken = (await takenPresetSlugs(existing.gameId, db)).filter((s) => s !== existing.slug);
    slug = uniqueSlug(input.name, taken);
  }
  const [preset] = await db
    .update(presets)
    .set({ ...input, slug })
    .where(and(eq(presets.id, presetId), eq(presets.userId, userId)))
    .returning();
  return preset!;
}

export async function setPresetFlags(
  userId: string,
  presetId: string,
  flags: Partial<Pick<schema.Preset, "isFavorite" | "isArchived" | "visibility">>,
) {
  const [preset] = await db
    .update(presets)
    .set(flags)
    .where(and(eq(presets.id, presetId), eq(presets.userId, userId)))
    .returning();
  if (!preset) throw notFound("preset");
  return preset;
}

export async function setDefaultPreset(userId: string, presetId: string) {
  return db.transaction(async (tx) => {
    const preset = await getPresetById(userId, presetId, tx);
    await tx
      .update(presets)
      .set({ isDefault: false })
      .where(
        and(
          eq(presets.gameId, preset.gameId),
          ne(presets.id, presetId),
          eq(presets.isDefault, true),
        ),
      );
    await tx.update(presets).set({ isDefault: true }).where(eq(presets.id, presetId));
    return preset;
  });
}

export async function duplicatePreset(userId: string, presetId: string, newName?: string) {
  return db.transaction(async (tx) => {
    const source = await getPresetFull(userId, presetId, tx);
    const name = newName?.trim() || `${source.name} (copy)`;
    const slug = uniqueSlug(name, await takenPresetSlugs(source.gameId, tx));
    const [copy] = await tx
      .insert(presets)
      .values({
        userId,
        gameId: source.gameId,
        name,
        slug,
        description: source.description,
        notes: source.notes,
        tags: source.tags,
        isDefault: false,
      })
      .returning();
    await insertCategoriesFromDocs(tx, userId, copy!.id, toCategoryDocs(source.categories));
    return copy!;
  });
}

export async function deletePreset(userId: string, presetId: string) {
  const deleted = await db
    .delete(presets)
    .where(and(eq(presets.id, presetId), eq(presets.userId, userId)))
    .returning({ id: presets.id });
  if (deleted.length === 0) throw notFound("preset");
}

// ---------------------------------------------------------------------------
// Row ⇄ document conversion (shared by export, copy, compare, revisions, import)
// ---------------------------------------------------------------------------

export function toCategoryDocs(cats: CategoryWithSettings[]): CategoryDoc[] {
  return cats.map((c) => ({
    name: c.name,
    icon: c.icon,
    settings: c.settings.map((s) => ({
      name: s.name,
      type: s.type,
      value: (s.value as SettingValue | null) ?? null,
      description: s.description,
      unit: s.unit,
      min: s.min,
      max: s.max,
      step: s.step,
      defaultValue: (s.defaultValue as SettingValue | null) ?? null,
      options: s.options,
      notes: s.notes,
    })),
  }));
}

export function toPresetDoc(preset: PresetFull): PresetDoc {
  return {
    name: preset.name,
    description: preset.description,
    notes: preset.notes,
    tags: preset.tags,
    isDefault: preset.isDefault,
    categories: toCategoryDocs(preset.categories),
  };
}

/** Bulk-inserts categories + settings from documents (used by copy/duplicate/import/restore). */
export async function insertCategoriesFromDocs(
  tx: Tx | typeof db,
  userId: string,
  presetId: string,
  docs: CategoryDoc[],
  startPosition = 0,
) {
  for (const [i, cat] of docs.entries()) {
    const [inserted] = await tx
      .insert(categories)
      .values({
        presetId,
        userId,
        name: cat.name,
        icon: cat.icon ?? null,
        position: startPosition + i,
      })
      .returning({ id: categories.id });
    if (cat.settings.length === 0) continue;
    await tx.insert(settings).values(
      cat.settings.map((s, position) => ({
        categoryId: inserted!.id,
        presetId,
        userId,
        name: s.name,
        type: s.type,
        value: s.value ?? null,
        description: s.description ?? null,
        unit: s.unit ?? null,
        min: s.min ?? null,
        max: s.max ?? null,
        step: s.step ?? null,
        defaultValue: s.defaultValue ?? null,
        options: s.options ?? null,
        notes: s.notes ?? null,
        position,
      })),
    );
  }
}
