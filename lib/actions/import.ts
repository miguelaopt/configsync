"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseImportFile } from "@/lib/import-export/parse";
import { importFile } from "@/lib/data/import";
import { AppError } from "@/lib/data/errors";
import { id } from "@/lib/validation";
import { runAction } from "./shared";

const schema = z.object({
  text: z.string().max(5 * 1024 * 1024, "File is larger than 5 MB."),
  targetGameId: id.nullable().optional(),
});

export async function importAction(raw: unknown) {
  return runAction(schema, raw, async (v, userId) => {
    const parsed = parseImportFile(v.text);
    if (!parsed.ok) throw new AppError(parsed.errors.join("\n"));
    const outcome = await importFile(userId, parsed.file, { targetGameId: v.targetGameId ?? null });
    revalidatePath("/", "layout");
    return { ...outcome, warnings: parsed.warnings };
  });
}
