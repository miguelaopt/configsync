"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as data from "@/lib/data/settings";
import { createRevision } from "@/lib/data/revisions";
import { categoryInputSchema, id, settingInputSchema, settingValueUpdateSchema } from "@/lib/validation";
import { runAction } from "./shared";

// Categories ------------------------------------------------------------------

export async function createCategoryAction(presetId: string, input: unknown) {
  return runAction(
    z.object({ presetId: id, input: categoryInputSchema }),
    { presetId, input },
    async (v, userId) => {
      const category = await data.createCategory(userId, v.presetId, v.input);
      revalidatePath("/", "layout");
      return { id: category.id };
    },
  );
}

export async function updateCategoryAction(categoryId: string, input: unknown) {
  return runAction(
    z.object({ categoryId: id, input: categoryInputSchema }),
    { categoryId, input },
    async (v, userId) => {
      await data.updateCategory(userId, v.categoryId, v.input);
      revalidatePath("/", "layout");
      return null;
    },
  );
}

export async function setCategoryCollapsedAction(categoryId: string, isCollapsed: boolean) {
  return runAction(
    z.object({ categoryId: id, isCollapsed: z.boolean() }),
    { categoryId, isCollapsed },
    async (v, userId) => {
      await data.updateCategory(userId, v.categoryId, { isCollapsed: v.isCollapsed });
      return null;
    },
  );
}

export async function deleteCategoryAction(categoryId: string) {
  return runAction(z.object({ categoryId: id }), { categoryId }, async (v, userId) => {
    await data.deleteCategory(userId, v.categoryId);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function duplicateCategoryAction(categoryId: string) {
  return runAction(z.object({ categoryId: id }), { categoryId }, async (v, userId) => {
    const copy = await data.duplicateCategory(userId, v.categoryId);
    revalidatePath("/", "layout");
    return { id: copy.id };
  });
}

export async function reorderCategoriesAction(presetId: string, orderedIds: string[]) {
  return runAction(
    z.object({ presetId: id, orderedIds: z.array(id).max(500) }),
    { presetId, orderedIds },
    async (v, userId) => {
      await data.reorderCategories(userId, v.presetId, v.orderedIds);
      revalidatePath("/", "layout");
      return null;
    },
  );
}

// Settings --------------------------------------------------------------------

export async function createSettingAction(input: unknown) {
  return runAction(settingInputSchema, input, async (values, userId) => {
    const setting = await data.createSetting(userId, values);
    revalidatePath("/", "layout");
    return { id: setting.id };
  });
}

export async function updateSettingAction(settingId: string, input: unknown) {
  return runAction(
    z.object({ settingId: id, input: settingInputSchema }),
    { settingId, input },
    async (v, userId) => {
      await data.updateSetting(userId, v.settingId, v.input);
      revalidatePath("/", "layout");
      return null;
    },
  );
}

export async function deleteSettingAction(settingId: string) {
  return runAction(z.object({ settingId: id }), { settingId }, async (v, userId) => {
    await data.deleteSetting(userId, v.settingId);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function reorderSettingsAction(categoryId: string, orderedIds: string[]) {
  return runAction(
    z.object({ categoryId: id, orderedIds: z.array(id).max(1000) }),
    { categoryId, orderedIds },
    async (v, userId) => {
      await data.reorderSettings(userId, v.categoryId, v.orderedIds);
      revalidatePath("/", "layout");
      return null;
    },
  );
}

/** Saves edited values in one go and records a revision. */
export async function saveSettingValuesAction(presetId: string, updates: unknown) {
  return runAction(
    z.object({ presetId: id, updates: z.array(settingValueUpdateSchema).min(1).max(1000) }),
    { presetId, updates },
    async (v, userId) => {
      await data.updateSettingValues(userId, v.presetId, v.updates);
      await createRevision(userId, v.presetId, `Edited ${v.updates.length} setting${v.updates.length === 1 ? "" : "s"}`);
      revalidatePath("/", "layout");
      return null;
    },
  );
}

export async function resetToDefaultsAction(scope: { presetId: string } | { categoryId: string }) {
  return runAction(
    z.union([z.object({ presetId: id }), z.object({ categoryId: id })]),
    scope,
    async (v, userId) => {
      await data.resetToDefaults(userId, v);
      revalidatePath("/", "layout");
      return null;
    },
  );
}
