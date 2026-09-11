import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { AppError, notFound } from "./errors";
import { getPresetById, toCategoryDocs, type CategoryWithSettings } from "./presets";
import { valueSchemaFor, type SettingValue } from "@/lib/settings/types";
import type { CategoryInput, SettingInput } from "@/lib/validation";

const { categories, settings } = schema;

async function nextPosition(
  tx: typeof db | Tx,
  table: typeof categories | typeof settings,
  where: ReturnType<typeof eq>,
) {
  const [row] = await tx
    .select({ next: sql<number>`coalesce(max(${table.position}), -1) + 1` })
    .from(table)
    .where(where);
  return Number(row?.next ?? 0);
}

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------

async function getCategory(userId: string, categoryId: string) {
  const row = await db.query.categories.findFirst({
    where: and(eq(categories.userId, userId), eq(categories.id, categoryId)),
  });
  if (!row) throw notFound("category");
  return row;
}

export async function createCategory(userId: string, presetId: string, input: CategoryInput) {
  await getPresetById(userId, presetId);
  const next = await nextPosition(db, categories, eq(categories.presetId, presetId));
  const [row] = await db
    .insert(categories)
    .values({ presetId, userId, name: input.name, icon: input.icon ?? null, position: next })
    .returning();
  return row!;
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  patch: Partial<CategoryInput> & { isCollapsed?: boolean },
) {
  const [row] = await db
    .update(categories)
    .set(patch)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .returning();
  if (!row) throw notFound("category");
  return row;
}

export async function deleteCategory(userId: string, categoryId: string) {
  const deleted = await db
    .delete(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .returning({ id: categories.id });
  if (deleted.length === 0) throw notFound("category");
}

export async function reorderCategories(userId: string, presetId: string, orderedIds: string[]) {
  await getPresetById(userId, presetId);
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(categories)
        .set({ position, updatedAt: sql`${categories.updatedAt}` })
        .where(and(eq(categories.id, id), eq(categories.presetId, presetId), eq(categories.userId, userId)));
    }
  });
}

export async function duplicateCategory(userId: string, categoryId: string) {
  return db.transaction(async (tx) => {
    const source = await tx.query.categories.findFirst({
      where: and(eq(categories.userId, userId), eq(categories.id, categoryId)),
      with: { settings: { orderBy: [asc(settings.position)] } },
    });
    if (!source) throw notFound("category");
    const next = await nextPosition(tx, categories, eq(categories.presetId, source.presetId));
    const [doc] = toCategoryDocs([source as CategoryWithSettings]);
    const [copy] = await tx
      .insert(categories)
      .values({
        presetId: source.presetId,
        userId,
        name: `${source.name} (copy)`,
        icon: source.icon,
        position: next,
      })
      .returning();
    if (doc!.settings.length > 0) {
      await tx.insert(settings).values(
        doc!.settings.map((s, position) => ({
          categoryId: copy!.id,
          presetId: source.presetId,
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
    return copy!;
  });
}

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------

function assertValueValid(def: SettingInput | schema.Setting, value: SettingValue | null | undefined) {
  if (value == null) return;
  const check = valueSchemaFor(def).safeParse(value);
  if (!check.success) {
    throw new AppError(check.error.issues[0]?.message ?? "That value isn't valid for this setting type.");
  }
}

export async function createSetting(userId: string, input: SettingInput) {
  const category = await getCategory(userId, input.categoryId);
  assertValueValid(input, input.value);
  assertValueValid(input, input.defaultValue);
  const next = await nextPosition(db, settings, eq(settings.categoryId, category.id));
  const [row] = await db
    .insert(settings)
    .values({ ...input, userId, presetId: category.presetId, position: next })
    .returning();
  return row!;
}

export async function updateSetting(userId: string, settingId: string, input: SettingInput) {
  const existing = await db.query.settings.findFirst({
    where: and(eq(settings.userId, userId), eq(settings.id, settingId)),
  });
  if (!existing) throw notFound("setting");
  assertValueValid(input, input.value);
  assertValueValid(input, input.defaultValue);
  let position = existing.position;
  if (input.categoryId !== existing.categoryId) {
    const target = await getCategory(userId, input.categoryId);
    if (target.presetId !== existing.presetId) {
      throw new AppError("Settings can only be moved between categories of the same preset.");
    }
    const next = await nextPosition(db, settings, eq(settings.categoryId, target.id));
    position = next;
  }
  const [row] = await db
    .update(settings)
    .set({ ...input, position })
    .where(and(eq(settings.id, settingId), eq(settings.userId, userId)))
    .returning();
  return row!;
}

/** Batch value update from inline editing. Validates each value against its own definition. */
export async function updateSettingValues(
  userId: string,
  presetId: string,
  updates: { id: string; value?: SettingValue | null | undefined }[],
) {
  if (updates.length === 0) return;
  await getPresetById(userId, presetId);
  const ids = updates.map((u) => u.id);
  const rows = await db
    .select()
    .from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.presetId, presetId), inArray(settings.id, ids)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const u of updates) {
    const def = byId.get(u.id);
    if (!def) throw notFound("setting");
    assertValueValid(def, u.value);
  }
  await db.transaction(async (tx) => {
    for (const u of updates) {
      await tx
        .update(settings)
        .set({ value: u.value ?? null })
        .where(and(eq(settings.id, u.id), eq(settings.userId, userId)));
    }
  });
}

export async function deleteSetting(userId: string, settingId: string) {
  const deleted = await db
    .delete(settings)
    .where(and(eq(settings.id, settingId), eq(settings.userId, userId)))
    .returning({ id: settings.id });
  if (deleted.length === 0) throw notFound("setting");
}

export async function reorderSettings(userId: string, categoryId: string, orderedIds: string[]) {
  await getCategory(userId, categoryId);
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(settings)
        .set({ position, updatedAt: sql`${settings.updatedAt}` })
        .where(and(eq(settings.id, id), eq(settings.categoryId, categoryId), eq(settings.userId, userId)));
    }
  });
}

/** Resets every setting in a category (or preset) to its default value where one exists. */
export async function resetToDefaults(userId: string, scope: { presetId: string } | { categoryId: string }) {
  const where =
    "presetId" in scope
      ? and(eq(settings.userId, userId), eq(settings.presetId, scope.presetId))
      : and(eq(settings.userId, userId), eq(settings.categoryId, scope.categoryId));
  await db
    .update(settings)
    .set({ value: sql`${settings.defaultValue}` })
    .where(and(where, sql`${settings.defaultValue} is not null`));
}

