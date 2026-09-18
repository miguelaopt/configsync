"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { applyScreenshotRows } from "@/lib/data/ai";
import { AppError } from "@/lib/data/errors";
import { settingValueSchema } from "@/lib/import-export/schema";
import { settingTypeSchema } from "@/lib/settings/types";
import { id, settingValueUpdateSchema } from "@/lib/validation";
import { runAction } from "./shared";

const schema = z.object({
  presetId: id,
  updates: z.array(settingValueUpdateSchema).max(1000).default([]),
  creates: z
    .array(
      z.object({
        categoryId: id,
        name: z.string().trim().min(1, "Setting name is required").max(120),
        type: settingTypeSchema,
        value: settingValueSchema.nullish(),
      }),
    )
    .max(200)
    .default([]),
});

/** Saves the rows the user ticked in the screenshot review. */
export async function applyScreenshotAction(raw: unknown) {
  return runAction(schema, raw, async (v, userId) => {
    if (v.updates.length + v.creates.length === 0) throw new AppError("Nothing selected.");
    const creates = v.creates.map((c) => ({ ...c, value: c.value ?? null }));
    const result = await applyScreenshotRows(userId, v.presetId, v.updates, creates);
    revalidatePath("/", "layout");
    return result;
  });
}
