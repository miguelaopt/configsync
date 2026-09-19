"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCatalogGame } from "@/lib/catalog";
import { createGameFromCatalog, importConfigFiles, patchConfigFiles } from "@/lib/data/catalog";
import { AppError } from "@/lib/data/errors";
import { readGameConfig } from "@/lib/game-configs";
import { catalogIdSchema, configFilesSchema, id } from "@/lib/validation";
import { runAction } from "./shared";

export async function createGameFromCatalogAction(catalogId: string) {
  return runAction(z.object({ catalogId: z.string().min(1) }), { catalogId }, async (v, userId) => {
    const game = await createGameFromCatalog(userId, v.catalogId);
    revalidatePath("/", "layout");
    return { id: game.id, slug: game.slug };
  });
}

const filesInput = z.object({ catalogId: catalogIdSchema, files: configFilesSchema });

/** What an import would read from these files, without saving anything. */
export async function previewGameConfigAction(raw: unknown) {
  return runAction(filesInput, raw, async (v) => {
    const entry = getCatalogGame(v.catalogId);
    if (!entry) throw new AppError("That game isn't in the catalog.");
    const read = readGameConfig(entry, v.files);
    return {
      ...read,
      settingCount: Object.values(read.perFile).reduce((n, count) => n + count, 0),
    };
  });
}

export async function importGameConfigAction(raw: unknown) {
  const schema = filesInput.extend({ name: z.string().trim().max(80).optional() });
  return runAction(schema, raw, async (v, userId) => {
    const entry = getCatalogGame(v.catalogId);
    if (!entry) throw new AppError("That game isn't in the catalog.");
    if (!Object.values(readGameConfig(entry, v.files).perFile).some((count) => count > 0)) {
      throw new AppError(
        "No settings could be read. Check that these are the selected game's config files.",
      );
    }
    const r = await importConfigFiles(userId, v);
    revalidatePath("/", "layout");
    const { preset: _preset, ...read } = r.read;
    return { url: `/games/${r.gameSlug}/${r.presetSlug}`, read };
  });
}

export async function patchGameConfigAction(raw: unknown) {
  return runAction(filesInput.extend({ presetId: id }), raw, (v, userId) =>
    patchConfigFiles(userId, v),
  );
}
