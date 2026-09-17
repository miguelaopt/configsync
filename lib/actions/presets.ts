"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as data from "@/lib/data/presets";
import * as revisions from "@/lib/data/revisions";
import { id, presetInputSchema, presetStartSchema } from "@/lib/validation";
import { runAction } from "./shared";

const createSchema = z.object({
  gameId: id,
  input: presetInputSchema,
  start: presetStartSchema,
  fromPresetId: id.optional(),
});

export async function createPresetAction(raw: unknown) {
  return runAction(createSchema, raw, async (v, userId) => {
    const start =
      v.start === "copy" && v.fromPresetId
        ? ({ kind: "copy", fromPresetId: v.fromPresetId } as const)
        : v.start === "starter"
          ? ({ kind: "starter" } as const)
          : ({ kind: "empty" } as const);
    const preset = await data.createPreset(userId, v.gameId, v.input, start);
    revalidatePath("/", "layout");
    return { id: preset.id, slug: preset.slug };
  });
}

export async function updatePresetAction(presetId: string, input: unknown) {
  return runAction(presetInputSchema, input, async (values, userId) => {
    const preset = await data.updatePreset(userId, presetId, values);
    revalidatePath("/", "layout");
    return { id: preset.id, slug: preset.slug };
  });
}

const flagSchema = z.object({ presetId: id, value: z.boolean() });

export async function setPresetFavoriteAction(presetId: string, value: boolean) {
  return runAction(flagSchema, { presetId, value }, async (v, userId) => {
    await data.setPresetFlags(userId, v.presetId, { isFavorite: v.value });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function setPresetVisibilityAction(presetId: string, value: boolean) {
  return runAction(flagSchema, { presetId, value }, async (v, userId) => {
    await data.setPresetFlags(userId, v.presetId, { visibility: v.value ? "public" : "private" });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function setPresetArchivedAction(presetId: string, value: boolean) {
  return runAction(flagSchema, { presetId, value }, async (v, userId) => {
    await data.setPresetFlags(userId, v.presetId, { isArchived: v.value });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function setDefaultPresetAction(presetId: string) {
  return runAction(z.object({ presetId: id }), { presetId }, async (v, userId) => {
    await data.setDefaultPreset(userId, v.presetId);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function duplicatePresetAction(presetId: string, name?: string) {
  return runAction(
    z.object({ presetId: id, name: z.string().trim().max(80).optional() }),
    { presetId, name },
    async (v, userId) => {
      const copy = await data.duplicatePreset(userId, v.presetId, v.name);
      revalidatePath("/", "layout");
      return { id: copy.id, slug: copy.slug };
    },
  );
}

export async function deletePresetAction(presetId: string) {
  return runAction(z.object({ presetId: id }), { presetId }, async (v, userId) => {
    await data.deletePreset(userId, v.presetId);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function createRevisionAction(presetId: string, note?: string) {
  return runAction(
    z.object({ presetId: id, note: z.string().trim().max(200).optional() }),
    { presetId, note },
    async (v, userId) => {
      await revisions.createRevision(userId, v.presetId, v.note || null);
      revalidatePath("/", "layout");
      return null;
    },
  );
}

export async function restoreRevisionAction(presetId: string, revisionId: string) {
  return runAction(
    z.object({ presetId: id, revisionId: id }),
    { presetId, revisionId },
    async (v, userId) => {
      await revisions.restoreRevision(userId, v.presetId, v.revisionId);
      revalidatePath("/", "layout");
      return null;
    },
  );
}
